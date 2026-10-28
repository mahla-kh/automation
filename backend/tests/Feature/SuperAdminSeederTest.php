<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\SuperAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

class SuperAdminSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_super_admin_from_environment_variables(): void
    {
        putenv('SUPER_ADMIN_NAME=Root Administrator');
        putenv('SUPER_ADMIN_EMAIL=root@wepass.local');
        putenv('SUPER_ADMIN_PASSWORD=RootPassword123!');

        $this->seed(SuperAdminSeeder::class);

        $admin = User::where('email', 'root@wepass.local')->first();

        $this->assertNotNull($admin);
        $this->assertEquals('Root Administrator', $admin->name);
        $this->assertEquals(User::ROLE_SUPER_ADMIN, $admin->role);
        $this->assertTrue($admin->is_active);
        $this->assertTrue(Hash::check('RootPassword123!', $admin->password));
    }

    public function test_seeder_is_idempotent_and_does_not_overwrite_existing_account(): void
    {
        putenv('SUPER_ADMIN_NAME=First Admin');
        putenv('SUPER_ADMIN_EMAIL=super@example.com');
        putenv('SUPER_ADMIN_PASSWORD=FirstPassword123!');

        $this->seed(SuperAdminSeeder::class);

        $initialUser = User::where('email', 'super@example.com')->first();
        $this->assertNotNull($initialUser);

        // Run seeder again with different password
        putenv('SUPER_ADMIN_PASSWORD=SecondPassword999!');
        $this->seed(SuperAdminSeeder::class);

        $this->assertEquals(1, User::where('email', 'super@example.com')->count());

        $reloaded = User::where('email', 'super@example.com')->first();
        // Password must NOT be overwritten silently
        $this->assertTrue(Hash::check('FirstPassword123!', $reloaded->password));
    }

    public function test_seeder_fails_when_password_or_email_is_missing(): void
    {
        putenv('SUPER_ADMIN_EMAIL=');
        putenv('SUPER_ADMIN_PASSWORD=');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD environment variables are required');

        $this->seed(SuperAdminSeeder::class);
    }

    public function test_seeder_fails_safely_on_conflict_with_non_super_admin(): void
    {
        // Existing regular USER with the target email
        User::factory()->create([
            'email' => 'conflict@example.com',
            'role' => User::ROLE_USER,
            'password' => Hash::make('UserSecret123!'),
        ]);

        putenv('SUPER_ADMIN_EMAIL=conflict@example.com');
        putenv('SUPER_ADMIN_PASSWORD=SuperSecret123!');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Conflict: A user with email');

        $this->seed(SuperAdminSeeder::class);

        // Verify the user was NOT silently elevated
        $user = User::where('email', 'conflict@example.com')->first();
        $this->assertEquals(User::ROLE_USER, $user->role);
    }
}
