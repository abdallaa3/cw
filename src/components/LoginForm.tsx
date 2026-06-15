"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Lock } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(
          response.status === 401
            ? "كلمة المرور غير صحيحة، حاول مرة أخرى"
            : payload.error || "تعذّر تسجيل الدخول — تحقق من إعدادات الخادم",
        );
        return;
      }
      const next = params.get("next") || "/dashboard";
      router.push(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("تعذّر تسجيل الدخول — تحقق من اتصالك بالإنترنت");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-card">
        <Image src="/codewave-logo.png" alt="Code Wave Academy" width={84} height={84} className="login-logo" priority />
        <h1>Code Wave <span>Academy</span></h1>
        <p className="login-sub">نظام الإدارة المالية</p>
        <span className="login-badge"><Lock size={15} /> دخول الإدارة</span>

        <form onSubmit={submit} className="login-form">
          <label className="login-field-label" htmlFor="password">كلمة المرور</label>

          {/* Password field wrapper with show/hide button */}
          <div className="login-password-wrap">
            <input
              id="password"
              className="login-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              autoFocus
              dir="ltr"
            />
            <button
              type="button"
              className="login-show-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
              <span className="login-show-label">
                {showPassword ? "إخفاء" : "إظهار"}
              </span>
            </button>
          </div>

          {error ? <div className="login-error">{error}</div> : null}
          <button className="btn btn-primary btn-block" disabled={loading || !password}>
            {loading ? (<><span className="spinner" /> جاري الدخول...</>) : "دخول"}
          </button>
        </form>

        <div className="login-foot">© Code Wave Academy</div>
      </div>
    </main>
  );
}
