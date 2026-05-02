import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Heading } from '@tiptap/extension-heading';
import TextAlign from '@tiptap/extension-text-align';
import Blockquote from '@tiptap/extension-blockquote';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import Image from '@tiptap/extension-image';
import { MathExtension, AudioExtension, FileExtension } from '../Shared/TiptapExtensions';
import { Sigma, Bold, Italic, List, ListOrdered, Link as LinkIcon, Quote, Code, AlignLeft, AlignCenter, AlignRight, CheckSquare, Image as ImageIcon } from 'lucide-react';
import CodeBlockComponent from '../StudyNotes/CodeBlockComponent';
import * as api from '../../services/api';

const lowlight = createLowlight(common);

export default function JournalEditor({ content, onChange, onSaveMedia, entryId }) {
    const [mathModalOpen, setMathModalOpen] = useState(false);
    const [mathInput, setMathInput] = useState('');
    const fileInputRef = useRef(null);
    
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false,
                heading: false,
                blockquote: false,
            }),
            Heading.configure({ levels: [1, 2, 3] }),
            Underline,
            Link.configure({ openOnClick: false, autolink: true }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Blockquote,
            TaskList,
            TaskItem.configure({ nested: true }),
            Placeholder.configure({ placeholder: 'Write your heart out...' }),
            CodeBlockLowlight.extend({
                addNodeView() {
                    return ReactNodeViewRenderer(CodeBlockComponent);
                },
            }).configure({ lowlight }),
            Image.extend({
                addAttributes() {
                    return {
                        ...this.parent?.(),
                        media_id: {
                            default: null,
                            parseHTML: el => el.getAttribute('data-media-id'),
                            renderHTML: attrs => ({ 'data-media-id': attrs.media_id }),
                        },
                    };
                },
            }).configure({
                allowBase64: true,
                HTMLAttributes: {
                    class: 'journal-embedded-image',
                    referrerpolicy: 'no-referrer',
                },
            }),
            MathExtension,
            AudioExtension,
            FileExtension,
        ],
        content: content || '',
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Sync content when it changes from outside (e.g. switching entries)
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content || '');
        }
    }, [content, editor]);

    const toggleLink = useCallback(() => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    if (!editor) return null;

    return (
        <div className="journal-editor-rich">
            <div className="journal-toolbar">
                {/* Text Formatting */}
                <div className="toolbar-group">
                    <button 
                        className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        title="Bold (Ctrl+B)"
                    >
                        <Bold size={18} />
                    </button>
                    <button 
                        className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        title="Italic (Ctrl+I)"
                    >
                        <Italic size={18} />
                    </button>
                    <button 
                        className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        title="Underline"
                    >
                        <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>U</span>
                    </button>
                </div>

                <div className="toolbar-divider" />

                {/* Lists */}
                <div className="toolbar-group">
                    <button 
                        className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        title="Bullet List"
                    >
                        <List size={18} />
                    </button>
                    <button 
                        className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        title="Numbered List"
                    >
                        <ListOrdered size={18} />
                    </button>
                    <button 
                        className={`toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleTaskList().run()}
                        title="Task List"
                    >
                        <CheckSquare size={18} />
                    </button>
                </div>

                <div className="toolbar-divider" />

                {/* Blocks */}
                <div className="toolbar-group">
                    <button 
                        className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        title="Quote"
                    >
                        <Quote size={18} />
                    </button>
                    <button 
                        className={`toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        title="Code Block"
                    >
                        <Code size={18} />
                    </button>
                </div>

                <div className="toolbar-divider" />

                {/* Alignment */}
                <div className="toolbar-group">
                    <button 
                        className={`toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        title="Align Left"
                    >
                        <AlignLeft size={18} />
                    </button>
                    <button 
                        className={`toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        title="Align Center"
                    >
                        <AlignCenter size={18} />
                    </button>
                    <button 
                        className={`toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        title="Align Right"
                    >
                        <AlignRight size={18} />
                    </button>
                </div>

                <div className="toolbar-divider" />

                {/* Links & Media */}
                <div className="toolbar-group">
                    <button 
                        className={`toolbar-btn ${editor.isActive('link') ? 'active' : ''}`}
                        onClick={toggleLink}
                        title="Insert Link"
                    >
                        <LinkIcon size={18} />
                    </button>
                    <button 
                        className="toolbar-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title="Insert Image"
                    >
                        <ImageIcon size={18} />
                    </button>
                    <input 
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && entryId) {
                                onSaveMedia?.(file, 'image');
                            }
                        }}
                    />
                    <button 
                        className="toolbar-btn latex-btn"
                        onClick={() => setMathModalOpen(true)}
                        title="Insert LaTeX"
                    >
                        <Sigma size={18} />
                        <span>TeX</span>
                    </button>
                </div>
            </div>

            <EditorContent editor={editor} className="journal-tiptap-container" />

            {/* LaTeX Modal (Same as Study Notes) */}
            {mathModalOpen && (
                <div className="sn-math-modal-overlay" onClick={() => setMathModalOpen(false)}>
                    <div className="sn-math-modal" onClick={e => e.stopPropagation()}>
                        <div className="sn-math-modal-header">
                            <h3>LaTeX Workspace</h3>
                            <button className="sn-math-close" onClick={() => setMathModalOpen(false)}>✕</button>
                        </div>
                        <div className="sn-math-modal-body">
                            <textarea 
                                className="sn-math-textarea"
                                placeholder="Paste mixed text and math here..."
                                value={mathInput}
                                onChange={e => setMathInput(e.target.value)}
                                autoFocus
                            />
                            <div className="sn-math-preview-label">Live Preview</div>
                            <div className="sn-math-preview-box">
                                {(() => {
                                    if (!mathInput) return <span style={{ color: 'var(--sn-text-hint)' }}>Preview will appear here...</span>;
                                    try {
                                        let p = mathInput.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                        p = p.replace(/\$\$(.*?)\$\$/gs, (m, p1) => window.katex.renderToString(p1, { throwOnError: false, displayMode: true }));
                                        p = p.replace(/\$(.*?)\$/g, (m, p1) => window.katex.renderToString(p1, { throwOnError: false }));
                                        
                                        // Auto-detect equations if no delimiters
                                        if (p === mathInput && p.includes('\\')) {
                                            return <div dangerouslySetInnerHTML={{ __html: window.katex.renderToString(p, { throwOnError: false, displayMode: true }) }} />;
                                        }

                                        return <div style={{ width: '100%', textAlign: 'left' }} dangerouslySetInnerHTML={{ __html: p.replace(/\n/g, '<br/>') }} />;
                                    } catch (e) { return <span style={{ color: '#ef4444' }}>Parsing error...</span>; }
                                })()}
                            </div>
                        </div>
                        <div className="sn-math-modal-footer">
                            <button className="sn-math-cancel-btn" onClick={() => setMathModalOpen(false)}>Cancel</button>
                            <button 
                                className="sn-math-insert-btn"
                                onClick={() => {
                                    if (mathInput.trim()) {
                                        let processed = mathInput.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                        
                                        // A. Find complex LaTeX commands first (e.g. \frac{...}{...})
                                        processed = processed.replace(/\\[a-zA-Z]+(\{.*?\}|\[.*?\])*/g, (m) => {
                                            return `<span class="sn-math-inline" data-latex="${m}"></span>`;
                                        });

                                        // B. Find equations (e.g. v = d/t)
                                        processed = processed.replace(/([a-zA-Z0-9_{}]+\s*=\s*[^,.;\s]+)/g, (m) => {
                                            if (m.includes('<span')) return m;
                                            return `<span class="sn-math-inline" data-latex="${m}"></span>`;
                                        });

                                        const html = processed.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '<p><br></p>').join('');
                                        editor.chain().focus().insertContent(html).run();
                                        setMathModalOpen(false);
                                        setMathInput('');
                                    }
                                }}
                            >
                                Insert & Format
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
