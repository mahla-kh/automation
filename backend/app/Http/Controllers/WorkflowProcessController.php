<?php

namespace App\Http\Controllers;

use App\Models\WorkflowProcess;
use App\Models\WorkflowProcessFile;
use App\Services\Workflow\WorkflowEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class WorkflowProcessController extends Controller
{
    public function __construct(
        protected WorkflowEngine $engine
    ) {}

    /**
     * List processes with optional status filtering, scoped to the current user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $status = $request->query('status');

        $query = WorkflowProcess::query();

        // Regular users only see their own processes. Administrators see all processes.
        if ($user && $user->isUser()) {
            $query->where('user_id', $user->id);
        }

        if ($status === 'incomplete') {
            $processes = (clone $query)->where('status', '!=', WorkflowEngine::STATUS_COMPLETED)
                ->orderByDesc('updated_at')
                ->get();
            return response()->json($processes);
        }

        if ($status === 'completed') {
            $processes = (clone $query)->where('status', WorkflowEngine::STATUS_COMPLETED)
                ->orderByDesc('completed_at')
                ->get();
            return response()->json($processes);
        }

        $incomplete = (clone $query)->where('status', '!=', WorkflowEngine::STATUS_COMPLETED)
            ->orderByDesc('updated_at')
            ->get();

        $completed = (clone $query)->where('status', WorkflowEngine::STATUS_COMPLETED)
            ->orderByDesc('completed_at')
            ->get();

        return response()->json([
            'incomplete' => $incomplete,
            'completed' => $completed,
        ]);
    }

    /**
     * Create a new process.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'type' => ['required', 'string', 'in:detailed_answer,summary'],
        ]);

        $name = trim($validated['name']);
        if (empty($name)) {
            return response()->json(['error' => 'Process name is required.'], 422);
        }

        $process = $this->engine->createProcess($name, $validated['type']);
        if ($request->user()) {
            $process->forceFill(['user_id' => $request->user()->id])->save();
        }

        return response()->json($process, 201);
    }

    /**
     * Show a single process with its workflow state and files.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $process = WorkflowProcess::with('files')->find($id);

        if (!$process) {
            return response()->json(['error' => "Process not found: {$id}"], 404);
        }

        $this->authorizeProcessAccess($request, $process);

        return response()->json($process);
    }

    /**
     * Update a step: complete, save inputs, select branch, mark satisfied, retry.
     */
    public function updateStep(Request $request, string $id): JsonResponse
    {
        $process = WorkflowProcess::find($id);
        if (!$process) {
            return response()->json(['error' => "Process not found: {$id}"], 404);
        }

        $this->authorizeProcessAccess($request, $process);

        $validated = $request->validate([
            'step_id' => ['required', 'string'],
            'action' => ['required', 'string', 'in:complete,save_inputs,select_branch,mark_satisfied,retry'],
            'inputs' => ['nullable', 'array'],
            'outputs' => ['nullable', 'array'],
            'selected_branch' => ['nullable', 'string', 'in:path_a,path_b'],
            'already_satisfied' => ['nullable', 'boolean'],
        ]);

        $stepId = $validated['step_id'];
        $action = $validated['action'];

        try {
            switch ($action) {
                case 'complete':
                    $this->engine->completeStep(
                        $process,
                        $stepId,
                        $validated['inputs'] ?? [],
                        $validated['outputs'] ?? []
                    );
                    break;

                case 'save_inputs':
                    $this->engine->saveStepInputs(
                        $process,
                        $stepId,
                        $validated['inputs'] ?? []
                    );
                    break;

                case 'select_branch':
                    if (empty($validated['selected_branch'])) {
                        return response()->json(['error' => 'selected_branch is required for select_branch action.'], 422);
                    }
                    $this->engine->selectBranch(
                        $process,
                        $stepId,
                        $validated['selected_branch']
                    );
                    break;

                case 'mark_satisfied':
                    $satisfied = (bool) ($validated['already_satisfied'] ?? true);
                    $this->engine->markPrerequisiteSatisfied(
                        $process,
                        $stepId,
                        $satisfied
                    );
                    break;

                case 'retry':
                    $this->engine->retryStep(
                        $process,
                        $stepId
                    );
                    break;
            }

            $process->refresh()->load('files');
            return response()->json($process);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * Upload an output or reference file for a step.
     */
    public function uploadFile(Request $request, string $id): JsonResponse
    {
        $process = WorkflowProcess::find($id);
        if (!$process) {
            return response()->json(['error' => "Process not found: {$id}"], 404);
        }

        $this->authorizeProcessAccess($request, $process);

        $request->validate([
            'step_id' => ['required', 'string'],
            'file' => ['required', 'file', 'max:51200'], // 50MB
            'file_type' => ['nullable', 'string', 'in:output,input'],
        ]);

        $stepId = $request->input('step_id');
        $file = $request->file('file');
        $fileType = $request->input('file_type', 'output');

        $safeDir = storage_path("app/private/processes/{$id}/{$stepId}");
        if (!is_dir($safeDir)) {
            File::makeDirectory($safeDir, 0755, true);
        }

        $originalName = $file->getClientOriginalName();
        $safeName = Str::uuid() . '_' . preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $originalName);
        $file->move($safeDir, $safeName);

        $record = WorkflowProcessFile::create([
            'id' => (string) Str::uuid(),
            'workflow_process_id' => $process->id,
            'step_id' => $stepId,
            'original_name' => $originalName,
            'storage_path' => "processes/{$id}/{$stepId}/{$safeName}",
            'file_type' => $fileType,
            'file_size' => filesize("{$safeDir}/{$safeName}"),
        ]);

        return response()->json($record, 201);
    }

    /**
     * Download an uploaded file.
     */
    public function downloadFile(Request $request, string $id, string $fileId): BinaryFileResponse|JsonResponse
    {
        $process = WorkflowProcess::find($id);
        if (!$process) {
            return response()->json(['error' => "Process not found: {$id}"], 404);
        }

        $this->authorizeProcessAccess($request, $process);

        $processFile = WorkflowProcessFile::where('workflow_process_id', $id)
            ->where('id', $fileId)
            ->first();

        if (!$processFile) {
            return response()->json(['error' => 'File not found.'], 404);
        }

        $fullPath = storage_path("app/private/{$processFile->storage_path}");
        $baseDir = realpath(storage_path('app/private/processes'));

        $realFullPath = realpath($fullPath);
        if (!$realFullPath || !str_starts_with($realFullPath, $baseDir) || !is_file($realFullPath)) {
            return response()->json(['error' => 'File does not exist or has expired.'], 404);
        }

        return response()->download($realFullPath, $processFile->original_name);
    }

    /**
     * Delete an incomplete process.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $process = WorkflowProcess::find($id);
        if (!$process) {
            return response()->json(['error' => "Process not found: {$id}"], 404);
        }

        $this->authorizeProcessAccess($request, $process);

        // Clean up process storage directory safely
        $processDir = storage_path("app/private/processes/{$id}");
        if (is_dir($processDir)) {
            File::deleteDirectory($processDir);
        }

        $outputsDir = base_path("outputs/processes/{$id}");
        if (is_dir($outputsDir)) {
            File::deleteDirectory($outputsDir);
        }

        $process->delete();

        return response()->json([
            'success' => true,
            'message' => 'Process deleted successfully.',
        ]);
    }

    /**
     * Ensure the requesting user is authorized to access the given process.
     */
    protected function authorizeProcessAccess(Request $request, WorkflowProcess $process): void
    {
        $user = $request->user();
        if (!$user) {
            abort(response()->json(['message' => 'Unauthenticated.'], 401));
        }

        if ($user->hasAdminPrivileges()) {
            return;
        }

        // Regular users can only access their own processes
        if ($process->user_id === null || $process->user_id !== $user->id) {
            abort(response()->json(['message' => 'This action is unauthorized.'], 403));
        }
    }
}
