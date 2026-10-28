<?php

namespace App\Services\Ai;

use App\Exceptions\DocumentTooLargeException;
use App\Exceptions\UpstreamApiException;
use App\Services\Support\RetryPolicy;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class GeminiClient implements OcrProvider
{
    private string $apiKey;
    private string $model;
    private PromptRepository $promptRepository;

    public function __construct(?PromptRepository $promptRepository = null)
    {
        $this->apiKey = config('services.gemini.api_key') ?? '';
        $this->model = config('services.gemini.model') ?? 'gemini-2.5-flash';
        $this->promptRepository = $promptRepository ?? new PromptRepository();
    }

    /**
     * Extracts text from PDF via Gemini Files API + generateContent.
     */
    public function extract(string $filePath, string $fileName, ?string $existingFileUri = null, ?string $existingUploadedName = null): string
    {
        if (empty($this->apiKey)) {
            throw new RuntimeException('Missing GEMINI_API_KEY environment variable');
        }

        $uploadedName = $existingUploadedName;
        $fileUri = $existingFileUri;

        try {
            if (!$fileUri || !$uploadedName) {
                // 1. Upload PDF to Gemini Files API
                $fileData = $this->uploadFile($filePath, $fileName);
                $uploadedName = $fileData['name'];
                $fileUri = $fileData['uri'];

                // 2. Poll until ACTIVE
                $this->waitForActiveState($uploadedName, $fileName);
            }

            // 3. Paced OCR Generation
            return $this->generateOcrText($fileUri, $fileName);
        } finally {
            if ($uploadedName) {
                $this->deleteFile($uploadedName);
            }
        }
    }

    /**
     * Resumable upload of file to Gemini Files API.
     */
    private function uploadFile(string $filePath, string $fileName): array
    {
        return RetryPolicy::run(function () use ($filePath, $fileName) {
            $fileSize = filesize($filePath);
            $mimeType = 'application/pdf';

            // Start resumable session
            $startUrl = "https://generativelanguage.googleapis.com/upload/v1beta/files?key={$this->apiKey}";
            $initResponse = Http::timeout(30)
                ->withHeaders([
                    'X-Goog-Upload-Protocol' => 'resumable',
                    'X-Goog-Upload-Command' => 'start',
                    'X-Goog-Upload-Header-Content-Length' => (string) $fileSize,
                    'X-Goog-Upload-Header-Content-Type' => $mimeType,
                    'Content-Type' => 'application/json',
                ])
                ->post($startUrl, [
                    'file' => [
                        'displayName' => $fileName,
                    ],
                ]);

            if (!$initResponse->successful()) {
                throw new UpstreamApiException('GeminiUpload', "Failed to initiate upload for {$fileName}: {$initResponse->body()}", $initResponse->status());
            }

            $uploadUrl = $initResponse->header('X-Goog-Upload-URL');
            if (!$uploadUrl) {
                throw new UpstreamApiException('GeminiUpload', "Did not receive upload URL for {$fileName}", 500);
            }

            // Stream file contents to the upload URL
            $stream = fopen($filePath, 'r');
            $uploadResponse = Http::timeout(config('automation.gemini.timeout_ms', 900000) / 1000)
                ->withHeaders([
                    'X-Goog-Upload-Command' => 'upload, finalize',
                    'X-Goog-Upload-Offset' => '0',
                    'Content-Length' => (string) $fileSize,
                ])
                ->withBody($stream, $mimeType)
                ->post($uploadUrl);

            if (is_resource($stream)) {
                fclose($stream);
            }

            if (!$uploadResponse->successful()) {
                throw new UpstreamApiException('GeminiUpload', "Failed to upload file content for {$fileName}: {$uploadResponse->body()}", $uploadResponse->status());
            }

            $fileInfo = $uploadResponse->json('file');
            if (empty($fileInfo['name']) || empty($fileInfo['uri'])) {
                throw new UpstreamApiException('GeminiUpload', "Incomplete file metadata received for {$fileName}", 500);
            }

            return $fileInfo;
        }, (int) (config('automation.runner.http_retries') ?? config('automation.gemini.retries', 5)), config('automation.gemini.retry_delay_ms', 5000));
    }

    /**
     * Polls file status until state is ACTIVE (max 120s).
     */
    private function waitForActiveState(string $uploadedName, string $fileName): void
    {
        $pollIntervalMs = 2000;
        $maxWaitMs = 120000;
        $waitedMs = 0;

        while ($waitedMs < $maxWaitMs) {
            usleep($pollIntervalMs * 1000);
            $waitedMs += $pollIntervalMs;

            $statusUrl = "https://generativelanguage.googleapis.com/v1beta/{$uploadedName}?key={$this->apiKey}";
            $response = Http::timeout(15)->get($statusUrl);

            if (!$response->successful()) {
                continue;
            }

            $state = $response->json('state');
            if ($state === 'ACTIVE') {
                return;
            }

            if ($state === 'FAILED') {
                throw new UpstreamApiException('GeminiFiles', "File processing failed remotely for {$fileName}", 500);
            }
        }

        throw new UpstreamApiException('GeminiFiles', "File processing timed out after 120s for {$fileName}", 504);
    }

    /**
     * Performs paced generateContent request with OCR prompt.
     */
    private function generateOcrText(string $fileUri, string $fileName): string
    {
        return RetryPolicy::run(function () use ($fileUri, $fileName) {
            GeminiPacer::pace();

            $ocrPrompt = $this->promptRepository->getOcrPrompt();
            $timeoutSeconds = (int) (config('automation.runner.gemini_timeout_seconds') ?: (config('automation.gemini.timeout_ms', 900000) / 1000));

            $payload = [
                'contents' => [
                    [
                        'parts' => [
                            [
                                'fileData' => [
                                    'mimeType' => 'application/pdf',
                                    'fileUri' => $fileUri,
                                ],
                            ],
                            [
                                'text' => $ocrPrompt,
                            ],
                        ],
                    ],
                ],
                'generationConfig' => [
                    'temperature' => 0,
                ],
            ];

            $thinkingBudget = config('automation.gemini.thinking_budget');
            if ($thinkingBudget !== null) {
                $payload['generationConfig']['thinkingConfig'] = [
                    'thinkingBudget' => (int) $thinkingBudget,
                ];
            }

            $generateUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key={$this->apiKey}";

            $response = Http::timeout($timeoutSeconds)->post($generateUrl, $payload);

            if (!$response->successful()) {
                $status = $response->status();
                if ($status === 429) {
                    throw new UpstreamApiException('GeminiGenerate', "Rate limit/quota exceeded for model {$this->model}", 429);
                }
                throw new UpstreamApiException('GeminiGenerate', "OCR generation failed for {$fileName}: {$response->body()}", $status);
            }

            $data = $response->json();
            $candidate = $data['candidates'][0] ?? null;

            if (!$candidate) {
                throw new UpstreamApiException('GeminiGenerate', "Gemini OCR returned no candidates for {$fileName}", 500);
            }

            $finishReason = $candidate['finishReason'] ?? null;
            if ($finishReason === 'MAX_TOKENS') {
                throw new DocumentTooLargeException();
            }

            $parts = $candidate['content']['parts'] ?? [];
            $text = '';
            foreach ($parts as $part) {
                if (isset($part['text'])) {
                    $text .= $part['text'];
                }
            }

            $trimmed = trim($text);
            if ($trimmed === '') {
                throw new UpstreamApiException('GeminiGenerate', "Gemini OCR returned empty response for {$fileName}", 500);
            }

            return $trimmed;
        }, (int) (config('automation.runner.http_retries') ?? config('automation.gemini.retries', 5)), config('automation.gemini.retry_delay_ms', 5000));
    }

    /**
     * Clean up uploaded file remotely.
     */
    private function deleteFile(string $uploadedName): void
    {
        try {
            $deleteUrl = "https://generativelanguage.googleapis.com/v1beta/{$uploadedName}?key={$this->apiKey}";
            Http::timeout(10)->delete($deleteUrl);
        } catch (Throwable $e) {
            Log::warning("Failed to delete remote Gemini file: {$uploadedName}", ['error' => $e->getMessage()]);
        }
    }
}
