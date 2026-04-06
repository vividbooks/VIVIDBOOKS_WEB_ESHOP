import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Quote, Undo2, Redo2 } from 'lucide-react';

function normalizeInitialHtml(s: string): string {
  const t = (s || '').trim();
  if (!t) return '<p></p>';
  if (t.includes('<')) return t;
  return `<p>${t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</p>`;
}

function ToolbarBtn({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded-md transition-colors text-[13px] font-bold ${
        active ? 'bg-[#001161] text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-[#001161]'
      }`}
    >
      {children}
    </button>
  );
}

function LearningsToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const sep = <div className="w-px h-5 bg-gray-200 mx-0.5" />;
  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-200 bg-[#fafafa] flex-wrap">
      <ToolbarBtn
        active={editor.isActive('bold')}
        title="Tučné"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('italic')}
        title="Kurzíva"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolbarBtn>
      {sep}
      <ToolbarBtn
        active={editor.isActive('heading', { level: 2 })}
        title="Nadpis H2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <span className="text-[11px] font-black">H2</span>
      </ToolbarBtn>
      {sep}
      <ToolbarBtn
        active={editor.isActive('blockquote')}
        title="Citát"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('bulletList')}
        title="Odrážky"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('orderedList')}
        title="Číslovaný seznam"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolbarBtn>
      {sep}
      <ToolbarBtn title="Zpět" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Vpřed" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="w-3.5 h-3.5" />
      </ToolbarBtn>
    </div>
  );
}

/**
 * Vizuální úprava HTML shrnutí (stejný výstup jako dříve v textarea — pro e-mail / Mailchimp).
 */
export function WebinarLearningsRichEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: normalizeInitialHtml(value),
    editorProps: {
      attributes: {
        class: 'vvb-past-learnings-editor',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  return (
    <>
      <style>{`
        .vvb-past-learnings-editor { outline: none; min-height: 220px; padding: 1rem 1.25rem 1.5rem; font-family: 'Fenomen Sans', sans-serif; color: #001161; font-size: 14px; line-height: 1.75; }
        .vvb-past-learnings-editor p { margin-bottom: 0.75rem; }
        .vvb-past-learnings-editor h2 { font-size: 1.05rem; font-weight: 800; margin: 1.25rem 0 0.5rem; }
        .vvb-past-learnings-editor h2:first-child { margin-top: 0; }
        .vvb-past-learnings-editor blockquote { border-left: 4px solid #7C3AED; padding: 0.6rem 1rem; background: #f5f3ff; border-radius: 8px; margin: 1rem 0; }
        .vvb-past-learnings-editor ul { padding-left: 1.4rem; margin-bottom: 0.8rem; list-style: disc; }
        .vvb-past-learnings-editor ol { padding-left: 1.4rem; margin-bottom: 0.8rem; list-style: decimal; }
        .vvb-past-learnings-editor li { margin-bottom: 0.25rem; }
        .vvb-past-learnings-editor strong { font-weight: 700; }
        .vvb-past-learnings-editor .ProseMirror-selectednode { outline: 2px solid #7C3AED; border-radius: 4px; }
      `}</style>
      <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
        <LearningsToolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>
    </>
  );
}
