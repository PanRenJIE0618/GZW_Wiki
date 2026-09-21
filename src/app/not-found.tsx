import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel mx-auto max-w-lg space-y-4 p-8 text-center">
      <p className="hud-label">Signal Lost</p>
      <h1 className="title-name title-name-md">未找到页面</h1>
      <p className="text-sm text-muted">
        词条不存在，或链接格式不正确。
      </p>
      <div className="space-y-1 font-mono text-xs text-muted">
        <p>正确打开方式：</p>
        <p className="text-accent">/categories/分类slug</p>
        <p className="text-accent">/entries/词条slug</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Link href="/" className="btn btn-primary">
          返回首页
        </Link>
        <Link href="/entries/new" className="btn btn-ghost">
          新建词条
        </Link>
      </div>
    </div>
  );
}
