<?php

namespace App\Services\Storage;

use RuntimeException;

class OutputStorage
{
    /**
     * Base directory for all job outputs.
     */
    public static function getOutputsRoot(): string
    {
        $configured = config('filesystems.disks.outputs.root');
        if ($configured) {
            return $configured;
        }

        $projectRoot = dirname(base_path());
        return $projectRoot . DIRECTORY_SEPARATOR . 'outputs';
    }

    /**
     * Sanitizes a folder name for safe filesystem usage while preserving UTF-8 / Persian text.
     */
    public static function sanitizeFolderName(string $name): string
    {
        $name = trim($name);
        if ($name === '') {
            return 'responses';
        }

        // Replace filesystem illegal chars / slashes with hyphen
        $sanitized = preg_replace('/[\/\\\\?%*:|"<>]/u', '-', $name);
        // Replace dots (prevents ../ or ./)
        $sanitized = preg_replace('/\.+/u', '-', $sanitized);
        // Replace whitespace with hyphens
        $sanitized = preg_replace('/\s+/u', '-', $sanitized);
        // Collapse consecutive hyphens
        $sanitized = preg_replace('/-+/u', '-', $sanitized);
        // Trim leading and trailing hyphens
        $sanitized = trim($sanitized, '-');

        return $sanitized !== '' ? $sanitized : 'responses';
    }

    /**
     * Resolves a collision-safe folder name under OUTPUTS_ROOT (e.g. tohtml-booklet, tohtml-booklet-2).
     */
    public static function resolveUniqueFolderName(string $rawName, ?callable $isAllocatedInMemory = null): string
    {
        $base = self::sanitizeFolderName($rawName);
        $candidate = $base;
        $counter = 2;
        $root = self::getOutputsRoot();

        $exists = function (string $name) use ($root, $isAllocatedInMemory): bool {
            $fullPath = $root . DIRECTORY_SEPARATOR . $name;
            $onDisk = file_exists($fullPath);
            $inMemory = $isAllocatedInMemory !== null ? $isAllocatedInMemory($name) : false;
            return $onDisk || $inMemory;
        };

        while ($exists($candidate)) {
            $candidate = "{$base}-{$counter}";
            $counter++;
        }

        return $candidate;
    }

    /**
     * Builds deterministic response filename:
     * 0001-CUT-1-chunk-1.txt, 0002-CUT-1-chunk-2.txt, etc.
     */
    public static function buildToHtmlFilename(int $index, string $marker, int $chunkNumber = 1): string
    {
        $prefix = str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT);
        $safeMarker = preg_replace('/[^a-zA-Z0-9_-]/', '', preg_replace('/\s+/', '-', trim($marker)));
        return "{$prefix}-{$safeMarker}-chunk-{$chunkNumber}.txt";
    }

    /**
     * Resolves a job's output file path safely, preventing directory traversal.
     */
    public static function getJobOutputPath(string $folderName, string $filename): string
    {
        $root = self::getOutputsRoot();
        $safeFolder = self::sanitizeFolderName($folderName);
        $targetDir = $root . DIRECTORY_SEPARATOR . $safeFolder;
        $candidate = $targetDir . DIRECTORY_SEPARATOR . basename($filename);

        $realRoot = realpath($root) ?: $root;
        $realDir = realpath($targetDir) ?: $targetDir;

        // Verify directory stays inside root
        if (!str_starts_with($realDir, $realRoot)) {
            throw new RuntimeException('Invalid output directory: path traversal detected');
        }

        return $candidate;
    }

    /**
     * Atomically writes output text to disk using temporary file + rename.
     */
    public static function writeText(string $folderName, string $filename, string $content): string
    {
        $root = self::getOutputsRoot();
        $safeFolder = self::sanitizeFolderName($folderName);
        $targetDir = $root . DIRECTORY_SEPARATOR . $safeFolder;

        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0755, true);
        }

        $targetPath = $targetDir . DIRECTORY_SEPARATOR . basename($filename);
        $tempPath = $targetDir . DIRECTORY_SEPARATOR . uniqid('.tmp_', true);

        file_put_contents($tempPath, $content);
        rename($tempPath, $targetPath);

        return $targetPath;
    }

    /**
     * Reads text from an output file with path traversal security check.
     */
    public static function readText(string $folderName, string $filename): ?string
    {
        $filePath = self::getJobOutputPath($folderName, $filename);
        if (!file_exists($filePath)) {
            return null;
        }

        return file_get_contents($filePath);
    }
}
