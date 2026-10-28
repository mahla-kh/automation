<?php

namespace App\Services\Support;

use App\Enums\LogLevel;
use App\Models\JobLog;
use Illuminate\Support\Facades\Log;

class JobLogger
{
    public static function logPipeline(
        string $jobId,
        LogLevel $level,
        string $message,
        ?string $stage = null,
        ?string $fileId = null,
        ?string $fileName = null,
        ?string $error = null
    ): void {
        JobLog::create([
            'pipeline_job_id' => $jobId,
            'level' => $level,
            'stage' => $stage,
            'file_id' => $fileId,
            'file_name' => $fileName,
            'message' => $message,
            'error' => $error,
            'created_at' => now(),
        ]);

        self::mirror($level, "[Pipeline:{$jobId}] {$message}", [
            'fileId' => $fileId,
            'fileName' => $fileName,
            'error' => $error,
        ]);
    }

    public static function logToHtml(
        string $jobId,
        LogLevel $level,
        string $message,
        ?int $sectionIndex = null,
        ?string $marker = null,
        ?string $error = null
    ): void {
        JobLog::create([
            'tohtml_job_id' => $jobId,
            'level' => $level,
            'section_index' => $sectionIndex,
            'marker' => $marker,
            'message' => $message,
            'error' => $error,
            'created_at' => now(),
        ]);

        self::mirror($level, "[ToHTML:{$jobId}] {$message}", [
            'sectionIndex' => $sectionIndex,
            'marker' => $marker,
            'error' => $error,
        ]);
    }

    private static function mirror(LogLevel $level, string $message, array $context): void
    {
        match ($level) {
            LogLevel::Debug => Log::debug($message, $context),
            LogLevel::Info => Log::info($message, $context),
            LogLevel::Warn => Log::warning($message, $context),
            LogLevel::Error => Log::error($message, $context),
        };
    }
}
