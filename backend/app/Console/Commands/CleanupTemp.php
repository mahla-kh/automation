<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CleanupTemp extends Command
{
    protected $signature = 'automation:cleanup-temp';
    protected $description = 'Cleans up orphaned PDF files in storage/app/temp older than 24 hours';

    public function handle(): int
    {
        $tempDir = storage_path('app/temp');
        if (!is_dir($tempDir)) {
            return self::SUCCESS;
        }

        $files = glob("{$tempDir}/*.pdf");
        $cutoff = time() - 86400; // 24 hours
        $deleted = 0;

        foreach ($files as $file) {
            if (is_file($file) && filemtime($file) < $cutoff) {
                @unlink($file);
                $deleted++;
            }
        }

        $this->info("Cleaned up {$deleted} temporary file(s).");
        return self::SUCCESS;
    }
}
