<?php

namespace App\Models;

use App\Enums\ChunkStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ToHtmlJobChunk extends Model
{
    use HasUuids;

    protected $table = 'tohtml_job_chunks';

    protected $fillable = [
        'tohtml_job_id',
        'global_index',
        'section_index',
        'chunk_index',
        'chunk_number',
        'chunks_in_section',
        'marker',
        'marker_number',
        'label',
        'content',
        'char_count',
        'line_count',
        'status',
        'attempt_count',
        'output_filename',
        'response_text',
        'duration_ms',
        'error_message',
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
            'status' => ChunkStatus::class,
            'global_index' => 'integer',
            'section_index' => 'integer',
            'chunk_index' => 'integer',
            'chunk_number' => 'integer',
            'chunks_in_section' => 'integer',
            'marker_number' => 'integer',
            'char_count' => 'integer',
            'line_count' => 'integer',
            'attempt_count' => 'integer',
            'duration_ms' => 'integer',
            'claimed_at' => 'datetime',
            'claim_expires_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'heartbeat_at' => 'datetime',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(ToHtmlJob::class, 'tohtml_job_id');
    }
}
