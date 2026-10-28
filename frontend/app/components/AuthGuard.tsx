"use client";

import React, { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import { UserRole } from "@/app/types/auth";
import Link from "next/link";

interface AuthGuardProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirectUrl = pathname && pathname !== "/" ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login";
      router.replace(redirectUrl);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1A2634] text-[#F5F5F5] p-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#FC5185] to-[#3FC1C9] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-[#FC5185]/25 animate-pulse mb-6">
          W
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#FC5185] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-[#F5F5F5]/80">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1A2634] text-[#F5F5F5] p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-3xl mb-4">
          ⛔
        </div>
        <h1 className="text-2xl font-bold mb-2">دسترسی غیرمجاز / Access Denied</h1>
        <p className="text-[#F5F5F5]/70 text-sm max-w-md mb-6">
          حساب کاربری شما سطح دسترسی لازم برای مشاهده این بخش را ندارد.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FC5185] hover:bg-[#E04373] text-white font-medium text-sm transition-colors shadow-lg shadow-[#FC5185]/25"
        >
          {t.auth.backToDashboard}
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
