<?php

namespace App\Models;

use App\Enums\StageStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PipelineJobFile extends Model
{
    use HasUuids;

    protected $table = 'pipeline_job_files';

    protected $fillable = [
        'pipeline_job_id',
        'drive_file_id',
        'file_name',
        'position',
        'download_status',
        'upload_status',
        'ocr_status',
        'overall_status',
        'error_stage',
        'error_message',
        'output_filename',
        'output_path',
        'gemini_file_name',
        'gemini_file_uri',
        'result',
        'download_ms',
        'upload_ms',
        'ocr_ms',
        'claimed_at',
        'claim_token',
        'claim_expires_at',
        'started_at',
        'completed_at',
        'heartbeat_at',
    ];

    protected function casts(): array
    {
        return [
            'download_status' => StageStatus::class,
            'upload_status' => StageStatus::class,
            'ocr_status' => StageStatus::class,
            'overall_status' => StageStatus::class,
            'position' => 'integer',
            'download_ms' => 'integer',
            'upload_ms' => 'integer',
            'ocr_ms' => 'integer',
            'claimed_at' => 'datetime',
            'claim_expires_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'heartbeat_at' => 'datetime',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(PipelineJob::class, 'pipeline_job_id');
    }
}
