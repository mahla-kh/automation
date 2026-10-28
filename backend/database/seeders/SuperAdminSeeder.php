<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;
use RuntimeException;

class SuperAdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $getVar = function (string $key, string $default = ''): string {
            $fromGetEnv = getenv($key);
            if ($fromGetEnv !== false) {
                return (string) $fromGetEnv;
            }
            return (string) env($key, $default);
        };

        $name = trim($getVar('SUPER_ADMIN_NAME', 'System Administrator'));
        $rawEmail = $getVar('SUPER_ADMIN_EMAIL', '');
        $password = $getVar('SUPER_ADMIN_PASSWORD', '');


        $email = strtolower(trim($rawEmail));

        if (empty($email) || empty($password)) {
            throw new RuntimeException(
                'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD environment variables are required to seed the initial Super Admin account securely.'
            );
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException("The provided SUPER_ADMIN_EMAIL '{$email}' is not a valid email address.");
        }

        if (strlen($password) < 8) {
            throw new InvalidArgumentException('SUPER_ADMIN_PASSWORD must be at least 8 characters long.');
        }

        $existingUser = User::where('email', $email)->first();

        if ($existingUser) {
            if ($existingUser->role === User::ROLE_SUPER_ADMIN) {
                $this->command?->info("Super Admin account '{$email}' already exists. Skipping creation to preserve existing credentials.");
                return;
            }

            throw new RuntimeException(
                "Conflict: A user with email '{$email}' already exists with role '{$existingUser->role}'. Refusing to automatically elevate privileges."
            );
        }

        User::create([
            'name' => $name ?: 'System Administrator',
            'email' => $email,
            'password' => Hash::make($password),
            'role' => User::ROLE_SUPER_ADMIN,
            'is_active' => true,
        ]);

        $this->command?->info("Super Admin account '{$email}' provisioned successfully.");
    }
}
