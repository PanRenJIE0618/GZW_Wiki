"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ArticleComment } from "@/lib/types";

type CommentSectionProps = {
  articleId: string;
  articleSlug: string;
  initialComments: ArticleComment[];
  currentUserId: string | null;
  isAdmin: boolean;
};

export function CommentSection({
  articleId,
  articleSlug,
  initialComments,
  currentUserId,
  isAdmin,
}: CommentSectionProps) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const roots = useMemo(
    () => comments.filter((c) => !c.parent_id),
    [comments],
  );

  const repliesOf = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId);

  async function submitComment(content: string, parentId: string | null) {
    const text = content.trim();
    if (!text) {
      setError("请输入评论内容");
      return;
    }
    if (!currentUserId) {
      setError("请先登录后再评论");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("article_comments")
        .insert({
          article_id: articleId,
          author_id: currentUserId,
          parent_id: parentId,
          body: text,
        })
        .select("*, profiles(display_name, role)")
        .single();
      if (insertError) throw insertError;

      setComments((prev) => [...prev, data as ArticleComment]);
      if (parentId) {
        setReplyTo(null);
        setReplyBody("");
      } else {
        setBody("");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("确定删除这条评论？")) return;
    setError(null);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("article_comments")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;
      setComments((prev) =>
        prev.filter((c) => c.id !== id && c.parent_id !== id),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function onRootSubmit(e: FormEvent) {
    e.preventDefault();
    await submitComment(body, null);
  }

  return (
    <section className="panel space-y-4 p-4 sm:p-6">
      <div className="section-rule">
        <p className="hud-label shrink-0">Comms Channel</p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <h2 className="title-name title-name-md">评论</h2>
        <span className="font-mono text-xs text-muted">
          {roots.length} 条主评 · {comments.length} 总计
        </span>
      </div>

      {currentUserId ? (
        <form onSubmit={onRootSubmit} className="space-y-2">
          <textarea
            className="textarea min-h-[88px]"
            placeholder="发表评论（需登录）…"
            value={body}
            maxLength={2000}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted">
              {body.length}/2000
            </span>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary disabled:opacity-60"
            >
              {saving ? "发送中…" : "发送评论"}
            </button>
          </div>
        </form>
      ) : (
        <div className="border border-border bg-panel-2 px-3 py-3 text-sm text-muted">
          评论需要登录。
          <Link
            href={`/login?next=/entries/${encodeURIComponent(articleSlug)}`}
            className="ml-2 text-accent underline"
          >
            去登录
          </Link>
        </div>
      )}

      {error && (
        <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {roots.length === 0 && (
          <li className="py-4 text-center font-mono text-xs text-muted">
            NO COMMENTS YET
          </li>
        )}
        {roots.map((comment) => (
          <li key={comment.id} className="border border-border bg-[#0a100d]">
            <CommentItem
              comment={comment}
              canDelete={
                isAdmin || (!!currentUserId && comment.author_id === currentUserId)
              }
              onDelete={() => onDelete(comment.id)}
              onReply={() => {
                setReplyTo(comment.id);
                setReplyBody("");
              }}
              canReply={!!currentUserId}
            />

            <ul className="space-y-2 border-t border-border bg-panel-2/40 px-3 py-2 sm:pl-8">
              {repliesOf(comment.id).map((reply) => (
                <li key={reply.id} className="border border-border/70 bg-[#0a100d]">
                  <CommentItem
                    comment={reply}
                    isReply
                    canDelete={
                      isAdmin ||
                      (!!currentUserId && reply.author_id === currentUserId)
                    }
                    onDelete={() => onDelete(reply.id)}
                    canReply={false}
                  />
                </li>
              ))}

              {replyTo === comment.id && currentUserId && (
                <li className="space-y-2 pt-1">
                  <textarea
                    className="textarea min-h-[72px]"
                    placeholder={`回复 ${comment.profiles?.display_name ?? "操作员"}…`}
                    value={replyBody}
                    maxLength={2000}
                    onChange={(e) => setReplyBody(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      className="btn btn-primary text-xs disabled:opacity-60"
                      onClick={() => submitComment(replyBody, comment.id)}
                    >
                      发送回复
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => setReplyTo(null)}
                    >
                      取消
                    </button>
                  </div>
                </li>
              )}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommentItem({
  comment,
  isReply,
  canDelete,
  canReply,
  onDelete,
  onReply,
}: {
  comment: ArticleComment;
  isReply?: boolean;
  canDelete: boolean;
  canReply?: boolean;
  onDelete: () => void;
  onReply?: () => void;
}) {
  return (
    <div className="space-y-2 px-3 py-3">
      <div className="meta-row">
        <span className="text-accent">
          {comment.profiles?.display_name ?? comment.author_id.slice(0, 8)}
        </span>
        <span className="meta-sep" />
        <span>{new Date(comment.created_at).toLocaleString("zh-CN")}</span>
        {isReply && (
          <>
            <span className="meta-sep" />
            <span>REPLY</span>
          </>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {comment.body}
      </p>
      <div className="flex flex-wrap gap-2">
        {canReply && onReply && (
          <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={onReply}>
            回复
          </button>
        )}
        {canDelete && (
          <button type="button" className="btn btn-danger px-2 py-1 text-xs" onClick={onDelete}>
            删除
          </button>
        )}
      </div>
    </div>
  );
}
