<?php

namespace App\Http\Controllers;

use App\Services\ToHtml\ToHtmlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

class ToHtmlController extends Controller
{
    public function __construct(
        private readonly ToHtmlService $toHtmlService
    ) {}

    /**
     * POST /api/tohtml/start
     */
    public function start(Request $request): JsonResponse
    {
        $fileName = $request->input('fileName');
        $prompt = $request->input('prompt');
        $sections = $request->input('sections');
        $maxLinesPerChunk = $request->input('maxLinesPerChunk');

        if (!$fileName || !is_string($fileName) || trim($fileName) === '') {
            return response()->json(['error' => 'fileName is required and must be a string'], 400);
        }

        if (!$prompt || !is_string($prompt) || trim($prompt) === '') {
            return response()->json(['error' => 'prompt is required and must not be empty'], 400);
        }

        if (!is_array($sections) || empty($sections)) {
            return response()->json(['error' => 'sections must be a non-empty array of parsed sections'], 400);
        }

        try {
            $result = $this->toHtmlService->start(
                fileName: $fileName,
                prompt: $prompt,
                sections: $sections,
                maxLinesPerChunk: is_numeric($maxLinesPerChunk) ? (int) $maxLinesPerChunk : null
            );

            if ($request->user() && isset($result['jobId'])) {
                \App\Models\ToHtmlJob::where('id', $result['jobId'])->update(['user_id' => $request->user()->id]);
            }

            return response()->json($result);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        } catch (Throwable $e) {
            return response()->json(['error' => $e->getMessage() ?: 'Failed to start tohtml job'], 500);
        }
    }

    /**
     * GET /api/tohtml/status
     */
    public function status(Request $request): JsonResponse
    {
        $id = $request->query('id');
        $user = $request->user();

        if (!$id) {
            $userIdFilter = ($user && $user->isUser()) ? $user->id : null;
            $jobs = $this->toHtmlService->listJobs($userIdFilter);
            return response()->json(['jobs' => $jobs]);
        }

        $jobModel = \App\Models\ToHtmlJob::find($id);
        if (!$jobModel) {
            return response()->json(['error' => "Job not found: {$id}"], 404);
        }

        if ($user && $user->isUser() && ($jobModel->user_id === null || $jobModel->user_id !== $user->id)) {
            return response()->json(['message' => 'This action is unauthorized.'], 403);
        }

        $job = $this->toHtmlService->status($id);
        return response()->json($job);
    }

    /**
     * POST /api/tohtml/retry
     */
    public function retry(Request $request): JsonResponse
    {
        $jobId = $request->input('jobId');
        $sectionIndex = $request->input('sectionIndex');
        $user = $request->user();

        if (!$jobId || !is_string($jobId)) {
            return response()->json(['error' => 'jobId is required and must be a string'], 400);
        }

        $jobModel = \App\Models\ToHtmlJob::find($jobId);
        if (!$jobModel) {
            return response()->json(['error' => "Job not found: {$jobId}"], 404);
        }

        if ($user && $user->isUser() && ($jobModel->user_id === null || $jobModel->user_id !== $user->id)) {
            return response()->json(['message' => 'This action is unauthorized.'], 403);
        }

        try {
            $result = $this->toHtmlService->retry(
                $jobId,
                $sectionIndex !== null && is_numeric($sectionIndex) ? (int) $sectionIndex : null
            );

            return response()->json($result);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        } catch (RuntimeException $e) {
            $statusCode = $e->getCode() >= 400 && $e->getCode() <= 500 ? $e->getCode() : 400;
            return response()->json(['error' => $e->getMessage()], $statusCode);
        } catch (Throwable $e) {
            return response()->json(['error' => $e->getMessage() ?: 'Failed to retry section'], 500);
        }
    }

    /**
     * GET /api/tohtml/download
     */
    public function download(Request $request): Response|JsonResponse
    {
        $jobId = $request->query('jobId');
        $sectionIndexStr = $request->query('sectionIndex');
        $filename = $request->query('filename');
        $isMerged = $request->query('merged') === 'true';
        $user = $request->user();

        if (!$jobId) {
            return response()->json(['error' => 'jobId query parameter is required'], 400);
        }

        $jobModel = \App\Models\ToHtmlJob::find($jobId);
        if (!$jobModel) {
            return response()->json(['error' => "Job not found: {$jobId}"], 404);
        }

        if ($user && $user->isUser() && ($jobModel->user_id === null || $jobModel->user_id !== $user->id)) {
            return response()->json(['message' => 'This action is unauthorized.'], 403);
        }

        $sectionIndex = null;
        if ($sectionIndexStr !== null) {
            if (!is_numeric($sectionIndexStr)) {
                return response()->json(['error' => "Invalid sectionIndex: {$sectionIndexStr}"], 400);
            }
            $sectionIndex = (int) $sectionIndexStr;
        }

        try {
            $data = $this->toHtmlService->download(
                jobId: $jobId,
                sectionIndex: $sectionIndex,
                filename: $filename,
                isMerged: $isMerged
            );

            $downloadName = $data['downloadName'];
            $safeAscii = preg_replace('/["\\\\]/', '', preg_replace('/[^\x20-\x7E]/', '_', basename($downloadName)));
            $encoded = rawurlencode(basename($downloadName));

            return response($data['content'], 200, [
                'Content-Type' => 'text/plain; charset=utf-8',
                'Content-Disposition' => "attachment; filename=\"{$safeAscii}\"; filename*=UTF-8''{$encoded}",
            ]);
        } catch (RuntimeException $e) {
            $statusCode = $e->getCode() >= 400 && $e->getCode() <= 500 ? $e->getCode() : 400;
            return response()->json(['error' => $e->getMessage()], $statusCode);
        } catch (Throwable $e) {
            return response()->json(['error' => $e->getMessage() ?: 'Failed to download file'], 500);
        }
    }
}
