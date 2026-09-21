"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useEffect } from "react";

const lowlight = createLowlight(common);

type TipTapRendererProps = {
  content: Record<string, unknown> | null;
};

export function TipTapRenderer({ content }: TipTapRendererProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Image,
      Link.configure({ openOnClick: true }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: content ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none",
      },
    },
  });

  useEffect(() => {
    if (!editor || !content) return;
    editor.commands.setContent(content);
  }, [editor, content]);

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}
