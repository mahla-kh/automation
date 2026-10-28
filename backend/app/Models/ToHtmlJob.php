<?php

namespace App\Models;

use App\Enums\JobStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ToHtmlJob extends Model
{
    use HasUuids;

    protected $table = 'tohtml_jobs';

    protected $fillable = [
        'user_id',
        'file_name',
        'folder_name',
        'prompt',
        'max_lines_per_chunk',
        'total_sections',
        'total_chunks',
        'status',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => JobStatus::class,
            'max_lines_per_chunk' => 'integer',
            'total_sections' => 'integer',
            'total_chunks' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(ToHtmlJobChunk::class, 'tohtml_job_id')->orderBy('global_index');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(JobLog::class, 'tohtml_job_id')->orderBy('id');
    }
}
