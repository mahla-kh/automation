<?php

namespace App\Services\Support;

class FolderUrlParser
{
    /**
     * Extracts Google Drive folder ID from various URL formats or raw folder ID.
     */
    public static function extractFolderId(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }

        if (preg_match('/folders\/([a-zA-Z0-9_-]+)/', $url, $matches)) {
            return $matches[1];
        }

        // Fallback: take the last non-empty path segment before query parameters
        $cleanPath = explode('?', $url)[0];
        $segments = array_values(array_filter(explode('/', $cleanPath), fn($s) => $s !== ''));

        if (!empty($segments)) {
            $last = end($segments);
            if (preg_match('/^[a-zA-Z0-9_-]+$/', $last)) {
                return $last;
            }
        }

        return null;
    }
}
