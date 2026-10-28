<?php

namespace App\Services\Support;

class LineSplitter
{
    /**
     * Splits text into line-based chunks of up to maxLines per chunk.
     * Preserves line order, text content, and normalizes line endings to \n.
     * Matches the TypeScript splitByLines implementation byte-for-byte.
     *
     * @return string[]
     */
    public static function split(string $text, int $maxLines = 600): array
    {
        if ($text === '') {
            return [];
        }

        $lines = preg_split('/\r?\n/', $text);
        if ($lines === false) {
            return [];
        }

        $chunks = [];
        $totalLines = count($lines);

        for ($i = 0; $i < $totalLines; $i += $maxLines) {
            $slice = array_slice($lines, $i, $maxLines);
            $chunks[] = implode("\n", $slice);
        }

        return $chunks;
    }
}
