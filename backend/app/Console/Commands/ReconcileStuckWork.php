<?php

namespace App\Console\Commands;

use App\Enums\ChunkStatus;
use App\Enums\JobStatus;
use App\Enums\LogLevel;
use App\Enums\StageStatus;
use App\Models\PipelineJob;
use App\Models\PipelineJobFile;
use App\Models\ToHtmlJob;
use App\Models\ToHtmlJobChunk;
use App\Services\Support\JobLogger;
use Illuminate\Console\Command;

class ReconcileStuckWork extends Command
{
    protected $signature = 'automation:reconcile-stuck';
    protected $description = 'Reconciles stuck background pipeline files and ToHTML chunks whose workers died';

    public function handle(): int
    {
        $this->info('Checking for stuck background work...');

        $staleThreshold = (int) config('automation.runner.stale_threshold_seconds', 180);

        // Pipeline files stuck longer than threshold without heartbeat or with expired claim
        $stuckFiles = PipelineJobFile::where('overall_status', StageStatus::InProgress)
            ->where(function ($query) use ($staleThreshold) {
                $cutoff = now()->subSeconds($staleThreshold);
                $query->where('heartbeat_at', '<', $cutoff)
                    ->orWhere(fn($q) => $q->whereNull('heartbeat_at')->where('started_at', '<', $cutoff))
                    ->orWhere(fn($q) => $q->whereNotNull('claim_expires_at')->where('claim_expires_at', '<', now()));
            })->get();

        foreach ($stuckFiles as $file) {
            $this->warn("Reconciling stuck pipeline file: {$file->file_name} (Job: {$file->pipeline_job_id})");

            $file->update([
                'overall_status' => StageStatus::Error,
                'error_message' => 'worker lost — execution timed out or worker process terminated',
                'completed_at' => now(),
                'claim_token' => null,
                'claim_expires_at' => null,
            ]);

            JobLogger::logPipeline(
                $file->pipeline_job_id,
                LogLevel::Error,
                "Worker lost while processing file {$file->file_name}",
                'pipeline',
                $file->drive_file_id,
                $file->file_name,
                'worker lost'
            );
        }

        // ToHTML chunks stuck longer than threshold without heartbeat or with expired claim
        $stuckChunks = ToHtmlJobChunk::where('status', ChunkStatus::Processing)
            ->where(function ($query) use ($staleThreshold) {
                $cutoff = now()->subSeconds($staleThreshold);
                $query->where('heartbeat_at', '<', $cutoff)
                    ->orWhere(fn($q) => $q->whereNull('heartbeat_at')->where('started_at', '<', $cutoff))
                    ->orWhere(fn($q) => $q->whereNotNull('claim_expires_at')->where('claim_expires_at', '<', now()));
            })->get();

        foreach ($stuckChunks as $chunk) {
            $this->warn("Reconciling stuck ToHTML chunk: {$chunk->label} (Job: {$chunk->tohtml_job_id})");

            $chunk->update([
                'status' => ChunkStatus::Failed,
                'error_message' => 'worker lost — execution timed out or worker process terminated',
                'completed_at' => now(),
                'claim_token' => null,
                'claim_expires_at' => null,
            ]);

            JobLogger::logToHtml(
                $chunk->tohtml_job_id,
                LogLevel::Error,
                "Worker lost while processing section chunk {$chunk->label}",
                $chunk->global_index,
                $chunk->marker,
                'worker lost'
            );
        }

        return self::SUCCESS;
    }
}
