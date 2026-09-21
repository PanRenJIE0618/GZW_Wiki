"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signalNavigationStart } from "@/components/NavigationProgress";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export function LoginForm({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const modeFromQuery = searchParams.get("mode");

  const [mode, setMode] = useState<Mode>(
    modeFromQuery === "signup" || modeFromQuery === "login"
      ? modeFromQuery
      : initialMode,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          signalNavigationStart();
          router.push(next);
          router.refresh();
          return;
        }

        setMessage(
          "注册请求已提交。若开启了邮箱确认，请先查收邮件；否则可直接切到「登录」用同一账号登录。",
        );
        setMode("login");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        signalNavigationStart();
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel mx-auto w-full max-w-sm space-y-4 p-5">
      <div
        role="tablist"
        className="grid grid-cols-2 gap-1 border border-border bg-panel-2 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={`px-3 py-2.5 text-sm font-semibold tracking-wide ${
            mode === "login"
              ? "bg-accent text-[#0b120c]"
              : "text-muted hover:text-foreground"
          }`}
          onClick={() => {
            setMode("login");
            setError(null);
            setMessage(null);
          }}
        >
          登录
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={`px-3 py-2.5 text-sm font-semibold tracking-wide ${
            mode === "signup"
              ? "bg-accent text-[#0b120c]"
              : "text-muted hover:text-foreground"
          }`}
          onClick={() => {
            setMode("signup");
            setError(null);
            setMessage(null);
          }}
        >
          注册新账号
        </button>
      </div>

      <p className="text-center font-mono text-xs text-muted">
        MODE // {mode === "login" ? "LOGIN" : "SIGNUP"}
      </p>

      {mode === "signup" && (
        <label className="block space-y-1 text-sm">
          <span className="hud-label">Callsign</span>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="显示名称（可选）"
            autoComplete="nickname"
          />
        </label>
      )}

      <label className="block space-y-1 text-sm">
        <span className="hud-label">Email</span>
        <input
          type="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="hud-label">Password</span>
        <input
          type="password"
          required
          minLength={6}
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder="至少 6 位"
        />
      </label>

      {error && (
        <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {message && (
        <p className="border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
          {message}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-60">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="hud-spinner hud-spinner--sm" aria-hidden />
            处理中…
          </span>
        ) : mode === "login" ? (
          "登录"
        ) : (
          "创建账号"
        )}
      </button>

      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            还没有账号？{" "}
            <button
              type="button"
              className="text-accent underline"
              onClick={() => setMode("signup")}
            >
              点这里注册
            </button>
          </>
        ) : (
          <>
            已有账号？{" "}
            <button
              type="button"
              className="text-accent underline"
              onClick={() => setMode("login")}
            >
              返回登录
            </button>
          </>
        )}
      </p>

      <p className="text-center font-mono text-xs text-muted">
        ALT ROUTE{" "}
        <Link href="/signup" className="text-accent underline">
          /signup
        </Link>
      </p>
    </form>
  );
}
