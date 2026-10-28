<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tohtml_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('file_name', 512);
            $table->string('folder_name', 512)->unique();
            $table->mediumText('prompt')->nullable();
            $table->integer('max_lines_per_chunk')->default(600);
            $table->integer('total_sections')->default(0);
            $table->integer('total_chunks')->default(0);
            $table->string('status', 16)->default('queued')->index();

            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();

            $table->index(['created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tohtml_jobs');
    }
};
