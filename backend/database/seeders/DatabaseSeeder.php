<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        if (env('SUPER_ADMIN_EMAIL') && env('SUPER_ADMIN_PASSWORD')) {
            $this->call(SuperAdminSeeder::class);
        }
    }
}
