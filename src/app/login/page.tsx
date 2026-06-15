import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="login-screen"><div className="login-card"><span className="spinner" /></div></main>}>
      <LoginForm />
    </Suspense>
  );
}
