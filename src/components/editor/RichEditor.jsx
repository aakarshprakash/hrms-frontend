import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState } from 'react'
import {
  Bold, Italic, UnderlineIcon, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, List, ListOrdered, Heading2, Heading3, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function ToolbarBtn({ onClick, active, title, children }) {
  return (
    <button type="button" onMouseDown={(e) => { e.preventDefault(); onClick() }} title={title}
      className={cn(
        'rounded p-1.5 text-slate-600 hover:bg-slate-100 transition-colors',
        active && 'bg-blue-100 text-blue-700'
      )}>
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 mx-1" />
}

export function RichEditor({ value, onChange, tokens = [], placeholder = 'Start writing…', minHeight = 240 }) {
  const [tokenOpen, setTokenOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate({ editor }) {
      onChange?.(editor.getHTML())
    },
  })

  // Sync external value changes (e.g. loading saved template)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== undefined && value !== current) {
      editor.commands.setContent(value || '', false)
    }
  }, [value])

  function insertToken(token) {
    editor?.chain().focus().insertContent(`{{${token}}}`).run()
    setTokenOpen(false)
  }

  if (!editor) return null

  const allTokens = tokens.flatMap((group) =>
    group.items?.map((t) => ({ ...t, group: group.label })) ?? []
  )

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <UnderlineIcon size={14} />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 size={14} />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
          <AlignLeft size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
          <AlignCenter size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
          <AlignRight size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
          <AlignJustify size={14} />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
          <List size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
          <ListOrdered size={14} />
        </ToolbarBtn>

        {allTokens.length > 0 && (
          <>
            <Divider />
            {/* Token picker */}
            <div className="relative">
              <button type="button"
                onClick={() => setTokenOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                {'{ }'} Insert Token <ChevronDown size={11} />
              </button>
              {tokenOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setTokenOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 w-64 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                    <div className="max-h-72 overflow-y-auto">
                      {tokens.map((group) => (
                        <div key={group.label}>
                          <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wide sticky top-0">
                            {group.label}
                          </div>
                          {group.items?.map((t) => (
                            <button key={t.token} type="button"
                              onClick={() => insertToken(t.token)}
                              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-blue-50 transition-colors">
                              <span className="text-slate-800">{t.label}</span>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {`{{${t.token}}}`}
                              </span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="prose prose-sm max-w-none px-4 py-3 text-slate-900 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[inherit]"
      />
    </div>
  )
}
