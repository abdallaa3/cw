"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Lock } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
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
          <input
            id="password"
            className="login-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            autoFocus
            dir="ltr"
          />
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
