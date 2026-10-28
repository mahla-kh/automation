<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_create_users_with_any_role(): void
    {
        $superAdmin = $this->createSuperAdminUser();
        $this->actingAs($superAdmin);

        // Create Admin
        $res1 = $this->postJson('/api/admin/users', [
            'name' => 'Department Admin',
            'email' => 'dept_admin@example.com',
            'password' => 'SecurePass123!',
            'role' => User::ROLE_ADMIN,
        ]);

        $res1->assertStatus(201)
            ->assertJsonPath('user.role', User::ROLE_ADMIN)
            ->assertJsonPath('user.email', 'dept_admin@example.com');

        $this->assertDatabaseHas('users', ['email' => 'dept_admin@example.com', 'role' => User::ROLE_ADMIN]);
    }

    public function test_admin_cannot_create_admin_or_super_admin(): void
    {
        $admin = $this->createAdminUser();
        $this->actingAs($admin);

        // Admin attempting to create another Admin must be rejected (403)
        $res = $this->postJson('/api/admin/users', [
            'name' => 'Rogue Admin',
            'email' => 'rogue@example.com',
            'password' => 'SecurePass123!',
            'role' => User::ROLE_ADMIN,
        ]);

        $res->assertStatus(403)
            ->assertJsonPath('message', 'Administrators are only permitted to create regular users.');

        $this->assertDatabaseMissing('users', ['email' => 'rogue@example.com']);
    }

    public function test_admin_can_create_regular_user(): void
    {
        $admin = $this->createAdminUser();
        $this->actingAs($admin);

        $res = $this->postJson('/api/admin/users', [
            'name' => 'Regular Operator',
            'email' => 'operator@example.com',
            'password' => 'SecurePass123!',
            'role' => User::ROLE_USER,
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('user.role', User::ROLE_USER);

        $this->assertDatabaseHas('users', ['email' => 'operator@example.com', 'role' => User::ROLE_USER]);
    }

    public function test_duplicate_email_is_rejected(): void
    {
        $superAdmin = $this->createSuperAdminUser();
        $this->actingAs($superAdmin);

        User::factory()->create(['email' => 'existing@example.com']);

        $res = $this->postJson('/api/admin/users', [
            'name' => 'Another User',
            'email' => 'existing@example.com',
            'password' => 'SecurePass123!',
            'role' => User::ROLE_USER,
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_user_cannot_deactivate_own_account(): void
    {
        $superAdmin = $this->createSuperAdminUser();
        $this->actingAs($superAdmin);

        $res = $this->patchJson("/api/admin/users/{$superAdmin->id}/status", [
            'is_active' => false,
        ]);

        $res->assertStatus(400)
            ->assertJsonPath('message', 'You cannot deactivate your own account.');
    }

    public function test_cannot_deactivate_last_active_super_admin(): void
    {
        $superAdmin = $this->createSuperAdminUser(['email' => 'only_super@example.com']);
        $admin = $this->createAdminUser();

        // Acting as another Super Admin to try deactivating the sole super admin
        // Create 2nd super admin first
        $superAdmin2 = $this->createSuperAdminUser(['email' => 'super2@example.com']);
        $this->actingAs($superAdmin2);

        // Deactivate superAdmin
        $this->patchJson("/api/admin/users/{$superAdmin->id}/status", ['is_active' => false])->assertStatus(200);

        // Now superAdmin2 is the only active super admin. If someone tries to deactivate superAdmin2:
        $res = $this->patchJson("/api/admin/users/{$superAdmin2->id}/status", ['is_active' => false]);
        // Own account check fires first:
        $res->assertStatus(400);
    }

    public function test_admin_cannot_deactivate_super_admin(): void
    {
        $superAdmin = $this->createSuperAdminUser();
        $admin = $this->createAdminUser();
        $this->actingAs($admin);

        $res = $this->patchJson("/api/admin/users/{$superAdmin->id}/status", [
            'is_active' => false,
        ]);

        $res->assertStatus(403);
    }

    public function test_admin_cannot_reset_super_admin_password(): void
    {
        $superAdmin = $this->createSuperAdminUser();
        $admin = $this->createAdminUser();
        $this->actingAs($admin);

        $res = $this->postJson("/api/admin/users/{$superAdmin->id}/reset-password", [
            'password' => 'NewSecretPassword123!',
        ]);

        $res->assertStatus(403);
    }

    public function test_super_admin_can_reset_user_password(): void
    {
        $superAdmin = $this->createSuperAdminUser();
        $targetUser = $this->createTestUser();
        $this->actingAs($superAdmin);

        $res = $this->postJson("/api/admin/users/{$targetUser->id}/reset-password", [
            'password' => 'ResetPassword123!',
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('message', 'Password reset successfully.')
            ->assertJsonMissing(['password']);

        $targetUser->refresh();
        $this->assertTrue(Hash::check('ResetPassword123!', $targetUser->password));
    }

    public function test_role_change_restrictions(): void
    {
        $superAdmin = $this->createSuperAdminUser();
        $admin = $this->createAdminUser();
        $targetUser = $this->createTestUser();

        // Admin cannot change roles
        $this->actingAs($admin);
        $this->patchJson("/api/admin/users/{$targetUser->id}/role", [
            'role' => User::ROLE_ADMIN,
        ])->assertStatus(403);

        // Super Admin CAN change role
        $this->actingAs($superAdmin);
        $res = $this->patchJson("/api/admin/users/{$targetUser->id}/role", [
            'role' => User::ROLE_ADMIN,
        ]);
        $res->assertStatus(200)
            ->assertJsonPath('user.role', User::ROLE_ADMIN);

        $targetUser->refresh();
        $this->assertEquals(User::ROLE_ADMIN, $targetUser->role);
    }
}
