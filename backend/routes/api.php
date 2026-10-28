<?php

use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PipelineController;
use App\Http\Controllers\ToHtmlController;
use App\Http\Controllers\WorkflowProcessController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Authentication Routes
|--------------------------------------------------------------------------
*/
Route::prefix('auth')->group(function () {
    Route::get('csrf', [AuthController::class, 'csrf']);
    Route::post('login', [AuthController::class, 'login']);
});

/*
|--------------------------------------------------------------------------
| Protected Application Routes
|--------------------------------------------------------------------------
| All application processes, jobs, downloads, and user management require
| backend-verified authentication and active account status.
*/
Route::middleware(['auth:web', 'active'])->group(function () {
    // Current user authentication lifecycle
    Route::prefix('auth')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('change-password', [AuthController::class, 'changePassword']);
    });

    // WePass Pipeline Automation
    Route::prefix('pipelines')->group(function () {
        Route::post('start', [PipelineController::class, 'start'])->middleware('throttle:10,1');
        Route::get('status', [PipelineController::class, 'status']);
        Route::get('download', [PipelineController::class, 'download']);
        Route::get('merge', [PipelineController::class, 'merge']);
    });

    // ToHTML Synthesis Automation
    Route::prefix('tohtml')->group(function () {
        Route::post('start', [ToHtmlController::class, 'start'])->middleware('throttle:10,1');
        Route::get('status', [ToHtmlController::class, 'status']);
        Route::post('retry', [ToHtmlController::class, 'retry'])->middleware('throttle:10,1');
        Route::get('download', [ToHtmlController::class, 'download']);
    });

    // Workflow Processes
    Route::prefix('processes')->group(function () {
        Route::get('/', [WorkflowProcessController::class, 'index']);
        Route::post('/', [WorkflowProcessController::class, 'store'])->middleware('throttle:30,1');
        Route::get('{id}', [WorkflowProcessController::class, 'show']);
        Route::post('{id}/step', [WorkflowProcessController::class, 'updateStep'])->middleware('throttle:60,1');
        Route::post('{id}/upload', [WorkflowProcessController::class, 'uploadFile'])->middleware('throttle:30,1');
        Route::get('{id}/download/{fileId}', [WorkflowProcessController::class, 'downloadFile']);
        Route::delete('{id}', [WorkflowProcessController::class, 'destroy']);
    });

    // Administrative User Management
    Route::prefix('admin')->middleware('role:ADMIN,SUPER_ADMIN')->group(function () {
        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::get('users/{id}', [UserController::class, 'show']);
        Route::patch('users/{id}/status', [UserController::class, 'updateStatus']);
        Route::post('users/{id}/reset-password', [UserController::class, 'resetPassword']);
        Route::patch('users/{id}/role', [UserController::class, 'updateRole']);
    });
});
