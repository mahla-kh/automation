<?php

namespace App\Services\ToHtml;

use App\Enums\ChunkStatus;
use App\Enums\JobStatus;
use App\Enums\LogLevel;
use App\Jobs\ProcessToHtmlChunkJob;
use App\Models\ToHtmlJob;
use App\Models\ToHtmlJobChunk;
use App\Services\Storage\OutputStorage;
use App\Services\Support\JobLogger;
use App\Services\Support\LineSplitter;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

class ToHtmlService
{
    /**
     * Starts a ToHTML job by splitting sections into line-bounded chunks and queuing synthesis.
     */
    public function start(
        string $fileName,
        string $prompt,
        array $sections,
        ?int $maxLinesPerChunk = 600
    ): array {
        $fileName = trim($fileName);
        if ($fileName === '') {
            throw new InvalidArgumentException('fileName is required and must be a string');
        }

        $prompt = trim($prompt);
        if ($prompt === '') {
            throw new InvalidArgumentException('prompt is required and must not be empty');
        }

        if (empty($sections)) {
            throw new InvalidArgumentException('sections must be a non-empty array of parsed sections');
        }

        $maxLines = ($maxLinesPerChunk !== null && $maxLinesPerChunk > 0) ? $maxLinesPerChunk : 600;
        $baseName = pathinfo($fileName, PATHINFO_FILENAME) ?: 'tohtml';

        $createdJob = DB::transaction(function () use ($fileName, $baseName, $prompt, $maxLines, $sections) {
            $folderName = OutputStorage::resolveUniqueFolderName(
                "tohtml-{$baseName}",
                fn(string $candidate) => ToHtmlJob::where('folder_name', $candidate)->exists()
            );

            $chunkRecords = [];
            $globalIndex = 0;

            foreach ($sections as $sIdx => $sec) {
                $content = (string) ($sec['content'] ?? '');
                $marker = (string) ($sec['marker'] ?? 'CUT');
                $markerNumber = isset($sec['markerNumber']) ? (int) $sec['markerNumber'] : null;

                $rawChunks = LineSplitter::split($content, $maxLines);
                $chunks = !empty($rawChunks) ? $rawChunks : [$content];
                $totalChunks = count($chunks);

                foreach ($chunks as $cIdx => $chunkText) {
                    $chunkNumber = $cIdx + 1;
                    $label = $totalChunks > 1
                        ? "{$marker} — Chunk {$chunkNumber}/{$totalChunks}"
                        : "{$marker} — Chunk 1/1";

                    $lineCount = $chunkText !== '' ? count(preg_split('/\r?\n/', $chunkText)) : 0;

                    $chunkRecords[] = [
                        'global_index' => $globalIndex++,
                        'section_index' => $sIdx,
                        'chunk_index' => $cIdx,
                        'chunk_number' => $chunkNumber,
                        'chunks_in_section' => $totalChunks,
                        'marker' => $marker,
                        'marker_number' => $markerNumber,
                        'label' => $label,
                        'content' => $chunkText,
                        'char_count' => strlen($chunkText),
                        'line_count' => $lineCount,
                        'status' => ChunkStatus::Pending,
                    ];
                }
            }

            $job = ToHtmlJob::create([
                'file_name' => $fileName,
                'folder_name' => $folderName,
                'prompt' => $prompt,
                'max_lines_per_chunk' => $maxLines,
                'total_sections' => count($sections),
                'total_chunks' => count($chunkRecords),
                'status' => JobStatus::Processing,
                'started_at' => now(),
            ]);

            JobLogger::logToHtml($job->id, LogLevel::Info, "Job created with " . count($sections) . " section(s) split into " . count($chunkRecords) . " chunk(s) from \"{$fileName}\".");

            foreach ($chunkRecords as $record) {
                $record['tohtml_job_id'] = $job->id;
                ToHtmlJobChunk::create($record);
            }

            return $job;
        });

        // Dispatch chunk jobs after commit
        foreach ($createdJob->chunks as $chunk) {
            ProcessToHtmlChunkJob::dispatch($chunk->id)->afterCommit();
        }

        return [
            'success' => true,
            'jobId' => $createdJob->id,
            'totalChunks' => $createdJob->total_chunks,
            'totalSections' => $createdJob->total_sections,
            'fileName' => $createdJob->file_name,
        ];
    }

    /**
     * Lists summaries of all ToHTML jobs, optionally filtered by user ID.
     */
    public function listJobs(?int $userId = null): array
    {
        $query = ToHtmlJob::with('chunks')->orderByDesc('created_at');
        if ($userId !== null) {
            $query->where('user_id', $userId);
        }
        $jobs = $query->get();

        return $jobs->map(function (ToHtmlJob $j) {
            $completed = $j->chunks->where('status', ChunkStatus::Completed)->count();
            $failed = $j->chunks->where('status', ChunkStatus::Failed)->count();

            return [
                'id' => $j->id,
                'fileName' => $j->file_name,
                'status' => $j->status->value,
                'createdAt' => $j->created_at->toISOString(),
                'totalSections' => $j->chunks->count(),
                'completedSections' => $completed,
                'failedSections' => $failed,
            ];
        })->values()->all();
    }

    /**
     * Returns full status and chunk details for a specific ToHTML job.
     */
    public function status(string $id): ?array
    {
        $job = ToHtmlJob::with(['chunks', 'logs'])->find($id);
        if (!$job) {
            return null;
        }

        $completed = 0;
        $processing = 0;
        $failed = 0;
        $pending = 0;
        $totalDurationMs = 0;
        $durationCount = 0;

        $sections = $job->chunks->map(function (ToHtmlJobChunk $c) use (
            &$completed, &$processing, &$failed, &$pending, &$totalDurationMs, &$durationCount
        ) {
            if ($c->status === ChunkStatus::Completed) {
                $completed++;
                if ($c->duration_ms !== null) {
                    $totalDurationMs += $c->duration_ms;
                    $durationCount++;
                }
            } elseif ($c->status === ChunkStatus::Processing) {
                $processing++;
            } elseif ($c->status === ChunkStatus::Failed) {
                $failed++;
            } else {
                $pending++;
            }

            return [
                'id' => $c->id,
                'index' => $c->global_index,
                'sectionIndex' => $c->section_index,
                'marker' => $c->marker,
                'markerNumber' => $c->marker_number,
                'chunkIndex' => $c->chunk_index,
                'chunkNumber' => $c->chunk_number,
                'totalChunks' => $c->chunks_in_section,
                'label' => $c->label,
                'content' => $c->content,
                'charCount' => $c->char_count,
                'lineCount' => $c->line_count,
                'status' => $c->status->value,
                'outputFilename' => $c->output_filename,
                'durationMs' => $c->duration_ms,
                'error' => $c->error_message,
                'startedAt' => $c->started_at?->toISOString(),
                'completedAt' => $c->completed_at?->toISOString(),
            ];
        })->values()->all();

        $avgDurationMs = $durationCount > 0 ? (int) round($totalDurationMs / $durationCount) : 0;

        return [
            'id' => $job->id,
            'fileName' => $job->file_name,
            'folderName' => $job->folder_name,
            'prompt' => $job->prompt,
            'status' => $job->status->value,
            'createdAt' => $job->created_at->toISOString(),
            'startedAt' => $job->started_at?->toISOString(),
            'completedAt' => $job->completed_at?->toISOString(),
            'sections' => $sections,
            'logs' => $job->logs->map(fn($l) => [
                'id' => (string) $l->id,
                'timestamp' => $l->created_at?->toISOString() ?? now()->toISOString(),
                'level' => $l->level->value,
                'message' => $l->message,
                'sectionIndex' => $l->section_index,
                'marker' => $l->marker,
                'error' => $l->error,
            ])->values()->all(),
            'summary' => [
                'total' => count($sections),
                'completed' => $completed,
                'processing' => $processing,
                'failed' => $failed,
                'pending' => $pending,
                'avgDurationMs' => $avgDurationMs,
            ],
        ];
    }

    /**
     * Retries one specific chunk or all failed chunks in a job.
     */
    public function retry(string $jobId, ?int $sectionIndex = null): array
    {
        $job = ToHtmlJob::find($jobId);
        if (!$job) {
            throw new RuntimeException("Job not found: {$jobId}", 404);
        }

        $chunksToRetry = DB::transaction(function () use ($job, $sectionIndex) {
            $query = ToHtmlJobChunk::where('tohtml_job_id', $job->id);

            if ($sectionIndex !== null) {
                if ($sectionIndex < 0 || $sectionIndex >= $job->total_chunks) {
                    throw new InvalidArgumentException("Invalid sectionIndex: {$sectionIndex}");
                }
                $query->where('global_index', $sectionIndex);
            } else {
                $query->where('status', ChunkStatus::Failed);
            }

            $chunks = $query->get();

            foreach ($chunks as $chunk) {
                $chunk->update([
                    'status' => ChunkStatus::Pending,
                    'error_message' => null,
                ]);
            }

            $job->update(['status' => JobStatus::Processing]);
            return $chunks;
        });

        foreach ($chunksToRetry as $chunk) {
            ProcessToHtmlChunkJob::dispatch($chunk->id)->afterCommit();
        }

        return [
            'success' => true,
            'jobId' => $jobId,
            'sectionIndex' => $sectionIndex !== null ? $sectionIndex : 'all_failed',
        ];
    }

    /**
     * Resolves individual or merged booklet text for download.
     */
    public function download(
        string $jobId,
        ?int $sectionIndex = null,
        ?string $filename = null,
        bool $isMerged = false
    ): array {
        $job = ToHtmlJob::with('chunks')->find($jobId);
        if (!$job) {
            throw new RuntimeException("Job not found: {$jobId}", 404);
        }

        if ($isMerged) {
            $completedChunks = $job->chunks->filter(fn(ToHtmlJobChunk $c) => $c->status === ChunkStatus::Completed)->values();

            if ($completedChunks->isEmpty()) {
                throw new RuntimeException('No completed section output files available to merge', 400);
            }

            $contents = [];
            foreach ($completedChunks as $c) {
                $text = $c->response_text ?? ($c->output_filename ? OutputStorage::readText($job->folder_name, $c->output_filename) : null);
                if ($text !== null) {
                    $bannerLabel = $c->label ?: $c->marker;
                    $contents[] = "========================================\n{$bannerLabel}\n========================================\n\n{$text}";
                }
            }

            $mergedText = implode("\n\n\n", $contents);
            $baseFilename = pathinfo($job->file_name, PATHINFO_FILENAME) ?: 'job';
            $downloadName = "{$baseFilename}-merged.txt";

            return [
                'content' => $mergedText,
                'downloadName' => $downloadName,
            ];
        }

        // Single chunk download
        $targetChunk = null;
        if ($sectionIndex !== null) {
            $targetChunk = $job->chunks->firstWhere('global_index', $sectionIndex);
        } elseif ($filename) {
            $targetChunk = $job->chunks->firstWhere('output_filename', $filename);
        }

        if (!$targetChunk) {
            throw new RuntimeException('Either sectionIndex or filename must be provided', 400);
        }

        if ($targetChunk->status !== ChunkStatus::Completed) {
            $label = $targetChunk->label ?: $targetChunk->marker;
            throw new RuntimeException("Section {$label} is not completed yet", 400);
        }

        $text = $targetChunk->response_text ?? ($targetChunk->output_filename ? OutputStorage::readText($job->folder_name, $targetChunk->output_filename) : null);

        if ($text === null) {
            throw new RuntimeException("Output file not found: " . ($targetChunk->output_filename ?: 'section.txt'), 404);
        }

        $downloadName = $targetChunk->output_filename ?: 'section.txt';
        return [
            'content' => $text,
            'downloadName' => $downloadName,
        ];
    }
}
