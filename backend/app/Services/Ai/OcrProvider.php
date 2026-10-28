<?php

namespace App\Services\Ai;

interface OcrProvider
{
    /**
     * Extracts text from a document file using OCR.
     */
    public function extract(string $filePath, string $fileName): string;
}
