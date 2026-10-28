<?php

return [
    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),
        'min_interval_ms' => (int) env('GEMINI_MIN_INTERVAL_MS', 10000),
        'timeout_ms' => (int) env('GEMINI_TIMEOUT_MS', 900000),
        'thinking_budget' => env('GEMINI_THINKING_BUDGET') !== null && env('GEMINI_THINKING_BUDGET') !== ''
            ? (int) env('GEMINI_THINKING_BUDGET')
            : null,
        'upload_poll_interval_ms' => 2000,
        'upload_max_wait_ms' => 120000,
        'retries' => 5,
        'retry_delay_ms' => 5000,
        'retry_factor' => 2,
    ],

    'deepseek' => [
        'api_key' => env('DEEPSEEK_API_KEY', 'dummy-key'),
        'base_url' => env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
        'model' => env('DEEPSEEK_MODEL', 'deepseek-chat'),
        'max_tokens' => (int) env('DEEPSEEK_MAX_TOKENS', 8192),
        'retries' => 3,
        'retry_delay_ms' => 2000,
        'retry_factor' => 2,
    ],

    'google' => [
        'client_email' => env('GOOGLE_CLIENT_EMAIL'),
        'private_key' => env('GOOGLE_PRIVATE_KEY'),
    ],

    'pipeline' => [
        'concurrency' => 1,
        'job_timeout_seconds' => 1500,
    ],

    'tohtml' => [
        'concurrency' => 2,
        'default_max_lines' => 600,
        'chunk_timeout_seconds' => 900,
    ],

    'retry' => [
        'default_retries' => 3,
        'default_delay_ms' => 2000,
        'default_factor' => 2,
    ],

    'storage' => [
        'outputs_disk' => 'outputs',
        'temp_disk' => 'temp',
    ],

    'runner' => [
        'max_execution_time' => (int) env('SHARED_HOST_RUNNER_MAX_TIME', 50),
        'safety_buffer_seconds' => (int) env('SHARED_HOST_SAFETY_BUFFER', 10),
        'max_units_per_run' => (int) env('SHARED_HOST_MAX_UNITS_PER_RUN', 10),
        'lease_duration_seconds' => (int) env('SHARED_HOST_LEASE_DURATION', 120),
        'stale_threshold_seconds' => (int) env('SHARED_HOST_STALE_THRESHOLD', 180),
        'gemini_timeout_seconds' => (int) env('SHARED_HOST_GEMINI_TIMEOUT', 60),
        'deepseek_timeout_seconds' => (int) env('DEEPSEEK_TIMEOUT', env('SHARED_HOST_DEEPSEEK_TIMEOUT', 180)),
        'drive_timeout_seconds' => (int) env('SHARED_HOST_DRIVE_TIMEOUT', 60),
        'deepseek_unit_buffer' => (int) env('SHARED_HOST_DEEPSEEK_UNIT_BUFFER', 35),
        'drive_unit_buffer' => (int) env('SHARED_HOST_DRIVE_UNIT_BUFFER', 45),
        'http_retries' => (int) env('SHARED_HOST_HTTP_RETRIES', 1),
        'max_chunk_attempts' => (int) env('SHARED_HOST_MAX_CHUNK_ATTEMPTS', 3),
        'max_file_attempts' => (int) env('SHARED_HOST_MAX_FILE_ATTEMPTS', 3),
    ],
];
