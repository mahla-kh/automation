<?php

namespace App\Http\Controllers;

use App\Services\Pipeline\PipelineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

class PipelineController extends Controller
{
    public function __construct(
        private readonly PipelineService $pipelineService
    ) {}

    /**
     * POST /api/pipelines/start
     */
    public function start(Request $request): JsonResponse
    {
        $folderUrl = $request->input('folderUrl');
        if (!$folderUrl) {
            return response()->json(['error' => 'Folder URL is required'], 400);
        }

        try {
            $result = $this->pipelineService->start($folderUrl);

            if ($request->user() && isset($result['jobId'])) {
                \App\Models\PipelineJob::where('id', $result['jobId'])->update(['user_id' => $request->user()->id]);
            }

            return response()->json($result);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        } catch (Throwable $e) {
            return response()->json([
                'error' => $e->getMessage() ?: 'Pipeline failed to start',
            ], 500);
        }
    }

    /**
     * GET /api/pipelines/status
     */
    public function status(Request $request): JsonResponse
    {
        $id = $request->query('id');
        $user = $request->user();

        if (!$id) {
            $userIdFilter = ($user && $user->isUser()) ? $user->id : null;
            $jobs = $this->pipelineService->listJobs($userIdFilter);
            return response()->json(['jobs' => $jobs]);
        }

        $jobModel = \App\Models\PipelineJob::find($id);
        if (!$jobModel) {
            return response()->json(['error' => 'Job not found'], 404);
        }

        if ($user && $user->isUser() && ($jobModel->user_id === null || $jobModel->user_id !== $user->id)) {
            return response()->json(['message' => 'This action is unauthorized.'], 403);
        }

        $details = $this->pipelineService->status($id);
        return response()->json($details);
    }

    /**
     * GET /api/pipelines/download
     */
    public function download(Request $request): Response|JsonResponse
    {
        $jobId = $request->query('jobId');
        $fileId = $request->query('fileId');
        $user = $request->user();

        if (!$jobId || !$fileId) {
            return response()->json(['error' => 'jobId and fileId query parameters are required'], 400);
        }

        $jobModel = \App\Models\PipelineJob::find($jobId);
        if (!$jobModel) {
            return response()->json(['error' => 'Job not found'], 404);
        }

        if ($user && $user->isUser() && ($jobModel->user_id === null || $jobModel->user_id !== $user->id)) {
            return response()->json(['message' => 'This action is unauthorized.'], 403);
        }

        try {
            $data = $this->pipelineService->download($jobId, $fileId);
            $downloadName = $data['downloadName'];
            $safeAscii = preg_replace('/["\\\\]/', '', preg_replace('/[^\x20-\x7E]/', '_', $downloadName));
            $encoded = rawurlencode($downloadName);

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

    /**
     * GET /api/pipelines/merge
     */
    public function merge(Request $request): Response|JsonResponse
    {
        $jobId = $request->query('jobId');
        $user = $request->user();

        if (!$jobId) {
            return response()->json(['error' => 'jobId query parameter is required'], 400);
        }

        $jobModel = \App\Models\PipelineJob::find($jobId);
        if (!$jobModel) {
            return response()->json(['error' => 'Job not found'], 404);
        }

        if ($user && $user->isUser() && ($jobModel->user_id === null || $jobModel->user_id !== $user->id)) {
            return response()->json(['message' => 'This action is unauthorized.'], 403);
        }

        try {
            $data = $this->pipelineService->merge($jobId);
            $downloadName = $data['downloadName'];

            return response($data['content'], 200, [
                'Content-Type' => 'text/plain; charset=utf-8',
                'Content-Disposition' => "attachment; filename=\"{$downloadName}\"",
            ]);
        } catch (RuntimeException $e) {
            $statusCode = $e->getCode() >= 400 && $e->getCode() <= 500 ? $e->getCode() : 400;
            return response()->json(['error' => $e->getMessage()], $statusCode);
        } catch (Throwable $e) {
            return response()->json(['error' => $e->getMessage() ?: 'Failed to merge files'], 500);
        }
    }
}
