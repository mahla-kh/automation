<?php

namespace App\Models;

use App\Enums\JobStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PipelineJob extends Model
{
    use HasUuids;

    protected $table = 'pipeline_jobs';

    protected $fillable = [
        'user_id',
        'folder_id',
        'folder_url',
        'output_folder',
        'status',
        'total_files',
        'error_message',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => JobStatus::class,
            'total_files' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(PipelineJobFile::class)->orderBy('position');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(JobLog::class)->orderBy('id');
    }
}
