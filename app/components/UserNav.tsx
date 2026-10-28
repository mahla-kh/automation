"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";

export function UserNav() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FC5185]/15 text-[#FC5185] border border-[#FC5185]/30">
            {t.auth.roleSuperAdmin}
          </span>
        );
      case "ADMIN":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3FC1C9]/15 text-[#3FC1C9] border border-[#3FC1C9]/30">
            {t.auth.roleAdmin}
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#364F6B]/30 text-[#F5F5F5]/70 border border-[#364F6B]">
            {t.auth.roleUser}
          </span>
        );
    }
  };

  const hasAdminAccess = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {hasAdminAccess && (
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FC5185]/10 hover:bg-[#FC5185]/20 text-[#FC5185] border border-[#FC5185]/30 transition-all shadow-sm"
          title={t.auth.userManagement}
        >
          <span>👥</span>
          <span className="hidden md:inline">{t.auth.userManagement}</span>
        </Link>
      )}

      <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#243447] border border-[#364F6B] text-xs">
        <span className="font-semibold text-[#F5F5F5]">{user.name}</span>
        {getRoleBadge(user.role)}
      </div>

      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors disabled:opacity-50"
        title={t.auth.logout}
      >
        <span>🚪</span>
        <span className="hidden sm:inline">{isLoggingOut ? "..." : t.auth.logout}</span>
      </button>
    </div>
  );
}
