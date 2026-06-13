"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Lock, Waves } from "lucide-react";

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
    <main className="grid min-h-screen place-items-center px-6">
      <section className="card grid w-full max-w-5xl overflow-hidden rounded-[28px] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative hidden min-h-[620px] overflow-hidden bg-[#071827] p-12 text-white lg:block">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #0b74ff, transparent 18rem)" }} />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo.jpg" alt="Code Wave Academy logo" width={72} height={72} className="rounded-2xl bg-white object-cover" />
              <div>
                <p className="text-sm text-blue-200">Academy Manager</p>
                <h1 className="text-3xl font-black">Code Wave Academy</h1>
              </div>
            </div>
            <div>
              <div className="mb-8 inline-flex rounded-2xl bg-white/10 p-4">
                <Waves size={44} className="text-blue-300" />
              </div>
              <h2 className="max-w-md text-5xl font-black leading-tight">Fast student, group, payment, and invoice workflow.</h2>
              <p className="mt-5 max-w-md text-lg text-blue-100">A modern replacement for the old Apps Script system with proper database, backups, and reporting.</p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="flex min-h-[560px] flex-col justify-center p-8 sm:p-12">
          <div className="mb-10 flex items-center gap-4 lg:hidden">
            <Image src="/logo.jpg" alt="Code Wave Academy logo" width={64} height={64} className="rounded-2xl object-cover" />
            <div>
              <h1 className="text-2xl font-black">Code Wave Academy</h1>
              <p className="text-sm text-slate-500">Admin login</p>
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-4 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600">
              <Lock size={28} />
            </div>
            <h2 className="text-3xl font-black text-slate-950">Welcome back</h2>
            <p className="mt-2 text-slate-500">Enter the admin password to open the academy dashboard.</p>
          </div>

          <label className="mb-2 text-sm font-bold text-slate-700" htmlFor="password">Admin password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
          />
          {error ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
          <button className="btn btn-primary mt-6 h-12" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <p className="mt-6 text-xs text-slate-500">Use environment variables for production credentials. The old reference password is not hardcoded in the browser.</p>
        </form>
      </section>
    </main>
  );
}
