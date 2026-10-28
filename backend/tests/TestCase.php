<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Create a standard active test user.
     */
    protected function createTestUser(array $attributes = []): User
    {
        return User::factory()->create($attributes);
    }

    /**
     * Create an administrator test user.
     */
    protected function createAdminUser(array $attributes = []): User
    {
        return User::factory()->admin()->create($attributes);
    }

    /**
     * Create a super administrator test user.
     */
    protected function createSuperAdminUser(array $attributes = []): User
    {
        return User::factory()->superAdmin()->create($attributes);
    }
}
