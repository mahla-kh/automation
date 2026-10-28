<?php

namespace App\Services\Ai;

use App\Exceptions\TruncatedOutputException;
use App\Exceptions\UpstreamApiException;
use App\Services\Support\RetryPolicy;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class DeepSeekClient
{
    private string $apiKey;
    private string $baseUrl;
    private string $model;
    private int $maxTokens;

    public function __construct()
    {
        $this->apiKey = config('services.deepseek.api_key') ?? 'dummy-key';
        $this->baseUrl = config('services.deepseek.base_url') ?? 'https://api.deepseek.com';
        $this->model = config('services.deepseek.model') ?? 'deepseek-chat';
        $this->maxTokens = (int) (config('services.deepseek.max_tokens') ?? 8192);
    }

    /**
     * Executes chat completion with system and user prompts.
     */
    public function chat(string $systemPrompt, string $userPrompt): string
    {
        return RetryPolicy::run(function () use ($systemPrompt, $userPrompt) {
            $url = rtrim($this->baseUrl, '/') . '/chat/completions';

            $timeout = (int) (config('automation.runner.deepseek_timeout_seconds') ?: config('automation.tohtml.chunk_timeout_seconds', 900));
            $response = Http::withToken($this->apiKey)
                ->timeout($timeout)
                ->post($url, [
                    'model' => $this->model,
                    'temperature' => 0,
                    'max_tokens' => $this->maxTokens,
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => $systemPrompt,
                        ],
                        [
                            'role' => 'user',
                            'content' => $userPrompt,
                        ],
                    ],
                ]);

            if (!$response->successful()) {
                throw new UpstreamApiException('DeepSeek', "Chat completion failed: {$response->body()}", $response->status());
            }

            $data = $response->json();
            $choice = $data['choices'][0] ?? null;

            if (!$choice) {
                throw new UpstreamApiException('DeepSeek', 'No completion choices returned by DeepSeek', 500);
            }

            $finishReason = $choice['finish_reason'] ?? null;
            if ($finishReason === 'length') {
                throw new TruncatedOutputException();
            }

            $content = $choice['message']['content'] ?? null;
            if ($content === null || trim($content) === '') {
                throw new UpstreamApiException('DeepSeek', 'DeepSeek returned empty response', 500);
            }

            return $content;
        }, (int) (config('automation.runner.http_retries') ?? config('automation.deepseek.retries', 3)), config('automation.deepseek.retry_delay_ms', 2000));
    }
}
