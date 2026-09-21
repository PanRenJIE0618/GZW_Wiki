"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActive(false);
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 320);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    const shouldTrack = (anchor: HTMLAnchorElement) => {
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return false;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) {
        return false;
      }
      try {
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) return false;
        const current = `${window.location.pathname}${window.location.search}`;
        const next = `${url.pathname}${url.search}`;
        return next !== current;
      } catch {
        return false;
      }
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || !shouldTrack(anchor)) return;
      setVisible(true);
      setActive(true);
    };

    const onStart = () => {
      setVisible(true);
      setActive(true);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("gzw:nav-start", onStart);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("gzw:nav-start", onStart);
    };
  }, []);

  if (!visible && !active) return null;

  return (
    <div
      className={`nav-progress ${active ? "nav-progress--active" : "nav-progress--done"}`}
      aria-hidden
    />
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}

/** Call before router.push / router.replace for non-Link navigations. */
export function signalNavigationStart() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gzw:nav-start"));
  }
}
