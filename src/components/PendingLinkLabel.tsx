"use client";

import { useLinkStatus } from "next/link";

type PendingLinkLabelProps = {
  children: React.ReactNode;
  pendingLabel?: string;
};

export function PendingLinkLabel({
  children,
  pendingLabel = "…",
}: PendingLinkLabelProps) {
  const { pending } = useLinkStatus();

  return (
    <span className="inline-flex items-center gap-1.5">
      {pending && (
        <span className="hud-spinner hud-spinner--sm" aria-hidden />
      )}
      <span className={pending ? "opacity-80" : undefined}>
        {pending ? pendingLabel : children}
      </span>
    </span>
  );
}
