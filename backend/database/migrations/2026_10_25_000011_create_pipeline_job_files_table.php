<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pipeline_job_files', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('pipeline_job_id')->constrained('pipeline_jobs')->cascadeOnDelete();
            $table->string('drive_file_id', 128);
            $table->string('file_name', 512);
            $table->integer('position')->default(0);

            $table->string('download_status', 16)->default('pending');
            $table->string('upload_status', 16)->default('pending');
            $table->string('ocr_status', 16)->default('pending');
            $table->string('overall_status', 16)->default('pending');

            $table->string('error_stage', 16)->nullable();
            $table->text('error_message')->nullable();
            $table->string('output_filename', 512)->nullable();
            $table->string('output_path', 1024)->nullable();
            $table->string('gemini_file_name', 255)->nullable();
            $table->string('gemini_file_uri', 512)->nullable();
            $table->mediumText('result')->nullable();

            $table->integer('download_ms')->nullable();
            $table->integer('upload_ms')->nullable();
            $table->integer('ocr_ms')->nullable();

            $table->timestampTz('claimed_at')->nullable();
            $table->string('claim_token', 64)->nullable();
            $table->timestampTz('claim_expires_at')->nullable();

            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('heartbeat_at')->nullable();
            $table->timestampsTz();

            $table->unique(['pipeline_job_id', 'drive_file_id']);
            $table->index(['pipeline_job_id', 'overall_status']);
            $table->index(['overall_status', 'claim_expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pipeline_job_files');
    }
};
