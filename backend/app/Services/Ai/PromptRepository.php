<?php

namespace App\Services\Ai;

use RuntimeException;

class PromptRepository
{
    public function getOcrPrompt(): string
    {
        $path = resource_path('prompts/ocr.txt');
        if (!file_exists($path)) {
            throw new RuntimeException("OCR prompt file missing at: {$path}");
        }
        return file_get_contents($path);
    }

    public function getToHtmlDefaultPrompt(): string
    {
        $path = resource_path('prompts/tohtml-default.txt');
        if (!file_exists($path)) {
            throw new RuntimeException("ToHTML default prompt file missing at: {$path}");
        }
        return file_get_contents($path);
    }
}
