"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Lock } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
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
            ? "Invalid password. Please try again."
            : payload.error || "Login failed. Check server configuration.",
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Login request failed", error);
      setError("Login failed. Please check your connection and server configuration.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <form onSubmit={submit} className="login-card">
        <Image src="/logo.jpg" alt="Code Wave Academy logo" width={64} height={64} className="logo-image mb-4" />
        <h1>Code Wave Academy</h1>
        <p>نظام الإدارة المالية</p>
        <div className="mb-5 inline-flex items-center gap-2 text-[var(--primary)]">
          <Lock size={20} />
          <span className="font-bold">Admin Login</span>
        </div>
          <label className="form-label" htmlFor="password">كلمة المرور / Admin password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
          />
          {error ? <p className="login-error">{error}</p> : null}
          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
      </form>
    </main>
  );
}
