<?php

namespace App\Exceptions;

use RuntimeException;
use Throwable;

class UpstreamApiException extends RuntimeException
{
    public function __construct(
        string $serviceName,
        string $message,
        public readonly int $statusCode = 500,
        ?Throwable $previous = null
    ) {
        parent::__construct("[{$serviceName}] {$message}", $statusCode, $previous);
    }
}
