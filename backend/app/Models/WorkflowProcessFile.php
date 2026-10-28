<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowProcessFile extends Model
{
    use HasUuids;

    protected $table = 'workflow_process_files';

    protected $fillable = [
        'id',
        'workflow_process_id',
        'step_id',
        'original_name',
        'storage_path',
        'file_type',
        'file_size',
    ];

    protected $casts = [
        'file_size' => 'integer',
    ];

    public function process(): BelongsTo
    {
        return $this->belongsTo(WorkflowProcess::class, 'workflow_process_id');
    }
}
