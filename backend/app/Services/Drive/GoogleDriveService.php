<?php

namespace App\Services\Drive;

use App\Exceptions\UpstreamApiException;
use App\Services\Support\RetryPolicy;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class GoogleDriveService implements DriveGateway
{
    private string $clientEmail;
    private string $privateKey;

    public function __construct()
    {
        $this->clientEmail = config('services.google.client_email') ?? '';
        $this->privateKey = str_replace('\n', "\n", config('services.google.private_key') ?? '');
    }

    /**
     * Lists all PDF files in a Drive folder.
     *
     * @return array<int, array{id: string, name: string}>
     */
    public function listPdfs(string $folderId): array
    {
        return RetryPolicy::run(function () use ($folderId) {
            $token = $this->getAccessToken();
            $files = [];
            $pageToken = null;

            do {
                $query = [
                    'q' => "'{$folderId}' in parents and trashed = false",
                    'fields' => 'nextPageToken, files(id, name, mimeType)',
                    'pageSize' => 100,
                ];

                if ($pageToken) {
                    $query['pageToken'] = $pageToken;
                }

                $response = Http::withToken($token)
                    ->timeout(30)
                    ->get('https://www.googleapis.com/drive/v3/files', $query);

                if (!$response->successful()) {
                    throw new UpstreamApiException('GoogleDrive', "Files list failed: {$response->body()}", $response->status());
                }

                $data = $response->json();
                $items = $data['files'] ?? [];

                foreach ($items as $item) {
                    // Include all files or filter PDFs (consistent with current app)
                    $files[] = [
                        'id' => $item['id'],
                        'name' => $item['name'],
                    ];
                }

                $pageToken = $data['nextPageToken'] ?? null;
            } while ($pageToken);

            return $files;
        });
    }

    /**
     * Downloads a file from Drive and streams it directly to local disk.
     */
    public function download(string $fileId, string $destinationPath): string
    {
        return RetryPolicy::run(function () use ($fileId, $destinationPath) {
            $dir = dirname($destinationPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            $token = $this->getAccessToken();
            $tempTarget = $destinationPath . '.tmp_' . uniqid();

            $timeout = (int) (config('automation.runner.drive_timeout_seconds') ?: 300);
            $response = Http::withToken($token)
                ->timeout($timeout)
                ->sink($tempTarget)
                ->get("https://www.googleapis.com/drive/v3/files/{$fileId}", [
                    'alt' => 'media',
                ]);

            if (!$response->successful()) {
                if (file_exists($tempTarget)) {
                    @unlink($tempTarget);
                }
                throw new UpstreamApiException('GoogleDrive', "File download failed for ID {$fileId}: {$response->status()}", $response->status());
            }

            rename($tempTarget, $destinationPath);
            return $destinationPath;
        });
    }

    /**
     * Generates a Service Account OAuth2 Bearer token via RS256 JWT assertion.
     */
    private function getAccessToken(): string
    {
        if (empty($this->clientEmail) || empty($this->privateKey)) {
            throw new RuntimeException('Missing Google Drive service account credentials (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY)');
        }

        return Cache::remember('google_drive_access_token', 3000, function () {
            $header = $this->base64UrlEncode(json_encode([
                'alg' => 'RS256',
                'typ' => 'JWT',
            ]));

            $now = time();
            $claim = $this->base64UrlEncode(json_encode([
                'iss' => $this->clientEmail,
                'scope' => 'https://www.googleapis.com/auth/drive.readonly',
                'aud' => 'https://oauth2.googleapis.com/token',
                'exp' => $now + 3600,
                'iat' => $now,
            ]));

            $signature = '';
            $success = openssl_sign("{$header}.{$claim}", $signature, $this->privateKey, OPENSSL_ALGO_SHA256);
            if (!$success) {
                throw new RuntimeException('Failed to sign Google Service Account JWT with private key');
            }

            $jwt = "{$header}.{$claim}." . $this->base64UrlEncode($signature);

            $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]);

            if (!$response->successful()) {
                throw new UpstreamApiException('GoogleAuth', "Failed to obtain access token: {$response->body()}", $response->status());
            }

            return $response->json('access_token');
        });
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
