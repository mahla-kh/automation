<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkflowProcess extends Model
{
    use HasUuids;

    protected $table = 'workflow_processes';

    protected $fillable = [
        'id',
        'user_id',
        'name',
        'type',
        'status',
        'current_step_id',
        'selected_branch',
        'workflow_version',
        'steps_data',
        'progress_percentage',
        'completed_steps_count',
        'total_steps_count',
        'started_at',
        'completed_at',
        'expires_at',
        'files_purged_at',
        'error_message',
    ];

    protected $casts = [
        'steps_data' => 'array',
        'workflow_version' => 'integer',
        'progress_percentage' => 'integer',
        'completed_steps_count' => 'integer',
        'total_steps_count' => 'integer',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'expires_at' => 'datetime',
        'files_purged_at' => 'datetime',
    ];

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(WorkflowProcessFile::class, 'workflow_process_id');
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
