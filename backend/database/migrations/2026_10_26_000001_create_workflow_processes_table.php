<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_processes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 255);
            $table->string('type', 32)->index(); // 'detailed_answer' | 'summary'
            $table->string('status', 32)->default('in_progress')->index(); // 'in_progress' | 'completed' | 'failed'
            $table->string('current_step_id', 64)->nullable();
            $table->string('selected_branch', 64)->nullable(); // e.g. 'path_a' | 'path_b'
            $table->integer('workflow_version')->default(1);
            $table->json('steps_data')->nullable();
            $table->integer('progress_percentage')->default(0);
            $table->integer('completed_steps_count')->default(0);
            $table->integer('total_steps_count')->default(0);
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('expires_at')->nullable();
            $table->timestampTz('files_purged_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestampsTz();

            $table->index(['status', 'created_at']);
            $table->index(['expires_at']);
        });

        Schema::create('workflow_process_files', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('workflow_process_id')->constrained('workflow_processes')->cascadeOnDelete();
            $table->string('step_id', 64)->index();
            $table->string('original_name', 255);
            $table->string('storage_path', 512);
            $table->string('file_type', 64)->default('output'); // 'output' | 'input'
            $table->unsignedBigInteger('file_size')->default(0);
            $table->timestampsTz();

            $table->index(['workflow_process_id', 'step_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_process_files');
        Schema::dropIfExists('workflow_processes');
    }
};
