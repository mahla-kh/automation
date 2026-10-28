"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { AuthGuard } from "@/app/components/AuthGuard";
import { UserNav } from "@/app/components/UserNav";
import LanguageSelector from "@/app/components/LanguageSelector";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import { User, UserRole } from "@/app/types/auth";

function getXsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)XSRF-TOKEN=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
  let xsrf = getXsrfToken();
  if (!xsrf && options.method && options.method !== "GET" && options.method !== "HEAD") {
    // initialize csrf
    await fetch("/api/auth/csrf", { credentials: "include" }).catch(() => {});
    xsrf = getXsrfToken();
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (xsrf) {
    headers["X-XSRF-TOKEN"] = xsrf;
  }

  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = (await res.json().catch(() => ({}))) as T;
  return {
    ok: res.ok,
    status: res.status,
    data,
    error: !res.ok ? ((data as { message?: string; error?: string })?.message || (data as { message?: string; error?: string })?.error || "Request failed") : undefined,
  };
}

interface PaginatedUsers {
  current_page: number;
  data: User[];
  last_page: number;
  per_page: number;
  total: number;
}

function UsersManagementContent() {
  const { user: currentUser } = useAuth();
  const { t, isRtl } = useLanguage();

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const isAdmin = currentUser?.role === "ADMIN";

  // Filter & Pagination State
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Users List State
  const [usersData, setUsersData] = useState<PaginatedUsers | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState<User | null>(null);

  // Create Form State
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("USER");
  const [createActive, setCreateActive] = useState<boolean>(true);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Reset Password State
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Change Role State
  const [selectedRole, setSelectedRole] = useState<UserRole>("USER");
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("per_page", "12");
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);

    const res = await apiRequest<PaginatedUsers>(`/api/admin/users?${params.toString()}`);

    if (res.ok) {
      setUsersData(res.data);
    } else {
      setError(res.error || "Failed to load users.");
    }
    setIsLoading(false);
  }, [currentPage, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showToast = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((current) => (current?.message === message ? null : current));
    }, 4000);
  };

  // Toggle user active status
  const handleToggleStatus = async (targetUser: User) => {
    if (targetUser.id === currentUser?.id) {
      showToast("error", "You cannot deactivate your own account.");
      return;
    }

    const newStatus = !targetUser.is_active;
    const confirmMessage = newStatus
      ? `آیا از فعال‌سازی حساب ${targetUser.name} اطمینان دارید؟`
      : `آیا از غیرفعال‌سازی حساب ${targetUser.name} اطمینان دارید؟`;

    if (!window.confirm(confirmMessage)) return;

    const res = await apiRequest<{ message: string; user: User }>(`/api/admin/users/${targetUser.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: newStatus }),
    });

    if (res.ok) {
      showToast("success", res.data.message || t.admin.statusUpdatedSuccess);
      fetchUsers();
    } else {
      showToast("error", res.error || "Failed to update user status.");
    }
  };

  // Create user submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErrors({});

    const errs: Record<string, string> = {};
    if (!createName.trim()) errs.name = t.admin.nameRequired;
    if (!createEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createEmail.trim())) {
      errs.email = t.admin.emailRequired;
    }
    if (!createPassword || createPassword.length < 8) {
      errs.password = t.admin.passwordRequired;
    }

    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setIsCreating(true);

    const res = await apiRequest<{ message: string; user: User }>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: createName.trim(),
        email: createEmail.trim().toLowerCase(),
        password: createPassword,
        role: createRole,
        is_active: createActive,
      }),
    });

    setIsCreating(false);

    if (res.ok) {
      setShowCreateModal(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("USER");
      setCreateActive(true);
      showToast("success", res.data.message || t.admin.userCreatedSuccess);
      fetchUsers();
    } else {
      setCreateErrors({ general: res.error || "Failed to create user." });
    }
  };

  // Reset password submit
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showResetModal) return;

    if (!newPassword || newPassword.length < 8) {
      setResetError(t.admin.passwordRequired);
      return;
    }

    setIsResetting(true);
    setResetError(null);

    const res = await apiRequest<{ message: string }>(`/api/admin/users/${showResetModal.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password: newPassword }),
    });

    setIsResetting(false);

    if (res.ok) {
      setShowResetModal(null);
      setNewPassword("");
      showToast("success", res.data.message || t.admin.passwordResetSuccess);
    } else {
      setResetError(res.error || "Failed to reset password.");
    }
  };

  // Change role submit
  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRoleModal) return;

    setIsUpdatingRole(true);
    setRoleError(null);

    const res = await apiRequest<{ message: string; user: User }>(`/api/admin/users/${showRoleModal.id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: selectedRole }),
    });

    setIsUpdatingRole(false);

    if (res.ok) {
      setShowRoleModal(null);
      showToast("success", res.data.message || t.admin.roleUpdatedSuccess);
      fetchUsers();
    } else {
      setRoleError(res.error || "Failed to update role.");
    }
  };

  // Badge formatter
  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case "SUPER_ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FC5185]/15 text-[#FC5185] border border-[#FC5185]/30">
            ★ {t.auth.roleSuperAdmin}
          </span>
        );
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#3FC1C9]/15 text-[#3FC1C9] border border-[#3FC1C9]/30">
            🛡️ {t.auth.roleAdmin}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#364F6B]/30 text-[#F5F5F5]/70 border border-[#364F6B]">
            👤 {t.auth.roleUser}
          </span>
        );
    }
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-[#1A2634] text-[#F5F5F5] flex flex-col selection:bg-[#FC5185] selection:text-white"
    >
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#243447]/95 backdrop-blur-md border-b border-[#364F6B]/60 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FC5185] to-[#3FC1C9] flex items-center justify-center text-white font-black text-xl shadow-md shadow-[#FC5185]/20 hover:scale-105 transition-transform"
            >
              W
            </Link>
            <div>
              <h1 className="font-bold text-sm sm:text-base tracking-tight text-[#F5F5F5]">
                {t.admin.usersTitle}
              </h1>
              <p className="text-[11px] text-[#F5F5F5]/60 hidden sm:block">
                WePass Administration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#243447] hover:bg-[#1A2634] text-[#F5F5F5]/80 hover:text-white border border-[#364F6B] transition-all"
            >
              <span>←</span>
              <span>{t.auth.backToDashboard}</span>
            </Link>
            <LanguageSelector />
            <UserNav />
          </div>
        </div>
      </header>

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border text-sm flex items-center gap-3 ${
              notification.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/90 border-rose-500/40 text-rose-200"
            }`}
          >
            <span>{notification.type === "success" ? "✓" : "⚠️"}</span>
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Controls Bar: Search, Filters, Create Button */}
        <div className="bg-[#243447] border border-[#364F6B] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t.admin.searchPlaceholder}
                className="w-full px-4 py-2.5 rounded-xl bg-[#1A2634] border border-[#364F6B] focus:border-[#FC5185] focus:ring-2 focus:ring-[#FC5185]/20 text-sm text-[#F5F5F5] placeholder-[#F5F5F5]/30 focus:outline-none transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#F5F5F5]/40 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 rounded-xl bg-[#1A2634] border border-[#364F6B] text-sm text-[#F5F5F5] focus:border-[#FC5185] focus:outline-none transition-all"
            >
              <option value="">{t.admin.filterRole}</option>
              <option value="SUPER_ADMIN">{t.auth.roleSuperAdmin}</option>
              <option value="ADMIN">{t.auth.roleAdmin}</option>
              <option value="USER">{t.auth.roleUser}</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 rounded-xl bg-[#1A2634] border border-[#364F6B] text-sm text-[#F5F5F5] focus:border-[#FC5185] focus:outline-none transition-all"
            >
              <option value="">{t.admin.filterStatus}</option>
              <option value="active">{t.admin.active}</option>
              <option value="inactive">{t.admin.inactive}</option>
            </select>
          </div>

          {/* Create User Button */}
          <button
            onClick={() => {
              setCreateRole("USER");
              setShowCreateModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#FC5185] to-[#E04373] hover:from-[#e04373] hover:to-[#c83260] shadow-lg shadow-[#FC5185]/20 transition-transform active:scale-95"
          >
            <span>+</span>
            <span>{t.admin.createUser}</span>
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-[#243447] border border-[#364F6B] rounded-2xl shadow-xl overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-[#FC5185] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-[#F5F5F5]/70">{t.common.loading}</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-400">
              <p className="font-semibold">{error}</p>
              <button
                onClick={fetchUsers}
                className="mt-3 px-4 py-1.5 rounded-xl bg-[#1A2634] border border-[#364F6B] text-xs hover:border-[#FC5185]"
              >
                {t.common.retry}
              </button>
            </div>
          ) : !usersData?.data || usersData.data.length === 0 ? (
            <div className="p-12 text-center text-[#F5F5F5]/50">
              <span className="text-3xl block mb-2">👤</span>
              <p className="text-sm">{t.admin.noUsersFound}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-[#1A2634]/70 border-b border-[#364F6B] text-xs uppercase tracking-wider text-[#F5F5F5]/60">
                  <tr>
                    <th className="py-3.5 px-4">{t.admin.thName}</th>
                    <th className="py-3.5 px-4">{t.admin.thEmail}</th>
                    <th className="py-3.5 px-4">{t.admin.thRole}</th>
                    <th className="py-3.5 px-4">{t.admin.thStatus}</th>
                    <th className="py-3.5 px-4">{t.admin.thCreated}</th>
                    <th className="py-3.5 px-4">{t.admin.thLastLogin}</th>
                    <th className="py-3.5 px-4 text-center">{t.admin.thActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#364F6B]/50">
                  {usersData.data.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    const canManage =
                      isSuperAdmin || (isAdmin && u.role === "USER");

                    return (
                      <tr key={u.id} className="hover:bg-[#1A2634]/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-[#F5F5F5]">
                          <div className="flex items-center gap-2">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                شما
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#F5F5F5]/80 font-mono text-xs">
                          {u.email}
                        </td>
                        <td className="py-3.5 px-4">{renderRoleBadge(u.role)}</td>
                        <td className="py-3.5 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                              {t.admin.active}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                              {t.admin.inactive}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#F5F5F5]/60 font-mono">
                          {new Date(u.created_at).toLocaleDateString("fa-IR")}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#F5F5F5]/60 font-mono">
                          {u.last_login_at
                            ? new Date(u.last_login_at).toLocaleString("fa-IR")
                            : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            {/* Status Toggle */}
                            {canManage && !isSelf && (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                  u.is_active
                                    ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30"
                                    : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                }`}
                                title={u.is_active ? t.admin.deactivate : t.admin.activate}
                              >
                                {u.is_active ? t.admin.deactivate : t.admin.activate}
                              </button>
                            )}

                            {/* Reset Password */}
                            {(canManage || isSelf) && (
                              <button
                                onClick={() => {
                                  setShowResetModal(u);
                                  setNewPassword("");
                                  setResetError(null);
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1A2634] hover:bg-[#364F6B]/60 text-[#3FC1C9] border border-[#3FC1C9]/30 transition-all"
                                title={t.admin.resetPassword}
                              >
                                🔑 {t.admin.resetPassword}
                              </button>
                            )}

                            {/* Role Update (Super Admin only) */}
                            {isSuperAdmin && (
                              <button
                                onClick={() => {
                                  setShowRoleModal(u);
                                  setSelectedRole(u.role);
                                  setRoleError(null);
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1A2634] hover:bg-[#364F6B]/60 text-[#FC5185] border border-[#FC5185]/30 transition-all"
                                title={t.admin.changeRole}
                              >
                                🏷️ {t.admin.changeRole}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {usersData && usersData.last_page > 1 && (
            <div className="p-4 bg-[#1A2634]/50 border-t border-[#364F6B] flex items-center justify-between text-xs text-[#F5F5F5]/70">
              <div>
                صفحه {usersData.current_page} از {usersData.last_page} ({usersData.total} کاربر کل)
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={usersData.current_page <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1.5 rounded-lg bg-[#243447] border border-[#364F6B] hover:border-[#FC5185] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  قبلی
                </button>
                <button
                  disabled={usersData.current_page >= usersData.last_page}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, usersData.last_page))}
                  className="px-3 py-1.5 rounded-lg bg-[#243447] border border-[#364F6B] hover:border-[#FC5185] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  بعدی
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#243447] border border-[#364F6B] rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#364F6B]/60 pb-4">
              <h3 className="text-lg font-bold text-[#F5F5F5]">{t.admin.createUser}</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#F5F5F5]/50 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {createErrors.general && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {createErrors.general}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5]/80 mb-1.5">
                  {t.admin.thName}
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A2634] border border-[#364F6B] focus:border-[#FC5185] text-sm text-[#F5F5F5] focus:outline-none"
                  placeholder="محمد رضایی"
                />
                {createErrors.name && (
                  <p className="text-xs text-rose-400 mt-1">{createErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5]/80 mb-1.5">
                  {t.admin.thEmail}
                </label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A2634] border border-[#364F6B] focus:border-[#FC5185] text-sm text-[#F5F5F5] focus:outline-none"
                  placeholder="user@example.com"
                />
                {createErrors.email && (
                  <p className="text-xs text-rose-400 mt-1">{createErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5]/80 mb-1.5">
                  {t.auth.password} (حداقل ۸ کاراکتر)
                </label>
                <input
                  type="password"
                  required
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A2634] border border-[#364F6B] focus:border-[#FC5185] text-sm text-[#F5F5F5] focus:outline-none"
                  placeholder="••••••••"
                />
                {createErrors.password && (
                  <p className="text-xs text-rose-400 mt-1">{createErrors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5]/80 mb-1.5">
                  {t.admin.thRole}
                </label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A2634] border border-[#364F6B] focus:border-[#FC5185] text-sm text-[#F5F5F5] focus:outline-none"
                >
                  <option value="USER">{t.auth.roleUser}</option>
                  {isSuperAdmin && (
                    <>
                      <option value="ADMIN">{t.auth.roleAdmin}</option>
                      <option value="SUPER_ADMIN">{t.auth.roleSuperAdmin}</option>
                    </>
                  )}
                </select>
                {!isSuperAdmin && (
                  <p className="text-[11px] text-[#F5F5F5]/50 mt-1">
                    مدیران فقط مجاز به تعریف کاربر عادی (USER) هستند.
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1A2634] text-[#F5F5F5]/70 hover:text-white border border-[#364F6B]"
                >
                  {t.admin.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FC5185] to-[#E04373] hover:from-[#e04373] hover:to-[#c83260] disabled:opacity-50 shadow-md shadow-[#FC5185]/20"
                >
                  {isCreating ? t.common.submitting : t.admin.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#243447] border border-[#364F6B] rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#364F6B]/60 pb-4">
              <h3 className="text-lg font-bold text-[#F5F5F5]">
                {t.admin.resetPassword} ({showResetModal.name})
              </h3>
              <button
                onClick={() => setShowResetModal(null)}
                className="text-[#F5F5F5]/50 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {resetError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5]/80 mb-1.5">
                  {t.admin.newPassword}
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A2634] border border-[#364F6B] focus:border-[#FC5185] text-sm text-[#F5F5F5] focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1A2634] text-[#F5F5F5]/70 hover:text-white border border-[#364F6B]"
                >
                  {t.admin.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FC5185] to-[#E04373] hover:from-[#e04373] hover:to-[#c83260] disabled:opacity-50 shadow-md shadow-[#FC5185]/20"
                >
                  {isResetting ? t.common.submitting : t.admin.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Role (Super Admin only) */}
      {showRoleModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#243447] border border-[#364F6B] rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#364F6B]/60 pb-4">
              <h3 className="text-lg font-bold text-[#F5F5F5]">
                {t.admin.changeRole} ({showRoleModal.name})
              </h3>
              <button
                onClick={() => setShowRoleModal(null)}
                className="text-[#F5F5F5]/50 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {roleError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {roleError}
              </div>
            )}

            <form onSubmit={handleRoleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5]/80 mb-1.5">
                  انتخاب سطح دسترسی جدید:
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A2634] border border-[#364F6B] focus:border-[#FC5185] text-sm text-[#F5F5F5] focus:outline-none"
                >
                  <option value="USER">{t.auth.roleUser}</option>
                  <option value="ADMIN">{t.auth.roleAdmin}</option>
                  <option value="SUPER_ADMIN">{t.auth.roleSuperAdmin}</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1A2634] text-[#F5F5F5]/70 hover:text-white border border-[#364F6B]"
                >
                  {t.admin.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingRole}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FC5185] to-[#E04373] hover:from-[#e04373] hover:to-[#c83260] disabled:opacity-50 shadow-md shadow-[#FC5185]/20"
                >
                  {isUpdatingRole ? t.common.submitting : t.admin.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
      <UsersManagementContent />
    </AuthGuard>
  );
}
