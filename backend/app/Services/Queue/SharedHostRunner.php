<?php

namespace App\Services\Queue;

use App\Enums\ChunkStatus;
use App\Enums\JobStatus;
use App\Enums\LogLevel;
use App\Enums\StageStatus;
use App\Models\PipelineJob;
use App\Models\PipelineJobFile;
use App\Models\ToHtmlJob;
use App\Models\ToHtmlJobChunk;
use App\Services\Ai\DeepSeekClient;
use App\Services\Ai\OcrProvider;
use App\Services\Drive\DriveGateway;
use App\Services\Storage\OutputStorage;
use App\Services\Support\JobLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Psr\Log\LoggerInterface;
use Throwable;

class SharedHostRunner
{
    public function __construct(
        private readonly DriveGateway $drive,
        private readonly OcrProvider $ocr,
        private readonly DeepSeekClient $deepseek,
        private readonly ?LoggerInterface $logger = null
    ) {}

    /**
     * Executes work units within a bounded time budget and exits cleanly before host limits.
     *
     * @return array{processed: int, failed: int, recovered: int, duration_ms: int, timed_out: bool}
     */
    public function run(?int $maxExecutionTime = null, ?int $maxUnits = null, string $queue = 'all'): array
    {
        $startTime = microtime(true);
        $maxTime = $maxExecutionTime ?? (int) config('automation.runner.max_execution_time', 50);
        $maxUnitsCount = $maxUnits ?? (int) config('automation.runner.max_units_per_run', 10);
        $leaseDuration = (int) config('automation.runner.lease_duration_seconds', 120);

        // Required execution buffer for individual units to finish safely
        $configuredDeepseekBuffer = (int) config('automation.runner.deepseek_unit_buffer', 35);
        $configuredDriveBuffer = (int) config('automation.runner.drive_unit_buffer', 45);

        // Scale buffer for short test runs (e.g. maxTime < 30)
        $deepseekBuffer = (int) min($configuredDeepseekBuffer, max(1, (int) floor($maxTime / 2)));
        $driveBuffer = (int) min($configuredDriveBuffer, max(1, (int) floor($maxTime / 2)));
        $minRequiredBuffer = min($deepseekBuffer, $driveBuffer);

        $processed = 0;
        $failed = 0;
        $recovered = $this->reconcileStaleClaims();
        $timedOut = false;

        $runDrive = in_array($queue, ['all', 'drive-ocr', 'pipeline'], true);
        $runDeepSeek = in_array($queue, ['all', 'deepseek', 'tohtml'], true);
        $preferDrive = true;

        while ($processed < $maxUnitsCount) {
            $remainingTime = $maxTime - (microtime(true) - $startTime);

            $canRunDrive = $runDrive && ($remainingTime >= $driveBuffer);
            $canRunDeepSeek = $runDeepSeek && ($remainingTime >= $deepseekBuffer);

            // If remaining budget cannot safely accommodate either unit type, exit cleanly
            if (!$canRunDrive && !$canRunDeepSeek) {
                $timedOut = true;
                break;
            }

            $didWork = false;
            $token = (string) Str::uuid();

            // Interleave between Drive OCR and DeepSeek to prevent queue starvation
            if ($preferDrive && $canRunDrive) {
                $file = $this->claimNextDriveFile($token, $leaseDuration);
                if ($file) {
                    $success = $this->processDriveFile($file, $token);
                    $success ? $processed++ : $failed++;
                    $didWork = true;
                }
            } elseif (!$preferDrive && $canRunDeepSeek) {
                $chunk = $this->claimNextToHtmlChunk($token, $leaseDuration);
                if ($chunk) {
                    $success = $this->processToHtmlChunk($chunk, $token);
                    $success ? $processed++ : $failed++;
                    $didWork = true;
                }
            }

            // If preferred queue had no eligible work, try the alternative
            if (!$didWork) {
                if ($preferDrive && $canRunDeepSeek) {
                    $chunk = $this->claimNextToHtmlChunk($token, $leaseDuration);
                    if ($chunk) {
                        $success = $this->processToHtmlChunk($chunk, $token);
                        $success ? $processed++ : $failed++;
                        $didWork = true;
                    }
                } elseif (!$preferDrive && $canRunDrive) {
                    $file = $this->claimNextDriveFile($token, $leaseDuration);
                    if ($file) {
                        $success = $this->processDriveFile($file, $token);
                        $success ? $processed++ : $failed++;
                        $didWork = true;
                    }
                }
            }

            // Toggle preference for fair scheduling across cycles
            $preferDrive = !$preferDrive;

            if (!$didWork) {
                // No pending work found in any selected queue
                break;
            }
        }

        $totalDurationMs = (int) round((microtime(true) - $startTime) * 1000);

        return [
            'processed' => $processed,
            'failed' => $failed,
            'recovered' => $recovered,
            'duration_ms' => $totalDurationMs,
            'timed_out' => $timedOut,
        ];
    }

    /**
     * Atomically claims the next pending or expired Drive file using database transaction and row locking.
     */
    public function claimNextDriveFile(string $token, int $leaseSeconds): ?PipelineJobFile
    {
        return DB::transaction(function () use ($token, $leaseSeconds) {
            $file = PipelineJobFile::where(function ($query) {
                $query->where('overall_status', StageStatus::Pending)
                    ->orWhere(function ($sub) {
                        $sub->where('overall_status', StageStatus::InProgress)
                            ->whereNotNull('claim_expires_at')
                            ->where('claim_expires_at', '<', now());
                    });
            })
            ->orderBy('position')
            ->lockForUpdate()
            ->first();

            if (!$file) {
                return null;
            }

            $file->update([
                'overall_status' => StageStatus::InProgress,
                'claimed_at' => now(),
                'claim_token' => $token,
                'claim_expires_at' => now()->addSeconds($leaseSeconds),
                'heartbeat_at' => now(),
                'started_at' => $file->started_at ?? now(),
            ]);

            return $file;
        }, 3);
    }

    /**
     * Atomically claims the next pending or expired ToHTML chunk using database transaction and row locking.
     */
    public function claimNextToHtmlChunk(string $token, int $leaseSeconds): ?ToHtmlJobChunk
    {
        return DB::transaction(function () use ($token, $leaseSeconds) {
            $chunk = ToHtmlJobChunk::where(function ($query) {
                $query->where('status', ChunkStatus::Pending)
                    ->orWhere(function ($sub) {
                        $sub->where('status', ChunkStatus::Processing)
                            ->whereNotNull('claim_expires_at')
                            ->where('claim_expires_at', '<', now());
                    });
            })
            ->orderBy('global_index')
            ->lockForUpdate()
            ->first();

            if (!$chunk) {
                return null;
            }

            $chunk->update([
                'status' => ChunkStatus::Processing,
                'claimed_at' => now(),
                'claim_token' => $token,
                'claim_expires_at' => now()->addSeconds($leaseSeconds),
                'attempt_count' => $chunk->attempt_count + 1,
                'heartbeat_at' => now(),
                'started_at' => $chunk->started_at ?? now(),
            ]);

            return $chunk;
        }, 3);
    }

    /**
     * Processes a single Drive file through its resumable stages with claim token validation.
     */
    public function processDriveFile(PipelineJobFile $file, ?string $expectedToken = null): bool
    {
        $jobId = $file->pipeline_job_id;
        $fileName = $file->file_name;
        $fileId = $file->drive_file_id;
        $token = $expectedToken ?? $file->claim_token;
        if (empty($token)) {
            $token = (string) Str::uuid();
            $file->update([
                'claim_token' => $token,
                'claim_expires_at' => now()->addSeconds((int) config('automation.runner.lease_duration_seconds', 120)),
            ]);
        }
        $tempPdfPath = storage_path("app/temp/{$fileId}.pdf");
        $leaseDuration = (int) config('automation.runner.lease_duration_seconds', 120);

        try {
            // Stage 1: Download (if not already downloaded)
            if ($file->download_status !== StageStatus::Success || !file_exists($tempPdfPath)) {
                $dlStart = microtime(true);

                $affected = PipelineJobFile::where('id', $file->id)
                    ->where('claim_token', $token)
                    ->update([
                        'download_status' => StageStatus::InProgress,
                        'heartbeat_at' => now(),
                    ]);

                if ($affected === 0) {
                    JobLogger::logPipeline($jobId, LogLevel::Warn, "Stale claim token rejected for file {$fileName}. Another worker claimed this file.", 'download', $fileId, $fileName);
                    return false;
                }

                JobLogger::logPipeline($jobId, LogLevel::Info, "Downloading file from Google Drive...", 'download', $fileId, $fileName);
                $this->drive->download($fileId, $tempPdfPath);
                $dlDuration = (int) round((microtime(true) - $dlStart) * 1000);

                // Renew lease after download completes
                $affected = PipelineJobFile::where('id', $file->id)
                    ->where('claim_token', $token)
                    ->update([
                        'download_status' => StageStatus::Success,
                        'download_ms' => $dlDuration,
                        'heartbeat_at' => now(),
                        'claim_expires_at' => now()->addSeconds($leaseDuration),
                    ]);

                if ($affected === 0) {
                    JobLogger::logPipeline($jobId, LogLevel::Warn, "Stale claim token rejected after download for file {$fileName}.", 'download', $fileId, $fileName);
                    return false;
                }

                JobLogger::logPipeline($jobId, LogLevel::Info, "Download completed successfully in {$dlDuration}ms", 'download', $fileId, $fileName);
            }

            // Stage 2: OCR Extraction
            if ($file->ocr_status !== StageStatus::Success || empty($file->result)) {
                $ocrStart = microtime(true);

                $affected = PipelineJobFile::where('id', $file->id)
                    ->where('claim_token', $token)
                    ->update([
                        'ocr_status' => StageStatus::InProgress,
                        'heartbeat_at' => now(),
                    ]);

                if ($affected === 0) {
                    JobLogger::logPipeline($jobId, LogLevel::Warn, "Stale claim token rejected before OCR for file {$fileName}.", 'ocr', $fileId, $fileName);
                    return false;
                }

                JobLogger::logPipeline($jobId, LogLevel::Info, "Executing OCR extraction...", 'ocr', $fileId, $fileName);
                $ocrText = $this->ocr->extract($tempPdfPath, $fileName, $file->gemini_file_uri, $file->gemini_file_name);
                $ocrDuration = (int) round((microtime(true) - $ocrStart) * 1000);

                // Renew lease after OCR completes
                $affected = PipelineJobFile::where('id', $file->id)
                    ->where('claim_token', $token)
                    ->update([
                        'ocr_status' => StageStatus::Success,
                        'ocr_ms' => $ocrDuration,
                        'result' => $ocrText,
                        'heartbeat_at' => now(),
                        'claim_expires_at' => now()->addSeconds($leaseDuration),
                    ]);

                if ($affected === 0) {
                    JobLogger::logPipeline($jobId, LogLevel::Warn, "Stale claim token rejected after OCR for file {$fileName}.", 'ocr', $fileId, $fileName);
                    return false;
                }

                JobLogger::logPipeline($jobId, LogLevel::Info, "OCR extraction completed in {$ocrDuration}ms", 'ocr', $fileId, $fileName);
            } else {
                $ocrText = $file->result;
            }

            // Stage 3: Local Storage Persistence
            $saveStart = microtime(true);

            $baseName = pathinfo($fileName, PATHINFO_FILENAME);
            $outputFolder = OutputStorage::sanitizeFolderName($baseName);
            $outputFilename = "{$outputFolder}_result.txt";
            $outputPath = "outputs/{$outputFolder}/result.txt";

            OutputStorage::writeText($outputFolder, 'result.txt', $ocrText);
            $saveDuration = (int) round((microtime(true) - $saveStart) * 1000);

            // Final atomic status completion guarded by claim_token
            $affected = PipelineJobFile::where('id', $file->id)
                ->where('claim_token', $token)
                ->update([
                    'upload_status' => StageStatus::Success,
                    'overall_status' => StageStatus::Success,
                    'output_filename' => $outputFilename,
                    'output_path' => $outputPath,
                    'upload_ms' => $saveDuration,
                    'completed_at' => now(),
                    'heartbeat_at' => now(),
                    'claim_token' => null,
                    'claim_expires_at' => null,
                ]);

            if ($affected === 0) {
                JobLogger::logPipeline($jobId, LogLevel::Warn, "Stale claim token rejected on completion for file {$fileName}.", 'upload', $fileId, $fileName);
                return false;
            }

            JobLogger::logPipeline($jobId, LogLevel::Info, "OCR result saved locally as \"{$outputFilename}\" in {$saveDuration}ms", 'upload', $fileId, $fileName);

            return true;
        } catch (Throwable $e) {
            $errorStage = $file->ocr_status === StageStatus::InProgress ? 'ocr' : ($file->download_status === StageStatus::InProgress ? 'download' : 'upload');

            PipelineJobFile::where('id', $file->id)
                ->where('claim_token', $token)
                ->update([
                    'overall_status' => StageStatus::Error,
                    'error_stage' => $errorStage,
                    'error_message' => $e->getMessage(),
                    'completed_at' => now(),
                    'claim_token' => null,
                    'claim_expires_at' => null,
                ]);

            JobLogger::logPipeline($jobId, LogLevel::Error, "File processing failed: {$e->getMessage()}", $errorStage, $fileId, $fileName, $e->getMessage());

            return false;
        } finally {
            if (file_exists($tempPdfPath) && $file->fresh()?->overall_status === StageStatus::Success) {
                @unlink($tempPdfPath);
            }

            $this->finalizeParentPipelineJob($jobId);
        }
    }

    /**
     * Processes a single ToHTML section chunk with claim token validation.
     */
    public function processToHtmlChunk(ToHtmlJobChunk $chunk, ?string $expectedToken = null): bool
    {
        $job = $chunk->job;
        if (!$job) {
            return false;
        }

        $jobId = $job->id;
        $label = $chunk->label ?: $chunk->marker;
        $globalIndex = $chunk->global_index;
        $token = $expectedToken ?? $chunk->claim_token;
        if (empty($token)) {
            $token = (string) Str::uuid();
            $chunk->update([
                'claim_token' => $token,
                'claim_expires_at' => now()->addSeconds((int) config('automation.runner.lease_duration_seconds', 120)),
            ]);
        }

        JobLogger::logToHtml($jobId, LogLevel::Info, "Processing {$label} ({$chunk->line_count} lines, {$chunk->char_count} characters)...", $globalIndex, $chunk->marker);

        $startMs = microtime(true);

        try {
            $userPrompt = "Process the following section ({$label}):\n\n{$chunk->content}";
            $responseText = $this->deepseek->chat($job->prompt ?? '', $userPrompt);

            $filename = OutputStorage::buildToHtmlFilename($chunk->global_index, $chunk->marker, $chunk->chunk_number);
            OutputStorage::writeText($job->folder_name, $filename, $responseText);

            $durationMs = (int) round((microtime(true) - $startMs) * 1000);

            // Atomic status update guarded by claim_token
            $affected = ToHtmlJobChunk::where('id', $chunk->id)
                ->where('claim_token', $token)
                ->update([
                    'status' => ChunkStatus::Completed,
                    'output_filename' => $filename,
                    'response_text' => $responseText,
                    'duration_ms' => $durationMs,
                    'completed_at' => now(),
                    'heartbeat_at' => now(),
                    'claim_token' => null,
                    'claim_expires_at' => null,
                    'error_message' => null,
                ]);

            if ($affected === 0) {
                JobLogger::logToHtml($jobId, LogLevel::Warn, "Stale claim token rejected for section {$label}. The lease expired and another worker claimed this chunk.", $globalIndex, $chunk->marker);
                return false;
            }

            JobLogger::logToHtml($jobId, LogLevel::Info, "{$label} completed in {$durationMs}ms and saved to {$filename}.", $globalIndex, $chunk->marker);

            return true;
        } catch (Throwable $e) {
            $durationMs = (int) round((microtime(true) - $startMs) * 1000);
            $errorMsg = $e->getMessage();

            ToHtmlJobChunk::where('id', $chunk->id)
                ->where('claim_token', $token)
                ->update([
                    'status' => ChunkStatus::Failed,
                    'error_message' => $errorMsg,
                    'duration_ms' => $durationMs,
                    'completed_at' => now(),
                    'claim_token' => null,
                    'claim_expires_at' => null,
                ]);

            JobLogger::logToHtml($jobId, LogLevel::Error, "{$label} failed: {$errorMsg}", $globalIndex, $chunk->marker, $errorMsg);

            return false;
        } finally {
            $this->finalizeParentToHtmlJob($jobId);
        }
    }

    /**
     * Reclaims expired work leases abandoned by terminated processes.
     * Enforces terminal failure if a chunk or file exceeds maximum recovery attempts.
     */
    public function reconcileStaleClaims(): int
    {
        $recovered = 0;
        $maxChunkAttempts = (int) config('automation.runner.max_chunk_attempts', 3);

        // 1. Expired Drive file claims
        $staleFiles = PipelineJobFile::where('overall_status', StageStatus::InProgress)
            ->whereNotNull('claim_expires_at')
            ->where('claim_expires_at', '<', now())
            ->get();

        foreach ($staleFiles as $file) {
            $recovered++;
            $file->update([
                'overall_status' => StageStatus::Pending,
                'claim_token' => null,
                'claim_expires_at' => null,
            ]);
            JobLogger::logPipeline($file->pipeline_job_id, LogLevel::Warn, "Reclaimed abandoned lease for file {$file->file_name}", 'pipeline');
        }

        // 2. Expired ToHTML chunk claims
        $staleChunks = ToHtmlJobChunk::where('status', ChunkStatus::Processing)
            ->whereNotNull('claim_expires_at')
            ->where('claim_expires_at', '<', now())
            ->get();

        foreach ($staleChunks as $chunk) {
            $recovered++;
            if ($chunk->attempt_count >= $maxChunkAttempts) {
                $chunk->update([
                    'status' => ChunkStatus::Failed,
                    'error_message' => "Execution abandoned: exceeded maximum lease recovery attempts ({$maxChunkAttempts})",
                    'completed_at' => now(),
                    'claim_token' => null,
                    'claim_expires_at' => null,
                ]);
                JobLogger::logToHtml($chunk->tohtml_job_id, LogLevel::Error, "Chunk permanently failed after {$maxChunkAttempts} abandoned lease attempts", $chunk->global_index, $chunk->marker);
            } else {
                $chunk->update([
                    'status' => ChunkStatus::Pending,
                    'claim_token' => null,
                    'claim_expires_at' => null,
                ]);
                JobLogger::logToHtml($chunk->tohtml_job_id, LogLevel::Warn, "Reclaimed abandoned lease for section {$chunk->label}", $chunk->global_index, $chunk->marker);
            }
        }

        return $recovered;
    }

    private function finalizeParentPipelineJob(string $jobId): void
    {
        DB::transaction(function () use ($jobId) {
            $parent = PipelineJob::where('id', $jobId)->lockForUpdate()->first();
            if (!$parent) {
                return;
            }

            $remaining = PipelineJobFile::where('pipeline_job_id', $jobId)
                ->whereIn('overall_status', [StageStatus::Pending, StageStatus::InProgress])
                ->count();

            if ($remaining === 0) {
                $successCount = PipelineJobFile::where('pipeline_job_id', $jobId)
                    ->where('overall_status', StageStatus::Success)
                    ->count();

                $parent->update([
                    'status' => $successCount > 0 ? JobStatus::Completed : JobStatus::Failed,
                    'completed_at' => now(),
                ]);

                JobLogger::logPipeline($jobId, LogLevel::Info, "Pipeline completed for all {$parent->total_files} file(s)", 'pipeline');
            }
        }, 3);
    }

    private function finalizeParentToHtmlJob(string $jobId): void
    {
        DB::transaction(function () use ($jobId) {
            $parent = ToHtmlJob::where('id', $jobId)->lockForUpdate()->first();
            if (!$parent) {
                return;
            }

            $remaining = ToHtmlJobChunk::where('tohtml_job_id', $jobId)
                ->whereIn('status', [ChunkStatus::Pending, ChunkStatus::Processing])
                ->count();

            if ($remaining === 0) {
                $failed = ToHtmlJobChunk::where('tohtml_job_id', $jobId)
                    ->where('status', ChunkStatus::Failed)
                    ->count();

                $parent->update([
                    'status' => $failed === 0 ? JobStatus::Completed : ($failed === $parent->total_chunks ? JobStatus::Failed : JobStatus::Completed),
                    'completed_at' => now(),
                ]);
            }
        }, 3);
    }
}
