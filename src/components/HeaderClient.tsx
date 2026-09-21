"use client";

import Link from "next/link";
import { useState } from "react";
import { PendingLinkLabel } from "@/components/PendingLinkLabel";
import { SignOutButton } from "@/components/SignOutButton";

type HeaderClientProps = {
  canEdit: boolean;
  isAdmin: boolean;
  userLabel: string | null;
  contributionPoints: number | null;
};

export function HeaderClient({
  canEdit,
  isAdmin,
  userLabel,
  contributionPoints,
}: HeaderClientProps) {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "分类" },
    { href: "/map", label: "地图" },
    ...(canEdit
      ? [
          { href: "/entries/new", label: "新建词条" },
          { href: "/admin/categories", label: "管理分类" },
        ]
      : []),
    ...(isAdmin ? [{ href: "/admin/users", label: "用户" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[#070a08]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:px-5">
        <Link href="/" className="group flex items-center gap-2">
          <span className="inline-block h-2 w-2 bg-accent shadow-[0_0_10px_rgba(157,239,74,0.8)]" />
          <span className="font-display text-lg font-bold tracking-[0.12em] text-foreground group-hover:text-accent">
            GZWWiki
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="btn btn-ghost px-2.5 py-1.5 text-xs"
            >
              <PendingLinkLabel pendingLabel={link.label}>
                {link.label}
              </PendingLinkLabel>
            </Link>
          ))}
          {userLabel ? (
            <div className="ml-2 flex max-w-[14rem] items-center gap-2 border-l border-border pl-3">
              <span
                className="truncate font-display text-sm font-semibold tracking-wide text-foreground"
                title={userLabel}
              >
                {userLabel}
              </span>
              {contributionPoints !== null && (
                <>
                  <span className="meta-sep" />
                  <span className="badge shrink-0" title="总贡献值">
                    XP {contributionPoints}
                  </span>
                </>
              )}
              <SignOutButton />
            </div>
          ) : (
            <div className="ml-2 flex items-center gap-2 border-l border-border pl-3">
              <Link href="/login" className="btn btn-ghost px-2.5 py-1.5 text-xs">
                登录
              </Link>
              <Link href="/signup" className="btn btn-primary px-2.5 py-1.5 text-xs">
                注册
              </Link>
            </div>
          )}
        </nav>

        <button
          type="button"
          className="btn btn-ghost md:hidden"
          aria-expanded={open}
          aria-label="打开菜单"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "关闭" : "菜单"}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-panel px-3 py-3 md:hidden">
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="btn btn-ghost justify-start"
                onClick={() => setOpen(false)}
              >
                <PendingLinkLabel pendingLabel={link.label}>
                  {link.label}
                </PendingLinkLabel>
              </Link>
            ))}
            {userLabel ? (
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="min-w-0">
                  <span
                    className="block truncate font-display text-sm font-semibold text-foreground"
                    title={userLabel}
                  >
                    {userLabel}
                  </span>
                  {contributionPoints !== null && (
                    <div className="meta-row mt-1">
                      <span>贡献值</span>
                      <span className="meta-sep" />
                      <span className="text-accent">XP {contributionPoints}</span>
                    </div>
                  )}
                </div>
                <SignOutButton />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                <Link
                  href="/login"
                  className="btn btn-ghost"
                  onClick={() => setOpen(false)}
                >
                  登录
                </Link>
                <Link
                  href="/signup"
                  className="btn btn-primary"
                  onClick={() => setOpen(false)}
                >
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
