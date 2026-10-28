<?php

namespace App\Services\Ai;

use Illuminate\Support\Facades\Cache;

class GeminiPacer
{
    /**
     * Blocks execution until the minimum interval has elapsed since the last Gemini API call.
     * Uses atomic Cache::lock to coordinate pacing safely across processes.
     */
    public static function pace(): void
    {
        $minIntervalMs = (int) config('automation.gemini.min_interval_ms', 10000);
        if ($minIntervalMs <= 0) {
            return;
        }

        $lock = Cache::lock('gemini-pace-lock', 60);

        try {
            $lock->block(120);

            $lastStartAt = (int) Cache::get('gemini_last_call_at', 0);
            $nowMs = (int) (microtime(true) * 1000);
            $waitMs = ($lastStartAt + $minIntervalMs) - $nowMs;

            if ($waitMs > 0) {
                usleep($waitMs * 1000);
            }

            Cache::put('gemini_last_call_at', (int) (microtime(true) * 1000), 300);
        } finally {
            $lock->release();
        }
    }
}
