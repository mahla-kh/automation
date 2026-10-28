"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import LanguageSelector from "@/app/components/LanguageSelector";

function LoginFormContent() {
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const { t, isRtl } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<{ email?: string; password?: string }>({});

  const redirectUrl = searchParams.get("redirect") || "/";

  // If already logged in, redirect away from login page
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      router.replace(redirectUrl.startsWith("/") ? redirectUrl : "/");
    }
  }, [authLoading, isAuthenticated, user, redirectUrl, router]);

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = t.admin.emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = t.admin.emailRequired;
    }

    if (!password) {
      errors.password = t.admin.passwordRequired;
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(email.trim().toLowerCase(), password, remember);
      if (result.success) {
        router.replace(redirectUrl.startsWith("/") ? redirectUrl : "/");
      } else {
        setError(result.error || t.auth.invalidCredentials);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.unknownError;
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
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

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen flex flex-col justify-center items-center bg-[#1A2634] text-[#F5F5F5] px-4 py-12 sm:px-6 lg:px-8 relative selection:bg-[#FC5185] selection:text-white"
    >
      {/* Background aesthetic glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FC5185]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#3FC1C9]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Language Switcher in Top Right */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header & Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FC5185] to-[#3FC1C9] items-center justify-center text-white font-black text-3xl shadow-xl shadow-[#FC5185]/20 mb-4 transition-transform hover:scale-105 duration-200">
            W
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5] tracking-tight">
            {t.auth.loginTitle}
          </h1>
          <p className="mt-2 text-sm text-[#F5F5F5]/70 max-w-sm mx-auto leading-relaxed">
            {t.auth.loginSubtitle}
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#243447]/90 backdrop-blur-xl border border-[#364F6B]/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          {error && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3 animate-fadeIn"
            >
              <span className="text-lg leading-none mt-0.5">⚠️</span>
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email Field */}
            <div>
              <label
                htmlFor="email-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[#F5F5F5]/80 mb-2"
              >
                {t.auth.email}
              </label>
              <div className="relative">
                <input
                  id="email-input"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (clientErrors.email) {
                      setClientErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  placeholder={t.auth.emailPlaceholder}
                  className={`w-full px-4 py-3 rounded-xl bg-[#1A2634] border ${
                    clientErrors.email
                      ? "border-rose-500 focus:ring-rose-500/30"
                      : "border-[#364F6B] focus:border-[#FC5185] focus:ring-[#FC5185]/20"
                  } text-[#F5F5F5] placeholder-[#F5F5F5]/30 text-sm focus:outline-none focus:ring-4 transition-all`}
                />
              </div>
              {clientErrors.email && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">{clientErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[#F5F5F5]/80 mb-2"
              >
                {t.auth.password}
              </label>
              <div className="relative">
                <input
                  id="password-input"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (clientErrors.password) {
                      setClientErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder={t.auth.passwordPlaceholder}
                  className={`w-full px-4 py-3 rounded-xl bg-[#1A2634] border ${
                    clientErrors.password
                      ? "border-rose-500 focus:ring-rose-500/30"
                      : "border-[#364F6B] focus:border-[#FC5185] focus:ring-[#FC5185]/20"
                  } text-[#F5F5F5] placeholder-[#F5F5F5]/30 text-sm focus:outline-none focus:ring-4 transition-all ${
                    isRtl ? "pl-12" : "pr-12"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-1/2 -translate-y-1/2 text-xs font-medium text-[#F5F5F5]/50 hover:text-[#F5F5F5] transition-colors p-2 ${
                    isRtl ? "left-2" : "right-2"
                  }`}
                  aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
              {clientErrors.password && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">{clientErrors.password}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[#F5F5F5]/80 hover:text-[#F5F5F5]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-[#364F6B] bg-[#1A2634] text-[#FC5185] focus:ring-[#FC5185]/30 focus:ring-offset-0 cursor-pointer accent-[#FC5185]"
                />
                <span>{t.auth.rememberMe}</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#FC5185] to-[#E04373] hover:from-[#e04373] hover:to-[#c83260] focus:outline-none focus:ring-4 focus:ring-[#FC5185]/30 shadow-lg shadow-[#FC5185]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{t.auth.signingIn}</span>
                </>
              ) : (
                <span>{t.auth.signIn}</span>
              )}
            </button>
          </form>
        </div>

        {/* Security Notice */}
        <p className="mt-6 text-center text-xs text-[#F5F5F5]/50">
          WePass Automation Platform • Protected by Backend Authentication & Access Control
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#1A2634] text-[#F5F5F5]">
          <div className="w-5 h-5 border-2 border-[#FC5185] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
