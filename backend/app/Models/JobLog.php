<?php

namespace App\Models;

use App\Enums\LogLevel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JobLog extends Model
{
    public $timestamps = false;

    protected $table = 'job_logs';

    protected $fillable = [
        'pipeline_job_id',
        'tohtml_job_id',
        'level',
        'stage',
        'file_id',
        'file_name',
        'section_index',
        'marker',
        'message',
        'error',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'level' => LogLevel::class,
            'section_index' => 'integer',
            'created_at' => 'datetime:Y-m-d\TH:i:s.v\Z',
        ];
    }

    public function pipelineJob(): BelongsTo
    {
        return $this->belongsTo(PipelineJob::class, 'pipeline_job_id');
    }

    public function toHtmlJob(): BelongsTo
    {
        return $this->belongsTo(ToHtmlJob::class, 'tohtml_job_id');
    }
}
