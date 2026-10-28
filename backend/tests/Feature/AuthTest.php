<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_valid_login_succeeds_and_updates_last_login(): void
    {
        $user = User::factory()->create([
            'email' => 'doctor@example.com',
            'password' => Hash::make('SecretPass123!'),
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'DOCTOR@example.com ', // tests normalization
            'password' => 'SecretPass123!',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Login successful.')
            ->assertJsonPath('user.email', 'doctor@example.com');

        $this->assertAuthenticatedAs($user);

        $user->refresh();
        $this->assertNotNull($user->last_login_at);
    }

    public function test_invalid_credentials_fail_with_generic_message(): void
    {
        User::factory()->create([
            'email' => 'valid@example.com',
            'password' => Hash::make('CorrectPassword1!'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'valid@example.com',
            'password' => 'WrongPassword!',
        ]);

        $response->assertStatus(401)
            ->assertJsonPath('message', 'The provided credentials do not match our records.');

        $this->assertGuest();
    }

    public function test_non_existent_email_fails_with_same_generic_message(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'nonexistent@example.com',
            'password' => 'SomePassword123!',
        ]);

        $response->assertStatus(401)
            ->assertJsonPath('message', 'The provided credentials do not match our records.');
    }

    public function test_inactive_user_cannot_log_in(): void
    {
        User::factory()->inactive()->create([
            'email' => 'disabled@example.com',
            'password' => Hash::make('SecretPass123!'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'disabled@example.com',
            'password' => 'SecretPass123!',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('message', 'This account has been deactivated. Please contact an administrator.');

        $this->assertGuest();
    }

    public function test_login_rate_limiting_protects_against_brute_force(): void
    {
        RateLimiter::clear('login|target@example.com|127.0.0.1');

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'target@example.com',
                'password' => 'WrongAttempt',
            ])->assertStatus(401);
        }

        // 6th attempt should be throttled
        $response = $this->postJson('/api/auth/login', [
            'email' => 'target@example.com',
            'password' => 'WrongAttempt',
        ]);

        $response->assertStatus(429)
            ->assertJsonStructure(['message', 'retry_after']);
    }

    public function test_logout_invalidates_session(): void
    {
        $user = $this->createTestUser();
        $this->actingAs($user);

        $response = $this->postJson('/api/auth/logout');
        $response->assertStatus(200)
            ->assertJsonPath('message', 'Logged out successfully.');

        $this->assertGuest();
    }

    public function test_me_endpoint_returns_authenticated_user(): void
    {
        $user = $this->createTestUser(['name' => 'Dr. Smith']);
        $this->actingAs($user);

        $response = $this->getJson('/api/auth/me');
        $response->assertStatus(200)
            ->assertJsonPath('user.name', 'Dr. Smith')
            ->assertJsonPath('user.id', $user->id);
    }

    public function test_csrf_endpoint_returns_valid_token(): void
    {
        $response = $this->getJson('/api/auth/csrf');
        $response->assertStatus(200)
            ->assertJsonStructure(['csrf_token']);
    }

    public function test_change_password_validates_current_password_and_updates(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('OldPassword123!'),
        ]);
        $this->actingAs($user);

        // Wrong current password
        $this->postJson('/api/auth/change-password', [
            'current_password' => 'WrongOldPassword',
            'new_password' => 'BrandNewPassword123!',
        ])->assertStatus(422);

        // Correct current password
        $res = $this->postJson('/api/auth/change-password', [
            'current_password' => 'OldPassword123!',
            'new_password' => 'BrandNewPassword123!',
        ]);
        $res->assertStatus(200);

        $user->refresh();
        $this->assertTrue(Hash::check('BrandNewPassword123!', $user->password));
    }
}
