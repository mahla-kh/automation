<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContractTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $user = $this->createTestUser();
        $this->actingAs($user);
    }

    public function test_endpoints_reject_unauthenticated_requests(): void
    {
        auth()->logout();

        $this->postJson('/api/pipelines/start', [])->assertStatus(401);
        $this->getJson('/api/pipelines/status')->assertStatus(401);
        $this->postJson('/api/tohtml/start', [])->assertStatus(401);
        $this->getJson('/api/processes')->assertStatus(401);
    }

    public function test_pipeline_start_requires_folder_url(): void
    {
        $response = $this->postJson('/api/pipelines/start', []);

        $response->assertStatus(400)
            ->assertExactJson([
                'error' => 'Folder URL is required',
            ]);
    }

    public function test_pipeline_status_returns_404_when_job_not_found(): void
    {
        $response = $this->getJson('/api/pipelines/status?id=non-existent-id');

        $response->assertStatus(404)
            ->assertExactJson([
                'error' => 'Job not found',
            ]);
    }

    public function test_pipeline_download_requires_parameters(): void
    {
        $response = $this->getJson('/api/pipelines/download');

        $response->assertStatus(400)
            ->assertExactJson([
                'error' => 'jobId and fileId query parameters are required',
            ]);
    }

    public function test_pipeline_merge_requires_job_id(): void
    {
        $response = $this->getJson('/api/pipelines/merge');

        $response->assertStatus(400)
            ->assertExactJson([
                'error' => 'jobId query parameter is required',
            ]);
    }

    public function test_tohtml_start_validates_required_fields(): void
    {
        $response = $this->postJson('/api/tohtml/start', [
            'fileName' => '',
            'prompt' => 'test',
            'sections' => [],
        ]);

        $response->assertStatus(400)
            ->assertExactJson([
                'error' => 'fileName is required and must be a string',
            ]);
    }

    public function test_tohtml_status_returns_404_when_job_not_found(): void
    {
        $response = $this->getJson('/api/tohtml/status?id=test-id');

        $response->assertStatus(404)
            ->assertExactJson([
                'error' => 'Job not found: test-id',
            ]);
    }

    public function test_tohtml_retry_requires_job_id(): void
    {
        $response = $this->postJson('/api/tohtml/retry', []);

        $response->assertStatus(400)
            ->assertExactJson([
                'error' => 'jobId is required and must be a string',
            ]);
    }

    public function test_tohtml_download_requires_job_id(): void
    {
        $response = $this->getJson('/api/tohtml/download');

        $response->assertStatus(400)
            ->assertExactJson([
                'error' => 'jobId query parameter is required',
            ]);
    }

    public function test_tohtml_start_generates_unique_folder_name_when_duplicate_exists(): void
    {
        $payload = [
            'fileName' => 'خلاصه کلیه 1.txt',
            'prompt' => 'Test Prompt',
            'sections' => [
                ['marker' => 'CUT 1', 'content' => 'Sample content'],
            ],
        ];

        $res1 = $this->postJson('/api/tohtml/start', $payload);
        $res1->assertStatus(200);

        $res2 = $this->postJson('/api/tohtml/start', $payload);
        $res2->assertStatus(200);

        $this->assertNotEquals($res1->json('jobId'), $res2->json('jobId'));
    }
}
