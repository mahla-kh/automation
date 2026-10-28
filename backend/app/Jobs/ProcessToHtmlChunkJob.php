<?php

namespace App\Jobs;

use App\Models\ToHtmlJobChunk;
use App\Services\Queue\SharedHostRunner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessToHtmlChunkJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 300;

    public function __construct(
        public readonly string $chunkId
    ) {
        $this->onQueue('deepseek');
    }

    public function handle(SharedHostRunner $runner): void
    {
        $chunk = ToHtmlJobChunk::find($this->chunkId);
        if (!$chunk) {
            return;
        }

        $runner->processToHtmlChunk($chunk);
    }
}
