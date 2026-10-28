<?php

namespace Tests\Feature;

use App\Models\WorkflowProcess;
use App\Models\WorkflowProcessFile;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class WorkflowProcessTest extends TestCase
{
    use RefreshDatabase;

    protected \App\Models\User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = $this->createTestUser();
        $this->actingAs($this->user);
    }

    public function test_can_create_detailed_answer_process(): void
    {
        $response = $this->postJson('/api/processes', [
            'name' => 'پاسخ تشریحی آزمون قلب ۱۴۰۳',
            'type' => 'detailed_answer',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'پاسخ تشریحی آزمون قلب ۱۴۰۳')
            ->assertJsonPath('type', 'detailed_answer')
            ->assertJsonPath('status', 'in_progress')
            ->assertJsonPath('total_steps_count', 12)
            ->assertJsonPath('completed_steps_count', 0)
            ->assertJsonPath('progress_percentage', 0);

        $this->assertDatabaseHas('workflow_processes', [
            'name' => 'پاسخ تشریحی آزمون قلب ۱۴۰۳',
            'type' => 'detailed_answer',
        ]);
    }

    public function test_can_create_summary_process(): void
    {
        $response = $this->postJson('/api/processes', [
            'name' => 'خلاصه فیزیولوژی کلیه',
            'type' => 'summary',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'خلاصه فیزیولوژی کلیه')
            ->assertJsonPath('type', 'summary')
            ->assertJsonPath('status', 'in_progress')
            ->assertJsonPath('total_steps_count', 7)
            ->assertJsonPath('completed_steps_count', 0);
    }

    public function test_create_validates_required_fields(): void
    {
        $res1 = $this->postJson('/api/processes', [
            'name' => '   ',
            'type' => 'detailed_answer',
        ]);
        $res1->assertStatus(422);

        $res2 = $this->postJson('/api/processes', [
            'name' => 'Valid Name',
            'type' => 'invalid_type',
        ]);
        $res2->assertStatus(422);
    }

    public function test_lists_incomplete_and_completed_processes(): void
    {
        $incomplete = WorkflowProcess::create([
            'user_id' => $this->user->id,
            'name' => 'Incomplete Process',
            'type' => 'detailed_answer',
            'status' => 'in_progress',
            'progress_percentage' => 20,
        ]);

        $completed = WorkflowProcess::create([
            'user_id' => $this->user->id,
            'name' => 'Completed Process',
            'type' => 'summary',
            'status' => 'completed',
            'progress_percentage' => 100,
            'completed_at' => Carbon::now(),
            'expires_at' => Carbon::now()->addDays(2),
        ]);

        $resAll = $this->getJson('/api/processes');
        $resAll->assertStatus(200)
            ->assertJsonCount(1, 'incomplete')
            ->assertJsonCount(1, 'completed');

        $resIncomplete = $this->getJson('/api/processes?status=incomplete');
        $resIncomplete->assertStatus(200)
            ->assertJsonCount(1);

        $resCompleted = $this->getJson('/api/processes?status=completed');
        $resCompleted->assertStatus(200)
            ->assertJsonCount(1);
    }

    public function test_show_process_returns_404_for_unknown_id(): void
    {
        $response = $this->getJson('/api/processes/non-existent-uuid');
        $response->assertStatus(404);
    }

    public function test_step_progress_and_branch_selection_detailed_answer(): void
    {
        $createRes = $this->postJson('/api/processes', [
            'name' => 'تست شاخه و پیشرفت',
            'type' => 'detailed_answer',
        ]);
        $id = $createRes->json('id');

        // Step 1: Complete step 1
        $step1Res = $this->postJson("/api/processes/{$id}/step", [
            'step_id' => 'step_1_ocr',
            'action' => 'complete',
            'inputs' => ['drive_folder_url' => 'https://drive.google.com/test'],
        ]);
        $step1Res->assertStatus(200)
            ->assertJsonPath('completed_steps_count', 1)
            ->assertJsonPath('progress_percentage', 8); // 1/12 = 8%

        // Cannot skip to step 5 without completing steps 2, 3, 4
        $skipRes = $this->postJson("/api/processes/{$id}/step", [
            'step_id' => 'step_5_claude_organize',
            'action' => 'complete',
        ]);
        $skipRes->assertStatus(422);

        // Complete step 2
        $this->postJson("/api/processes/{$id}/step", [
            'step_id' => 'step_2_drive_upload',
            'action' => 'complete',
        ])->assertStatus(200);

        // Complete step 3
        $this->postJson("/api/processes/{$id}/step", [
            'step_id' => 'step_3_engin_questions',
            'action' => 'complete',
        ])->assertStatus(200);

        // Step 4: Select branch path_a
        $branchRes = $this->postJson("/api/processes/{$id}/step", [
            'step_id' => 'step_4_topics',
            'action' => 'select_branch',
            'selected_branch' => 'path_a',
        ]);
        $branchRes->assertStatus(200)
            ->assertJsonPath('selected_branch', 'path_a');

        // Complete step 4
        $step4Res = $this->postJson("/api/processes/{$id}/step", [
            'step_id' => 'step_4_topics',
            'action' => 'complete',
        ]);
        $step4Res->assertStatus(200)
            ->assertJsonPath('completed_steps_count', 4);
    }

    public function test_summary_prerequisites_and_completion_sets_two_day_expiration(): void
    {
        $createRes = $this->postJson('/api/processes', [
            'name' => 'خلاصه آزمون جامع',
            'type' => 'summary',
        ]);
        $id = $createRes->json('id');

        // Mark prerequisites 0A and 0B as already satisfied
        $this->postJson("/api/processes/{$id}/step", [
            'step_id' => 'step_0a_notes',
            'action' => 'mark_satisfied',
            'already_satisfied' => true,
        ])->assertStatus(200);

        $this->postJson("/api/processes/{$id}/step", [
            'step_id' => 'step_0b_drive',
            'action' => 'mark_satisfied',
            'already_satisfied' => true,
        ])->assertStatus(200);

        // Complete remaining steps 1 through 7
        $steps = [
            'step_1_upload_answers',
            'step_2_notebook_prompts',
            'step_3_merge_answers',
            'step_4_tohtml',
            'step_5_html_cleanup',
            'step_6_website_upload',
            'step_7_pdf_export',
        ];

        foreach ($steps as $idx => $stepId) {
            $res = $this->postJson("/api/processes/{$id}/step", [
                'step_id' => $stepId,
                'action' => 'complete',
            ]);
            $res->assertStatus(200);
        }

        $process = WorkflowProcess::find($id);
        $this->assertEquals('completed', $process->status);
        $this->assertEquals(100, $process->progress_percentage);
        $this->assertNotNull($process->completed_at);
        $this->assertNotNull($process->expires_at);

        // Verify expires_at is approximately 2 days from completed_at
        $diffHours = $process->completed_at->diffInHours($process->expires_at);
        $this->assertEquals(48, $diffHours);
    }

    public function test_cleanup_expired_workflow_files_command(): void
    {
        $process = WorkflowProcess::create([
            'name' => 'Expired Process',
            'type' => 'summary',
            'status' => 'completed',
            'progress_percentage' => 100,
            'completed_at' => Carbon::now()->subDays(3),
            'expires_at' => Carbon::now()->subDay(), // Expired 1 day ago
        ]);

        $testDir = storage_path("app/private/processes/{$process->id}/step_1");
        File::makeDirectory($testDir, 0755, true);
        file_put_contents("{$testDir}/test_output.txt", "Sample expired content");

        $this->assertFileExists("{$testDir}/test_output.txt");

        // Run cleanup command
        $exitCode = Artisan::call('automation:cleanup-expired');
        $this->assertEquals(0, $exitCode);

        // Verify file was cleaned up
        $this->assertFileDoesNotExist("{$testDir}/test_output.txt");

        // Verify process record remains intact with files_purged_at recorded
        $process->refresh();
        $this->assertNotNull($process->files_purged_at);
        $this->assertEquals('completed', $process->status);
    }

    public function test_delete_process_removes_record_and_files(): void
    {
        $createRes = $this->postJson('/api/processes', [
            'name' => 'To Be Deleted',
            'type' => 'detailed_answer',
        ]);
        $id = $createRes->json('id');

        $testDir = storage_path("app/private/processes/{$id}");
        File::ensureDirectoryExists($testDir);
        file_put_contents("{$testDir}/file.txt", "content");

        $delRes = $this->deleteJson("/api/processes/{$id}");
        $delRes->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('workflow_processes', ['id' => $id]);
        $this->assertDirectoryDoesNotExist($testDir);
    }
}
