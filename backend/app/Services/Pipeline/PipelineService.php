<?php

namespace App\Services\Pipeline;

use App\Enums\JobStatus;
use App\Enums\LogLevel;
use App\Enums\StageStatus;
use App\Jobs\ProcessDriveFileJob;
use App\Models\PipelineJob;
use App\Models\PipelineJobFile;
use App\Services\Drive\DriveGateway;
use App\Services\Storage\OutputStorage;
use App\Services\Support\FolderUrlParser;
use App\Services\Support\JobLogger;
use App\Services\Support\NaturalSorter;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

class PipelineService
{
    public function __construct(
        private readonly DriveGateway $drive
    ) {}

    /**
     * Starts a pipeline job for a Google Drive folder.
     */
    public function start(string $folderUrl): array
    {
        $folderId = FolderUrlParser::extractFolderId($folderUrl);
        if (!$folderId) {
            throw new InvalidArgumentException('Invalid Google Drive folder URL');
        }

        $files = $this->drive->listPdfs($folderId);

        $job = DB::transaction(function () use ($folderId, $folderUrl, $files) {
            $pipelineJob = PipelineJob::create([
                'folder_id' => $folderId,
                'folder_url' => $folderUrl,
                'status' => JobStatus::Processing,
                'total_files' => count($files),
                'started_at' => now(),
            ]);

            JobLogger::logPipeline($pipelineJob->id, LogLevel::Info, "Job initialized with " . count($files) . " file(s).", 'pipeline');

            foreach ($files as $index => $file) {
                PipelineJobFile::create([
                    'pipeline_job_id' => $pipelineJob->id,
                    'drive_file_id' => $file['id'],
                    'file_name' => $file['name'],
                    'position' => $index,
                    'download_status' => StageStatus::Pending,
                    'upload_status' => StageStatus::Pending,
                    'ocr_status' => StageStatus::Pending,
                    'overall_status' => StageStatus::Pending,
                ]);
            }

            return $pipelineJob;
        });

        // Dispatch background jobs after commit
        foreach ($job->files as $fileRecord) {
            ProcessDriveFileJob::dispatch($fileRecord->id)->afterCommit();
        }

        return [
            'success' => true,
            'jobId' => $job->id,
            'totalFiles' => $job->total_files,
        ];
    }

    /**
     * Lists summaries of all pipeline jobs, optionally filtered by user ID.
     */
    public function listJobs(?int $userId = null): array
    {
        $query = PipelineJob::orderByDesc('created_at');
        if ($userId !== null) {
            $query->where('user_id', $userId);
        }
        $jobs = $query->get();

        return $jobs->map(fn(PipelineJob $j) => [
            'id' => $j->id,
            'status' => $j->status->value,
            'createdAt' => $j->created_at->toISOString(),
            'totalFiles' => $j->total_files,
        ])->values()->all();
    }

    /**
     * Returns full status and metrics for a specific pipeline job.
     */
    public function status(string $id): ?array
    {
        $job = PipelineJob::with(['files', 'logs'])->find($id);
        if (!$job) {
            return null;
        }

        $files = $job->files;
        $total = $files->count();
        $completed = 0;
        $processing = 0;
        $failed = 0;
        $pending = 0;
        $ocrSuccessCount = 0;
        $ocrErrorCount = 0;
        $totalOcrDuration = 0;
        $ocrDurationCount = 0;

        $fileList = $files->map(function (PipelineJobFile $f) use (
            &$completed, &$processing, &$failed, &$pending,
            &$ocrSuccessCount, &$ocrErrorCount, &$totalOcrDuration, &$ocrDurationCount
        ) {
            if ($f->overall_status === StageStatus::Success) $completed++;
            elseif ($f->overall_status === StageStatus::InProgress) $processing++;
            elseif ($f->overall_status === StageStatus::Error) $failed++;
            else $pending++;

            if ($f->ocr_status === StageStatus::Success) {
                $ocrSuccessCount++;
                if ($f->ocr_ms !== null) {
                    $totalOcrDuration += $f->ocr_ms;
                    $ocrDurationCount++;
                }
            } elseif ($f->ocr_status === StageStatus::Error) {
                $ocrErrorCount++;
            }

            return [
                'fileId' => $f->drive_file_id,
                'fileName' => $f->file_name,
                'download' => [
                    'status' => $f->download_status->value,
                    'durationMs' => $f->download_ms,
                ],
                'upload' => [
                    'status' => $f->upload_status->value,
                    'durationMs' => $f->upload_ms,
                ],
                'ocr' => [
                    'status' => $f->ocr_status->value,
                    'durationMs' => $f->ocr_ms,
                ],
                'overallStatus' => $f->overall_status->value,
                'startedAt' => $f->started_at?->toISOString(),
                'completedAt' => $f->completed_at?->toISOString(),
                'outputFilename' => $f->output_filename,
                'outputPath' => $f->output_path,
            ];
        })->values()->all();

        $ocrSuccessRate = $total > 0 ? (int) round(($ocrSuccessCount / $total) * 100) : 0;
        $ocrErrorRate = $total > 0 ? (int) round(($ocrErrorCount / $total) * 100) : 0;
        $avgOcrDurationMs = $ocrDurationCount > 0 ? (int) round($totalOcrDuration / $ocrDurationCount) : 0;

        return [
            'id' => $job->id,
            'status' => $job->status->value,
            'createdAt' => $job->created_at->toISOString(),
            'files' => $fileList,
            'logs' => $job->logs->map(fn($l) => [
                'id' => (string) $l->id,
                'timestamp' => $l->created_at?->toISOString() ?? now()->toISOString(),
                'level' => $l->level->value,
                'message' => $l->message,
                'stage' => $l->stage,
                'fileId' => $l->file_id,
                'fileName' => $l->file_name,
                'error' => $l->error,
            ])->values()->all(),
            'summary' => [
                'total' => $total,
                'completed' => $completed,
                'processing' => $processing,
                'failed' => $failed,
                'pending' => $pending,
                'ocrSuccessRate' => $ocrSuccessRate,
                'ocrErrorRate' => $ocrErrorRate,
                'avgOcrDurationMs' => $avgOcrDurationMs,
            ],
        ];
    }

    /**
     * Resolves file content and headers for download.
     */
    public function download(string $jobId, string $fileId): array
    {
        $job = PipelineJob::find($jobId);
        if (!$job) {
            throw new RuntimeException("Job not found: {$jobId}", 404);
        }

        $file = PipelineJobFile::where('pipeline_job_id', $jobId)
            ->where('drive_file_id', $fileId)
            ->first();

        if (!$file) {
            throw new RuntimeException("File not found in job: {$fileId}", 404);
        }

        if ($file->overall_status !== StageStatus::Success && $file->upload_status !== StageStatus::Success) {
            throw new RuntimeException("OCR output is not ready yet for file: {$file->file_name}", 400);
        }

        $baseName = pathinfo($file->file_name, PATHINFO_FILENAME);
        $folderName = OutputStorage::sanitizeFolderName($baseName);
        $content = OutputStorage::readText($folderName, 'result.txt');

        if ($content === null && $file->result) {
            $content = $file->result;
            OutputStorage::writeText($folderName, 'result.txt', $content);
        }

        if ($content === null) {
            throw new RuntimeException("Output file not found for file: {$file->file_name}", 404);
        }

        $downloadName = $file->output_filename ?: "{$baseName}_result.txt";
        return [
            'content' => $content,
            'downloadName' => $downloadName,
        ];
    }

    /**
     * Merges all completed files for a pipeline job.
     */
    public function merge(string $jobId): array
    {
        $job = PipelineJob::with('files')->find($jobId);
        if (!$job) {
            throw new RuntimeException("Job not found: {$jobId}", 404);
        }

        $succeededFiles = $job->files->filter(fn(PipelineJobFile $f) => $f->overall_status === StageStatus::Success)->values()->all();

        if (empty($succeededFiles)) {
            throw new RuntimeException("No completed files to merge yet", 400);
        }

        // Natural sort by filename
        NaturalSorter::sort($succeededFiles, fn(PipelineJobFile $f) => $f->file_name);

        $parts = [];
        $missing = [];

        foreach ($succeededFiles as $f) {
            $baseName = pathinfo($f->file_name, PATHINFO_FILENAME);
            $folderName = OutputStorage::sanitizeFolderName($baseName);
            $text = OutputStorage::readText($folderName, 'result.txt') ?? $f->result;

            if ($text === null) {
                $missing[] = $f->file_name;
                continue;
            }

            $parts[] = "===== {$f->file_name} =====\n\n" . trim($text);
        }

        if (!empty($missing)) {
            throw new RuntimeException("Result file missing on disk for: " . implode(', ', $missing), 404);
        }

        $mergedText = implode("\n\n\n", $parts);
        $downloadName = 'merged_' . substr($jobId, 0, 8) . '.txt';

        return [
            'content' => $mergedText,
            'downloadName' => $downloadName,
        ];
    }
}
