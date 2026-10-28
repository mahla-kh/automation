<?php

namespace App\Services\Support;

use Closure;
use Illuminate\Support\Facades\Log;
use Throwable;

class RetryPolicy
{
    /**
     * Executes a task with exponential backoff retry.
     */
    public static function run(
        Closure $task,
        int $retries = 3,
        int $delayMs = 2000,
        int $factor = 2,
        ?callable $shouldRetry = null
    ): mixed {
        $attempt = 1;
        $currentDelayMs = $delayMs;

        while (true) {
            try {
                return $task();
            } catch (Throwable $e) {
                if ($attempt >= $retries || ($shouldRetry !== null && !$shouldRetry($e))) {
                    throw $e;
                }

                Log::warning('Retry attempt failed', [
                    'attempt' => $attempt,
                    'retries' => $retries,
                    'delay_ms' => $currentDelayMs,
                    'error' => $e->getMessage(),
                ]);

                usleep($currentDelayMs * 1000);
                $currentDelayMs *= $factor;
                $attempt++;
            }
        }
    }

    /**
     * Checks if an exception represents a transient upstream error.
     */
    public static function isTransient(Throwable $e): bool
    {
        $message = $e->getMessage();

        return str_contains($message, 'ECONNRESET')
            || str_contains($message, 'UND_ERR_SOCKET')
            || str_contains($message, 'fetch failed')
            || str_contains($message, '429')
            || str_contains($message, '500')
            || str_contains($message, '503')
            || str_contains($message, 'RESOURCE_EXHAUSTED')
            || str_contains($message, 'UNAVAILABLE')
            || str_contains($message, 'DEADLINE_EXCEEDED');
    }
}
