import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="hud-label">Recruitment</p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          注册 GZWWiki
        </h1>
        <p className="text-sm text-muted">创建账号后即可编辑百科内容</p>
      </div>
      <Suspense fallback={<p className="text-center text-muted">加载中…</p>}>
        <LoginForm initialMode="signup" />
      </Suspense>
    </div>
  );
}
