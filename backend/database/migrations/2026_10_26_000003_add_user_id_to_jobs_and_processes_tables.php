<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('workflow_processes') && !Schema::hasColumn('workflow_processes', 'user_id')) {
            Schema::table('workflow_processes', function (Blueprint $table) {
                $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
                $table->index(['user_id', 'status']);
            });
        }

        if (Schema::hasTable('pipeline_jobs') && !Schema::hasColumn('pipeline_jobs', 'user_id')) {
            Schema::table('pipeline_jobs', function (Blueprint $table) {
                $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
                $table->index(['user_id', 'status']);
            });
        }

        if (Schema::hasTable('tohtml_jobs') && !Schema::hasColumn('tohtml_jobs', 'user_id')) {
            Schema::table('tohtml_jobs', function (Blueprint $table) {
                $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
                $table->index(['user_id', 'status']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('tohtml_jobs') && Schema::hasColumn('tohtml_jobs', 'user_id')) {
            Schema::table('tohtml_jobs', function (Blueprint $table) {
                $table->dropConstrainedForeignId('user_id');
            });
        }

        if (Schema::hasTable('pipeline_jobs') && Schema::hasColumn('pipeline_jobs', 'user_id')) {
            Schema::table('pipeline_jobs', function (Blueprint $table) {
                $table->dropConstrainedForeignId('user_id');
            });
        }

        if (Schema::hasTable('workflow_processes') && Schema::hasColumn('workflow_processes', 'user_id')) {
            Schema::table('workflow_processes', function (Blueprint $table) {
                $table->dropConstrainedForeignId('user_id');
            });
        }
    }
};
