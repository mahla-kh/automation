<?php

namespace App\Jobs;

use App\Models\PipelineJobFile;
use App\Services\Queue\SharedHostRunner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessDriveFileJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 180;

    public function __construct(
        public readonly string $fileRecordId
    ) {
        $this->onQueue('drive-ocr');
    }

    public function handle(SharedHostRunner $runner): void
    {
        $file = PipelineJobFile::find($this->fileRecordId);
        if (!$file) {
            return;
        }

        $runner->processDriveFile($file);
    }
}
