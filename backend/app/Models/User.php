<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    public const ROLE_SUPER_ADMIN = 'SUPER_ADMIN';
    public const ROLE_ADMIN = 'ADMIN';
    public const ROLE_USER = 'USER';

    public const ROLES = [
        self::ROLE_SUPER_ADMIN,
        self::ROLE_ADMIN,
        self::ROLE_USER,
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_active',
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    /**
     * Check if user is a Super Admin.
     */
    public function isSuperAdmin(): bool
    {
        return $this->role === self::ROLE_SUPER_ADMIN;
    }

    /**
     * Check if user is an Admin.
     */
    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    /**
     * Check if user is a regular User.
     */
    public function isUser(): bool
    {
        return $this->role === self::ROLE_USER;
    }

    /**
     * Check if user has administrative privileges (Admin or Super Admin).
     */
    public function hasAdminPrivileges(): bool
    {
        return $this->isSuperAdmin() || $this->isAdmin();
    }

    /**
     * Check if current user can assign a specified role to another user.
     */
    public function canAssignRole(string $targetRole): bool
    {
        if ($this->isSuperAdmin()) {
            return in_array($targetRole, self::ROLES, true);
        }

        if ($this->isAdmin()) {
            return $targetRole === self::ROLE_USER;
        }

        return false;
    }

    /**
     * Check if current user can manage a specific target user.
     */
    public function canManageUser(User $targetUser): bool
    {
        if (!$this->hasAdminPrivileges()) {
            return false;
        }

        if ($this->isSuperAdmin()) {
            return true;
        }

        // Admins can only manage regular USER accounts
        return $targetUser->isUser();
    }

    /**
     * Processes created by this user.
     */
    public function workflowProcesses(): HasMany
    {
        return $this->hasMany(WorkflowProcess::class);
    }

    /**
     * Pipeline jobs initiated by this user.
     */
    public function pipelineJobs(): HasMany
    {
        return $this->hasMany(PipelineJob::class);
    }

    /**
     * ToHtml synthesis jobs initiated by this user.
     */
    public function toHtmlJobs(): HasMany
    {
        return $this->hasMany(ToHtmlJob::class);
    }
}
