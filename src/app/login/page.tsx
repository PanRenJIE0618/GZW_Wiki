import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="hud-label">Access Control</p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          登录 GZWWiki
        </h1>
        <p className="text-sm text-muted">使用邮箱密码登录或注册账号</p>
      </div>
      <Suspense fallback={<p className="text-center text-muted">加载中…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
