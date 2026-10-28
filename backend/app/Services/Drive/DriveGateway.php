<?php

namespace App\Services\Drive;

interface DriveGateway
{
    /**
     * Lists PDF files in a Google Drive folder.
     *
     * @return array<int, array{id: string, name: string}>
     */
    public function listPdfs(string $folderId): array;

    /**
     * Downloads a file from Drive and saves it to a local temporary path.
     *
     * @return string Full path to local temporary PDF file.
     */
    public function download(string $fileId, string $destinationPath): string;
}
