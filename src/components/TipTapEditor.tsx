"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const lowlight = createLowlight(common);

type TipTapEditorProps = {
  content: Record<string, unknown> | null;
  onChange: (json: Record<string, unknown>) => void;
  editable?: boolean;
};

export function TipTapEditor({
  content,
  onChange,
  editable = true,
}: TipTapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Image.configure({ allowBase64: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: "开始撰写百科内容：标题、段落、列表、图片、代码…",
      }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: content ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getJSON() as Record<string, unknown>);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none min-h-[280px] px-3 py-3 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  const uploadFile = useCallback(
    async (file: File, kind: "image" | "file") => {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "bin";
      const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("uploads")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("uploads").getPublicUrl(path);
      return data.publicUrl;
    },
    [],
  );

  if (!editor) return null;

  return (
    <div className="editor-shell">
      {editable && (
        <div className="editor-toolbar">
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            粗体
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            斜体
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            H3
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            列表
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            引用
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            代码
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              const url = window.prompt("链接 URL（可用 /entries/slug）");
              if (!url) return;
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: url })
                .run();
            }}
          >
            链接
          </ToolbarButton>
          <ToolbarButton onClick={() => fileInputRef.current?.click()}>
            图片
          </ToolbarButton>
          <ToolbarButton onClick={() => attachInputRef.current?.click()}>
            附件
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const url = await uploadFile(file, "image");
                editor.chain().focus().setImage({ src: url, alt: file.name }).run();
              } catch (err) {
                alert(err instanceof Error ? err.message : "上传失败");
              }
            }}
          />
          <input
            ref={attachInputRef}
            type="file"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const url = await uploadFile(file, "file");
                editor
                  .chain()
                  .focus()
                  .insertContent(
                    `<p><a href="${url}" target="_blank" rel="noopener noreferrer">📎 ${file.name}</a></p>`,
                  )
                  .run();
              } catch (err) {
                alert(err instanceof Error ? err.message : "上传失败");
              }
            }}
          />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`editor-tool ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}
