<?php

namespace App\Providers;

use App\Services\Ai\GeminiClient;
use App\Services\Ai\OcrProvider;
use App\Services\Drive\DriveGateway;
use App\Services\Drive\GoogleDriveService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(DriveGateway::class, GoogleDriveService::class);
        $this->app->bind(OcrProvider::class, GeminiClient::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
