<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WorkflowProcess;
use App\Models\WorkflowProcessFile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/processes')->assertStatus(401);
        $this->postJson('/api/processes', ['name' => 'Test', 'type' => 'summary'])->assertStatus(401);
        $this->getJson('/api/admin/users')->assertStatus(401);
    }

    public function test_regular_user_cannot_access_admin_endpoints(): void
    {
        $user = $this->createTestUser();
        $this->actingAs($user);

        $this->getJson('/api/admin/users')->assertStatus(403);
        $this->postJson('/api/admin/users', [
            'name' => 'Someone',
            'email' => 'someone@example.com',
            'password' => 'Password123!',
            'role' => 'USER',
        ])->assertStatus(403);
    }

    public function test_admin_and_super_admin_can_access_admin_user_list(): void
    {
        $admin = $this->createAdminUser();
        $this->actingAs($admin);
        $this->getJson('/api/admin/users')->assertStatus(200);

        $superAdmin = $this->createSuperAdminUser();
        $this->actingAs($superAdmin);
        $this->getJson('/api/admin/users')->assertStatus(200);
    }

    public function test_user_process_ownership_isolation(): void
    {
        $userA = $this->createTestUser(['email' => 'userA@example.com']);
        $userB = $this->createTestUser(['email' => 'userB@example.com']);

        // Process owned by User B
        $processB = WorkflowProcess::create([
            'id' => (string) Str::uuid(),
            'user_id' => $userB->id,
            'name' => 'Secret Process of B',
            'type' => 'detailed_answer',
            'status' => 'in_progress',
        ]);

        $fileB = WorkflowProcessFile::create([
            'id' => (string) Str::uuid(),
            'workflow_process_id' => $processB->id,
            'step_id' => 'extract_text',
            'original_name' => 'confidential.txt',
            'storage_path' => "processes/{$processB->id}/extract_text/confidential.txt",
            'file_type' => 'output',
            'file_size' => 128,
        ]);

        // Act as User A
        $this->actingAs($userA);

        // User A cannot see User B's process in listing
        $resList = $this->getJson('/api/processes');
        $resList->assertStatus(200);
        $this->assertEmpty($resList->json('incomplete'));

        // User A cannot view User B's process details
        $this->getJson("/api/processes/{$processB->id}")->assertStatus(403);

        // User A cannot update step on User B's process
        $this->postJson("/api/processes/{$processB->id}/step", [
            'step_id' => 'extract_text',
            'action' => 'complete',
        ])->assertStatus(403);

        // User A cannot download file from User B's process
        $this->getJson("/api/processes/{$processB->id}/download/{$fileB->id}")->assertStatus(403);

        // User A cannot delete User B's process
        $this->deleteJson("/api/processes/{$processB->id}")->assertStatus(403);

        // Administrator CAN view User B's process
        $admin = $this->createAdminUser();
        $this->actingAs($admin);
        $this->getJson("/api/processes/{$processB->id}")->assertStatus(200);
    }

    public function test_deactivated_user_is_blocked_by_active_middleware(): void
    {
        $user = $this->createTestUser(['is_active' => false]);
        $this->actingAs($user);

        $response = $this->getJson('/api/processes');
        $response->assertStatus(403)
            ->assertJsonPath('message', 'This account has been deactivated. Please contact an administrator.');

        $this->assertGuest();
    }
}
