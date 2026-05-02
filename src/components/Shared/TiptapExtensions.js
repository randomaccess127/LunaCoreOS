import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { PasteRule } from '@tiptap/core';

// ── Math Extension ───────────────────────────────────────────
export const MathExtension = Node.create({
    name: 'math',
    group: 'inline',
    inline: true,
    atom: true,
    addAttributes() {
        return { latex: { default: '' } };
    },
    parseHTML() {
        return [{ tag: 'span.sn-math-inline', getAttrs: el => ({ latex: el.getAttribute('data-latex') }) }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 
            class: 'sn-math-inline', 
            'data-latex': HTMLAttributes.latex 
        })];
    },
    addNodeView() {
        return ({ node, editor }) => {
            const dom = document.createElement('span');
            dom.classList.add('sn-math-node');
            
            const render = () => {
                if (window.katex) {
                    try {
                        window.katex.render(node.attrs.latex || '...', dom, {
                            throwOnError: false,
                            displayMode: false,
                        });
                    } catch (e) { dom.textContent = node.attrs.latex; }
                } else {
                    dom.textContent = node.attrs.latex;
                    setTimeout(render, 500);
                }
            };

            render();
            
            dom.onclick = () => {
                const newLatex = window.prompt('Edit LaTeX:', node.attrs.latex);
                if (newLatex !== null) {
                    editor.commands.updateAttributes('math', { latex: newLatex });
                }
            };

            return { dom };
        };
    },
    addPasteRules() {
        return [
            new PasteRule({
                find: /\$\$(.*?)\$\$/gs,
                type: this.type,
                getAttributes: match => ({ latex: match[1] }),
            }),
            new PasteRule({
                find: /\$(.*?)\$/g,
                type: this.type,
                getAttributes: match => ({ latex: match[1] }),
            }),
            new PasteRule({
                find: /\\\[(.*?)\\\]/gs,
                type: this.type,
                getAttributes: match => ({ latex: match[1] }),
            }),
            new PasteRule({
                find: /\\\((.*?)\\\)/g,
                type: this.type,
                getAttributes: match => ({ latex: match[1] }),
            }),
        ];
    }
});

// ── Audio Extension ──────────────────────────────────────────
export const AudioExtension = Node.create({
    name: 'audio',
    group: 'block',
    atom: true,
    addAttributes() {
        return {
            src: { default: '' },
            media_id: { default: '' },
            filename: { default: '' },
        };
    },
    parseHTML() {
        return [
            { tag: 'audio', getAttrs: el => ({ 
                src: el.getAttribute('src'), 
                media_id: el.getAttribute('data-media-id'),
                filename: el.getAttribute('data-filename')
            }) },
            { tag: 'iframe.sn-audio-iframe', getAttrs: el => ({ 
                src: el.getAttribute('src'), 
                media_id: el.getAttribute('data-media-id'),
                filename: el.getAttribute('data-filename')
            }) },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        const src = HTMLAttributes.src || '';
        const dataAttrs = { 
            'data-media-id': HTMLAttributes.media_id,
            'data-filename': HTMLAttributes.filename 
        };
        return ['audio', mergeAttributes(dataAttrs, { src, controls: 'controls', class: 'sn-embedded-audio' })];
    }
});

// ── File Extension ───────────────────────────────────────────
export const FileExtension = Node.create({
    name: 'file',
    group: 'block',
    atom: true,
    addAttributes() {
        return {
            href: { default: '' },
            filename: { default: '' },
            media_id: { default: '' },
        };
    },
    parseHTML() {
        return [{ tag: 'div.sn-media-pill-embed', getAttrs: el => ({ 
            href: el.getAttribute('data-href'), 
            filename: el.getAttribute('data-filename'),
            media_id: el.getAttribute('data-media-id')
        }) }];
    },
    renderHTML({ HTMLAttributes }) {
        const { href, filename, media_id } = HTMLAttributes;
        return ['div', { class: 'sn-media-pill-embed', 'data-href': href, 'data-filename': filename, 'data-media-id': media_id },
            ['div', { class: 'sn-media-pill-icon' }, '📄'],
            ['span', { class: 'sn-media-pill-name' }, filename || 'Attached File']
        ];
    }
});
