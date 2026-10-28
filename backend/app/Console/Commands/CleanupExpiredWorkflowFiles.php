<?php

namespace App\Console\Commands;

use App\Models\WorkflowProcess;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class CleanupExpiredWorkflowFiles extends Command
{
    protected $signature = 'automation:cleanup-expired';
    protected $description = 'Purges generated files for completed workflow processes older than 2 days';

    public function handle(): int
    {
        $now = Carbon::now();

        $expiredProcesses = WorkflowProcess::where('status', 'completed')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', $now)
            ->whereNull('files_purged_at')
            ->get();

        $count = 0;

        foreach ($expiredProcesses as $process) {
            $id = $process->id;

            // Safe path checks: must match UUID and reside within process directories
            $privateDir = storage_path("app/private/processes/{$id}");
            $basePrivateDir = realpath(storage_path('app/private/processes'));

            if (is_dir($privateDir)) {
                $realPrivate = realpath($privateDir);
                if ($realPrivate && $basePrivateDir && str_starts_with($realPrivate, $basePrivateDir)) {
                    File::deleteDirectory($realPrivate);
                }
            }

            $outputsDir = base_path("outputs/processes/{$id}");
            $baseOutputsDir = realpath(base_path('outputs/processes'));

            if (is_dir($outputsDir)) {
                $realOutputs = realpath($outputsDir);
                if ($realOutputs && $baseOutputsDir && str_starts_with($realOutputs, $baseOutputsDir)) {
                    File::deleteDirectory($realOutputs);
                }
            }

            $process->files_purged_at = $now;
            $process->save();

            $count++;
            $this->info("Purged files for expired process: {$process->name} ({$id})");
        }

        $this->info("Completed cleanup: {$count} expired process(es) purged.");
        return self::SUCCESS;
    }
}
