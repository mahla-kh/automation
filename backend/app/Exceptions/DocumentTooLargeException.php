<?php

namespace App\Exceptions;

use RuntimeException;

class DocumentTooLargeException extends RuntimeException
{
    public function __construct(string $message = "Gemini OCR response truncated — document too large for a single response")
    {
        parent::__construct($message);
    }
}
