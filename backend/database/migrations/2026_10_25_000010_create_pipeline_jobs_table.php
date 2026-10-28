<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pipeline_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('folder_id', 128)->index();
            $table->text('folder_url');
            $table->string('output_folder', 255)->nullable();
            $table->string('status', 16)->default('queued')->index();
            $table->integer('total_files')->default(0);
            $table->text('error_message')->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();

            $table->index(['created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pipeline_jobs');
    }
};
