<?php

namespace App\Exceptions;

use RuntimeException;

class TruncatedOutputException extends RuntimeException
{
    public function __construct(string $message = "DeepSeek response truncated — increase max_tokens or reduce chunk size")
    {
        parent::__construct($message);
    }
}
