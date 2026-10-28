<?php

namespace App\Console\Commands;

use App\Services\Queue\SharedHostRunner;
use Illuminate\Console\Command;

class ProcessSharedHostQueue extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'automation:process
                            {--max-time= : Maximum execution time in seconds (default from config)}
                            {--max-units= : Maximum units of work to process (default from config)}
                            {--queue=all : Specific queue to process (all, drive-ocr, deepseek)}';

    /**
     * The console command description.
     */
    protected $description = 'Executes a bounded batch of Drive OCR or DeepSeek units and exits cleanly for shared hosting cron';

    /**
     * Execute the console command.
     */
    public function handle(SharedHostRunner $runner): int
    {
        $maxTime = $this->option('max-time') ? (int) $this->option('max-time') : null;
        $maxUnits = $this->option('max-units') ? (int) $this->option('max-units') : null;
        $queue = (string) ($this->option('queue') ?: 'all');

        $this->info("Starting shared-host worker run (queue: {$queue})...");

        $result = $runner->run($maxTime, $maxUnits, $queue);

        $this->info(sprintf(
            'Worker finished in %dms. Processed: %d, Failed: %d, Recovered: %d. %s',
            $result['duration_ms'],
            $result['processed'],
            $result['failed'],
            $result['recovered'],
            $result['timed_out'] ? '(Budget limit reached, exited cleanly)' : '(No more pending work)'
        ));

        return self::SUCCESS;
    }
}
