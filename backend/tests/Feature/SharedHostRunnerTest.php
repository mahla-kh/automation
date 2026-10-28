<?php

namespace Tests\Feature;

use App\Enums\ChunkStatus;
use App\Enums\JobStatus;
use App\Enums\StageStatus;
use App\Models\PipelineJob;
use App\Models\PipelineJobFile;
use App\Models\ToHtmlJob;
use App\Models\ToHtmlJobChunk;
use App\Services\Ai\DeepSeekClient;
use App\Services\Ai\OcrProvider;
use App\Services\Drive\DriveGateway;
use App\Services\Queue\SharedHostRunner;
use App\Services\Storage\OutputStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class SharedHostRunnerTest extends TestCase
{
    use RefreshDatabase;

    private $mockDrive;
    private $mockOcr;
    private $mockDeepseek;
    private SharedHostRunner $runner;

    protected function setUp(): void
    {
        parent::setUp();

        $admin = $this->createAdminUser();
        $this->actingAs($admin);

        $this->mockDrive = Mockery::mock(DriveGateway::class);
        $this->mockOcr = Mockery::mock(OcrProvider::class);
        $this->mockDeepseek = Mockery::mock(DeepSeekClient::class);

        $this->runner = new SharedHostRunner(
            $this->mockDrive,
            $this->mockOcr,
            $this->mockDeepseek
        );
    }

    public function test_runner_claims_and_processes_drive_file_successfully(): void
    {
        $job = PipelineJob::create([
            'folder_id' => 'test-folder-id',
            'folder_url' => 'https://drive.google.com/drive/folders/test-folder-id',
            'status' => JobStatus::Processing,
            'total_files' => 1,
            'started_at' => now(),
        ]);

        $file = PipelineJobFile::create([
            'pipeline_job_id' => $job->id,
            'drive_file_id' => 'file-abc-123',
            'file_name' => 'test_document.pdf',
            'position' => 0,
            'overall_status' => StageStatus::Pending,
        ]);

        $this->mockDrive->shouldReceive('download')
            ->once()
            ->andReturnUsing(function ($fileId, $dest) {
                if (!is_dir(dirname($dest))) {
                    mkdir(dirname($dest), 0755, true);
                }
                file_put_contents($dest, '%PDF-1.4 mock content');
                return $dest;
            });

        $this->mockOcr->shouldReceive('extract')
            ->once()
            ->andReturn("Mocked Persian/English OCR Text\nLine 2");

        $result = $this->runner->run(maxExecutionTime: 10, maxUnits: 5, queue: 'drive-ocr');

        $this->assertEquals(1, $result['processed']);
        $this->assertEquals(0, $result['failed']);

        $file->refresh();
        $this->assertEquals(StageStatus::Success, $file->overall_status);
        $this->assertEquals(StageStatus::Success, $file->download_status);
        $this->assertEquals(StageStatus::Success, $file->ocr_status);
        $this->assertEquals(StageStatus::Success, $file->upload_status);
        $this->assertStringContainsString('Mocked Persian/English OCR Text', $file->result);
        $this->assertNull($file->claim_token);

        $job->refresh();
        $this->assertEquals(JobStatus::Completed, $job->status);
    }

    public function test_runner_claims_and_processes_tohtml_chunk_successfully(): void
    {
        $job = ToHtmlJob::create([
            'file_name' => 'booklet.txt',
            'folder_name' => 'tohtml-test-booklet',
            'prompt' => 'Transform into HTML booklet',
            'max_lines_per_chunk' => 600,
            'total_sections' => 1,
            'total_chunks' => 1,
            'status' => JobStatus::Processing,
            'started_at' => now(),
        ]);

        $chunk = ToHtmlJobChunk::create([
            'tohtml_job_id' => $job->id,
            'global_index' => 0,
            'section_index' => 0,
            'chunk_index' => 0,
            'chunk_number' => 1,
            'chunks_in_section' => 1,
            'marker' => 'CUT-1',
            'label' => 'CUT-1 — Chunk 1/1',
            'content' => 'Chapter 1: Persian Introduction',
            'char_count' => 31,
            'line_count' => 1,
            'status' => ChunkStatus::Pending,
        ]);

        $this->mockDeepseek->shouldReceive('chat')
            ->once()
            ->andReturn('<section><h1>Chapter 1</h1><p>Persian Introduction</p></section>');

        $result = $this->runner->run(maxExecutionTime: 10, maxUnits: 5, queue: 'deepseek');

        $this->assertEquals(1, $result['processed']);
        $this->assertEquals(0, $result['failed']);

        $chunk->refresh();
        $this->assertEquals(ChunkStatus::Completed, $chunk->status);
        $this->assertStringContainsString('<section>', $chunk->response_text);
        $this->assertNull($chunk->claim_token);

        $job->refresh();
        $this->assertEquals(JobStatus::Completed, $job->status);
    }

    public function test_runner_exits_cleanly_when_execution_budget_is_exhausted(): void
    {
        $job = ToHtmlJob::create([
            'file_name' => 'large_booklet.txt',
            'folder_name' => 'tohtml-large',
            'prompt' => 'Process',
            'max_lines_per_chunk' => 600,
            'total_sections' => 5,
            'total_chunks' => 5,
            'status' => JobStatus::Processing,
        ]);

        for ($i = 0; $i < 5; $i++) {
            ToHtmlJobChunk::create([
                'tohtml_job_id' => $job->id,
                'global_index' => $i,
                'section_index' => $i,
                'chunk_index' => 0,
                'chunk_number' => 1,
                'chunks_in_section' => 1,
                'marker' => "CUT-{$i}",
                'label' => "CUT-{$i}",
                'content' => "Content {$i}",
                'status' => ChunkStatus::Pending,
            ]);
        }

        $this->mockDeepseek->shouldReceive('chat')->andReturn('Processed content');

        // Budget of 0 seconds with safety buffer will timeout immediately after 0 or 1 item
        $result = $this->runner->run(maxExecutionTime: 1, maxUnits: 5, queue: 'deepseek');

        $this->assertTrue($result['timed_out']);
        $this->assertLessThan(5, $result['processed']);

        // Remaining chunks must still be pending
        $remaining = ToHtmlJobChunk::where('status', ChunkStatus::Pending)->count();
        $this->assertGreaterThan(0, $remaining);
    }

    public function test_overlapping_invocations_cannot_claim_same_unit(): void
    {
        $job = ToHtmlJob::create([
            'file_name' => 'concurrent.txt',
            'folder_name' => 'tohtml-concurrent',
            'prompt' => 'Process',
            'max_lines_per_chunk' => 600,
            'total_sections' => 1,
            'total_chunks' => 1,
            'status' => JobStatus::Processing,
        ]);

        $chunk = ToHtmlJobChunk::create([
            'tohtml_job_id' => $job->id,
            'global_index' => 0,
            'section_index' => 0,
            'chunk_index' => 0,
            'chunk_number' => 1,
            'chunks_in_section' => 1,
            'marker' => 'CUT-1',
            'label' => 'CUT-1',
            'content' => 'Content',
            'status' => ChunkStatus::Pending,
        ]);

        $claimed1 = $this->runner->claimNextToHtmlChunk('worker-token-1', 120);
        $this->assertNotNull($claimed1);
        $this->assertEquals($chunk->id, $claimed1->id);

        // Second concurrent worker attempts to claim
        $claimed2 = $this->runner->claimNextToHtmlChunk('worker-token-2', 120);
        $this->assertNull($claimed2, 'Second concurrent invocation must not claim already-leased item');
    }

    public function test_expired_lease_recovers_abandoned_work(): void
    {
        $job = ToHtmlJob::create([
            'file_name' => 'abandoned.txt',
            'folder_name' => 'tohtml-abandoned',
            'prompt' => 'Process',
            'max_lines_per_chunk' => 600,
            'total_sections' => 1,
            'total_chunks' => 1,
            'status' => JobStatus::Processing,
        ]);

        $chunk = ToHtmlJobChunk::create([
            'tohtml_job_id' => $job->id,
            'global_index' => 0,
            'section_index' => 0,
            'chunk_index' => 0,
            'chunk_number' => 1,
            'chunks_in_section' => 1,
            'marker' => 'CUT-1',
            'label' => 'CUT-1',
            'content' => 'Content',
            'status' => ChunkStatus::Processing,
            'claimed_at' => now()->subMinutes(10),
            'claim_token' => 'dead-worker-uuid',
            'claim_expires_at' => now()->subMinutes(5), // Expired!
        ]);

        $recoveredCount = $this->runner->reconcileStaleClaims();
        $this->assertEquals(1, $recoveredCount);

        $chunk->refresh();
        $this->assertEquals(ChunkStatus::Pending, $chunk->status);
        $this->assertNull($chunk->claim_token);
        $this->assertNull($chunk->claim_expires_at);
    }

    public function test_failed_item_can_be_retried_individually_without_restarting_completed_items(): void
    {
        $job = ToHtmlJob::create([
            'file_name' => 'retry_test.txt',
            'folder_name' => 'tohtml-retry',
            'prompt' => 'Process',
            'max_lines_per_chunk' => 600,
            'total_sections' => 2,
            'total_chunks' => 2,
            'status' => JobStatus::Processing,
        ]);

        // Chunk 0 is already completed
        $chunk0 = ToHtmlJobChunk::create([
            'tohtml_job_id' => $job->id,
            'global_index' => 0,
            'section_index' => 0,
            'chunk_index' => 0,
            'chunk_number' => 1,
            'chunks_in_section' => 1,
            'marker' => 'CUT-1',
            'label' => 'CUT-1',
            'content' => 'Completed content',
            'status' => ChunkStatus::Completed,
            'response_text' => '<p>Completed</p>',
            'output_filename' => '0001-CUT-1-chunk-1.txt',
        ]);

        // Chunk 1 failed
        $chunk1 = ToHtmlJobChunk::create([
            'tohtml_job_id' => $job->id,
            'global_index' => 1,
            'section_index' => 1,
            'chunk_index' => 0,
            'chunk_number' => 1,
            'chunks_in_section' => 1,
            'marker' => 'CUT-2',
            'label' => 'CUT-2',
            'content' => 'Failing content',
            'status' => ChunkStatus::Failed,
            'error_message' => 'Upstream rate limit',
        ]);

        \Illuminate\Support\Facades\Queue::fake([\App\Jobs\ProcessToHtmlChunkJob::class]);

        // Retry only chunk 1 via API endpoint
        $response = $this->postJson('/api/tohtml/retry', [
            'jobId' => $job->id,
            'sectionIndex' => 1,
        ]);

        $response->assertStatus(200);

        $chunk1->refresh();
        $this->assertEquals(ChunkStatus::Pending, $chunk1->status);

        // Chunk 0 remains untouched
        $chunk0->refresh();
        $this->assertEquals(ChunkStatus::Completed, $chunk0->status);
    }

    public function test_artisan_command_executes_successfully(): void
    {
        $this->artisan('automation:process', [
            '--max-time' => 5,
            '--max-units' => 2,
            '--queue' => 'all',
        ])
        ->expectsOutputToContain('Starting shared-host worker run')
        ->assertSuccessful();
    }

    public function test_stale_claim_token_rejection_prevents_stale_worker_from_overwriting_reassigned_chunk(): void
    {
        $job = ToHtmlJob::create([
            'file_name' => 'stale_token.txt',
            'folder_name' => 'tohtml-stale',
            'prompt' => 'Process',
            'max_lines_per_chunk' => 600,
            'total_sections' => 1,
            'total_chunks' => 1,
            'status' => JobStatus::Processing,
        ]);

        $chunk = ToHtmlJobChunk::create([
            'tohtml_job_id' => $job->id,
            'global_index' => 0,
            'section_index' => 0,
            'chunk_index' => 0,
            'chunk_number' => 1,
            'chunks_in_section' => 1,
            'marker' => 'CUT-1',
            'label' => 'CUT-1',
            'content' => 'Chunk content',
            'status' => ChunkStatus::Processing,
            'claim_token' => 'worker-2-token',
            'claimed_at' => now(),
            'claim_expires_at' => now()->addMinutes(2),
        ]);

        $this->mockDeepseek->shouldReceive('chat')
            ->once()
            ->andReturn('<p>Stale Worker Output</p>');

        // Worker 1 attempts to complete using expired/superseded token 'worker-1-token'
        $success = $this->runner->processToHtmlChunk($chunk, expectedToken: 'worker-1-token');

        $this->assertFalse($success, 'Stale worker completion must be rejected');

        $chunk->refresh();
        // Chunk status must NOT be Completed by Worker 1; must still have worker-2-token
        $this->assertEquals(ChunkStatus::Processing, $chunk->status);
        $this->assertEquals('worker-2-token', $chunk->claim_token);
        $this->assertNull($chunk->response_text);
    }

    public function test_stale_claim_token_rejection_prevents_stale_worker_from_overwriting_reassigned_drive_file(): void
    {
        $job = PipelineJob::create([
            'folder_id' => 'stale-folder',
            'folder_url' => 'https://drive.google.com/drive/folders/stale-folder',
            'status' => JobStatus::Processing,
            'total_files' => 1,
        ]);

        $file = PipelineJobFile::create([
            'pipeline_job_id' => $job->id,
            'drive_file_id' => 'stale-file-123',
            'file_name' => 'stale.pdf',
            'position' => 0,
            'overall_status' => StageStatus::InProgress,
            'download_status' => StageStatus::Success,
            'ocr_status' => StageStatus::Success,
            'result' => 'Valid OCR Text',
            'claim_token' => 'worker-2-token',
            'claimed_at' => now(),
            'claim_expires_at' => now()->addMinutes(2),
        ]);

        // Worker 1 attempts to finalize using superseded token 'worker-1-token'
        $success = $this->runner->processDriveFile($file, expectedToken: 'worker-1-token');

        $this->assertFalse($success, 'Stale drive worker completion must be rejected');

        $file->refresh();
        $this->assertEquals(StageStatus::InProgress, $file->overall_status);
        $this->assertEquals('worker-2-token', $file->claim_token);
    }

    public function test_abandoned_chunk_fails_terminally_after_maximum_attempts(): void
    {
        $job = ToHtmlJob::create([
            'file_name' => 'max_attempts.txt',
            'folder_name' => 'tohtml-max-attempts',
            'prompt' => 'Process',
            'max_lines_per_chunk' => 600,
            'total_sections' => 1,
            'total_chunks' => 1,
            'status' => JobStatus::Processing,
        ]);

        $chunk = ToHtmlJobChunk::create([
            'tohtml_job_id' => $job->id,
            'global_index' => 0,
            'section_index' => 0,
            'chunk_index' => 0,
            'chunk_number' => 1,
            'chunks_in_section' => 1,
            'marker' => 'CUT-1',
            'label' => 'CUT-1',
            'content' => 'Content',
            'status' => ChunkStatus::Processing,
            'attempt_count' => 3, // Already attempted 3 times
            'claimed_at' => now()->subMinutes(10),
            'claim_token' => 'dead-worker-uuid',
            'claim_expires_at' => now()->subMinutes(5), // Expired
        ]);

        $recovered = $this->runner->reconcileStaleClaims();
        $this->assertEquals(1, $recovered);

        $chunk->refresh();
        $this->assertEquals(ChunkStatus::Failed, $chunk->status);
        $this->assertStringContainsString('exceeded maximum lease recovery attempts', $chunk->error_message);
        $this->assertNull($chunk->claim_token);
        $this->assertNull($chunk->claim_expires_at);
    }

    public function test_tohtml_merge_rejects_when_no_completed_chunks_and_merges_safely(): void
    {
        $job = ToHtmlJob::create([
            'file_name' => 'partial_merge.txt',
            'folder_name' => 'tohtml-partial',
            'prompt' => 'Process',
            'max_lines_per_chunk' => 600,
            'total_sections' => 2,
            'total_chunks' => 2,
            'status' => JobStatus::Processing,
        ]);

        $chunk0 = ToHtmlJobChunk::create([
            'tohtml_job_id' => $job->id,
            'global_index' => 0,
            'section_index' => 0,
            'chunk_index' => 0,
            'chunk_number' => 1,
            'chunks_in_section' => 1,
            'marker' => 'CUT-1',
            'label' => 'CUT-1',
            'content' => 'Content 1',
            'status' => ChunkStatus::Pending,
        ]);

        $chunk1 = ToHtmlJobChunk::create([
            'tohtml_job_id' => $job->id,
            'global_index' => 1,
            'section_index' => 1,
            'chunk_index' => 0,
            'chunk_number' => 1,
            'chunks_in_section' => 1,
            'marker' => 'CUT-2',
            'label' => 'CUT-2',
            'content' => 'Content 2',
            'status' => ChunkStatus::Pending,
        ]);

        // Attempting to download merged when 0 chunks are completed must return 400
        $response = $this->getJson("/api/tohtml/download?jobId={$job->id}&merged=true");
        $response->assertStatus(400);
        $response->assertJsonFragment(['error' => 'No completed section output files available to merge']);

        // Now complete Chunk 0
        $chunk0->update([
            'status' => ChunkStatus::Completed,
            'response_text' => '<p>Section 1</p>',
            'output_filename' => '0001-CUT-1-chunk-1.txt',
        ]);
        OutputStorage::writeText($job->folder_name, '0001-CUT-1-chunk-1.txt', '<p>Section 1</p>');

        // Partial merge succeeds with available completed chunks
        $responsePartial = $this->getJson("/api/tohtml/download?jobId={$job->id}&merged=true");
        $responsePartial->assertStatus(200);
        $this->assertStringContainsString('Section 1', $responsePartial->getContent());
        $this->assertStringNotContainsString('Section 2', $responsePartial->getContent());

        // Now complete Chunk 1
        $chunk1->update([
            'status' => ChunkStatus::Completed,
            'response_text' => '<p>Section 2</p>',
            'output_filename' => '0002-CUT-2-chunk-1.txt',
        ]);
        OutputStorage::writeText($job->folder_name, '0002-CUT-2-chunk-1.txt', '<p>Section 2</p>');

        // Now full merged download returns both sections in order
        $responseFull = $this->getJson("/api/tohtml/download?jobId={$job->id}&merged=true");
        $responseFull->assertStatus(200);
        $this->assertStringContainsString('Section 1', $responseFull->getContent());
        $this->assertStringContainsString('Section 2', $responseFull->getContent());
    }
}

