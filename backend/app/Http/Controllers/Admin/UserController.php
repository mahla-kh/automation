<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * List users with pagination and search.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->input('per_page', 15), 1), 100);
        $search = trim((string) $request->input('search', ''));
        $role = $request->input('role');
        $status = $request->input('status');

        $query = User::query();

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($role && in_array($role, User::ROLES, true)) {
            $query->where('role', $role);
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $users = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json($users);
    }

    /**
     * Create a new user account with role-appropriate permissions.
     */
    public function store(Request $request): JsonResponse
    {
        $currentUser = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'string', Rule::in(User::ROLES)],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $targetRole = $validated['role'];

        if (!$currentUser->canAssignRole($targetRole)) {
            return response()->json([
                'message' => 'Administrators are only permitted to create regular users.',
            ], 403);
        }

        $normalizedEmail = strtolower(trim($validated['email']));

        $user = User::create([
            'name' => trim($validated['name']),
            'email' => $normalizedEmail,
            'password' => Hash::make($validated['password']),
            'role' => $targetRole,
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return response()->json([
            'message' => 'User created successfully.',
            'user' => $user,
        ], 201);
    }

    /**
     * Show detailed user information.
     */
    public function show(int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        return response()->json([
            'user' => $user,
        ]);
    }

    /**
     * Activate or deactivate a user account with Last-Super-Admin safeguards.
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $currentUser = $request->user();
        $targetUser = User::findOrFail($id);

        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $newStatus = (bool) $validated['is_active'];

        // Safeguard 1: Cannot modify own status
        if ($targetUser->id === $currentUser->id) {
            return response()->json([
                'message' => 'You cannot deactivate your own account.',
            ], 400);
        }

        // Safeguard 2: Admin cannot deactivate Admin or Super Admin
        if ($currentUser->isAdmin() && !$targetUser->isUser()) {
            return response()->json([
                'message' => 'Administrators are only permitted to manage regular user accounts.',
            ], 403);
        }

        // Safeguard 3: Cannot deactivate the last active Super Admin
        if ($targetUser->isSuperAdmin() && !$newStatus) {
            $otherActiveSuperAdmins = User::where('role', User::ROLE_SUPER_ADMIN)
                ->where('is_active', true)
                ->where('id', '!=', $targetUser->id)
                ->count();

            if ($otherActiveSuperAdmins === 0) {
                return response()->json([
                    'message' => 'Cannot deactivate the last active Super Administrator.',
                ], 400);
            }
        }

        $targetUser->forceFill([
            'is_active' => $newStatus,
        ])->save();

        return response()->json([
            'message' => 'User status updated successfully.',
            'user' => $targetUser,
        ]);
    }

    /**
     * Secure administrative password reset.
     */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $currentUser = $request->user();
        $targetUser = User::findOrFail($id);

        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8'],
        ]);

        // Safeguard: Check permissions
        if ($targetUser->isSuperAdmin() && !$currentUser->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only Super Administrators can reset passwords for Super Admin accounts.',
            ], 403);
        }

        if ($targetUser->isAdmin() && $currentUser->isAdmin() && $targetUser->id !== $currentUser->id) {
            return response()->json([
                'message' => 'Administrators cannot reset passwords for other administrators.',
            ], 403);
        }

        $targetUser->forceFill([
            'password' => Hash::make($validated['password']),
        ])->save();

        return response()->json([
            'message' => 'Password reset successfully.',
        ]);
    }

    /**
     * Update user role (Super Admin only).
     */
    public function updateRole(Request $request, int $id): JsonResponse
    {
        $currentUser = $request->user();

        if (!$currentUser->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only Super Administrators can change user roles.',
            ], 403);
        }

        $targetUser = User::findOrFail($id);

        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in(User::ROLES)],
        ]);

        $newRole = $validated['role'];

        // Safeguard: Demoting last active Super Admin
        if ($targetUser->isSuperAdmin() && $newRole !== User::ROLE_SUPER_ADMIN) {
            $otherActiveSuperAdmins = User::where('role', User::ROLE_SUPER_ADMIN)
                ->where('is_active', true)
                ->where('id', '!=', $targetUser->id)
                ->count();

            if ($otherActiveSuperAdmins === 0) {
                return response()->json([
                    'message' => 'Cannot demote the last Super Administrator.',
                ], 400);
            }
        }

        $targetUser->forceFill([
            'role' => $newRole,
        ])->save();

        return response()->json([
            'message' => 'User role updated successfully.',
            'user' => $targetUser,
        ]);
    }
}
