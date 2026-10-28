<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tohtml_job_chunks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tohtml_job_id')->constrained('tohtml_jobs')->cascadeOnDelete();
            $table->integer('global_index');
            $table->integer('section_index');
            $table->integer('chunk_index')->default(0);
            $table->integer('chunk_number')->default(1);
            $table->integer('chunks_in_section')->default(1);

            $table->string('marker', 64);
            $table->integer('marker_number')->nullable();
            $table->string('label', 255);
            $table->mediumText('content');
            $table->integer('char_count')->default(0);
            $table->integer('line_count')->default(0);

            $table->string('status', 16)->default('pending');
            $table->smallInteger('attempt_count')->default(0);
            $table->string('output_filename', 512)->nullable();
            $table->mediumText('response_text')->nullable();
            $table->integer('duration_ms')->nullable();
            $table->text('error_message')->nullable();

            $table->timestampTz('claimed_at')->nullable();
            $table->string('claim_token', 64)->nullable();
            $table->timestampTz('claim_expires_at')->nullable();

            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('heartbeat_at')->nullable();
            $table->timestampsTz();

            $table->unique(['tohtml_job_id', 'global_index']);
            $table->index(['tohtml_job_id', 'status']);
            $table->index(['status', 'claim_expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tohtml_job_chunks');
    }
};
