<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('pipeline_job_id')->nullable()->constrained('pipeline_jobs')->cascadeOnDelete();
            $table->foreignUuid('tohtml_job_id')->nullable()->constrained('tohtml_jobs')->cascadeOnDelete();

            $table->string('level', 8);
            $table->string('stage', 32)->nullable();
            $table->string('file_id', 128)->nullable();
            $table->string('file_name', 512)->nullable();
            $table->integer('section_index')->nullable();
            $table->string('marker', 64)->nullable();
            $table->text('message');
            $table->text('error')->nullable();
            $table->timestampTz('created_at', 3);

            $table->index(['pipeline_job_id', 'id']);
            $table->index(['tohtml_job_id', 'id']);
        });

        // Postgres check constraint ensuring exactly one job foreign key is set
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE job_logs ADD CONSTRAINT check_job_logs_job_parent CHECK ((pipeline_job_id IS NOT NULL AND tohtml_job_id IS NULL) OR (pipeline_job_id IS NULL AND tohtml_job_id IS NOT NULL))');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('job_logs');
    }
};
