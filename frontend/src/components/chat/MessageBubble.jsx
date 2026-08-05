import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// The model sometimes answers with inline HTML like <span style="color:red">
// (e.g. "fill in your answers in red" on a worksheet) — extend the default
// sanitize schema just enough to allow that and <br>, rather than stripping it
// entirely or rendering it as literal tag text.
const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'span'],
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), 'style'],
  },
};
import { Check, Copy, FileDown, Loader2, Pencil, RotateCcw, X } from 'lucide-react';
import CodeBlock from './CodeBlock';
import { normalizeLatexDelimiters } from '../../lib/latex';
import { downloadBlob, markdownToDocxBlob } from '../../lib/docs';

export default function MessageBubble({
  message,
  isStreaming,
  onRegenerate,
  onEdit,
  onOpenSandbox,
  highlightDocExport,
}) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.text ?? '');
  const [exporting, setExporting] = useState(false);

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.text ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const exportAsDoc = async () => {
    setExporting(true);
    try {
      const blob = await markdownToDocxBlob(message.text ?? '');
      downloadBlob(blob, `muffin-${isUser ? 'message' : 'reply'}.docx`);
    } finally {
      setExporting(false);
    }
  };

  const startEdit = () => {
    setDraft(message.text ?? '');
    setIsEditing(true);
  };

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== message.text) onEdit(trimmed);
    setIsEditing(false);
  };

  return (
    <div className={`group flex items-start gap-3 animate-message-in ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass text-lg">
        {isUser ? '🙋' : '🧁'}
      </div>
      <div className="flex max-w-[min(720px,80%)] flex-col gap-1">
        <div
          className={`glass rounded-muffin px-4 py-3 ${isUser ? 'bg-accent/15' : ''} ${
            message.isError ? 'border-red-500/40' : ''
          }`}
        >
          {message.images?.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {message.images.map((img, i) => (
                <img
                  key={i}
                  src={img.dataUrl}
                  alt={img.name}
                  className="h-28 w-28 rounded-xl border border-white/10 object-cover"
                />
              ))}
            </div>
          )}
          {message.files?.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {message.files.map((f, i) => (
                <span
                  key={i}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
                >
                  📄 {f.name}
                </span>
              ))}
            </div>
          )}
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    saveEdit();
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                  }
                }}
                autoFocus
                rows={Math.min(10, Math.max(2, draft.split('\n').length))}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-accent/50"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-zinc-400 hover:text-white"
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-1 rounded-full bg-accent/80 px-3 py-1 text-xs text-white hover:bg-accent"
                >
                  <Check size={12} /> Save &amp; submit
                </button>
              </div>
            </div>
          ) : message.text && (
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-2 prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[
                  rehypeRaw,
                  [rehypeSanitize, markdownSanitizeSchema],
                  rehypeHighlight,
                  rehypeKatex,
                ]}
                components={{
                  code({ className, children, ...props }) {
                    if (!className) {
                      return (
                        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[13px]" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <CodeBlock className={className} onOpenSandbox={onOpenSandbox}>
                        {children}
                      </CodeBlock>
                    );
                  },
                  pre({ children }) {
                    return <>{children}</>;
                  },
                }}
              >
                {normalizeLatexDelimiters(message.text)}
              </ReactMarkdown>
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-secondary align-middle" />
              )}
            </div>
          )}
        </div>
        {!isStreaming && !isEditing && highlightDocExport && message.text && (
          <button
            onClick={exportAsDoc}
            disabled={exporting}
            className="flex w-fit items-center gap-2 rounded-full bg-accent/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent disabled:opacity-60"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {exporting ? 'Preparing document…' : 'Download completed doc (.docx)'}
          </button>
        )}
        {!isStreaming && !isEditing && message.text && (
          <div className={`flex w-fit items-center gap-1 ${isUser ? 'self-end' : ''}`}>
            <button
              onClick={copyMessage}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-zinc-500 opacity-0 transition hover:text-white group-hover:opacity-100"
              title="Copy message text"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {!highlightDocExport && (
              <button
                onClick={exportAsDoc}
                disabled={exporting}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-zinc-500 opacity-0 transition hover:text-white group-hover:opacity-100"
                title="Download as a Word document"
              >
                {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                .docx
              </button>
            )}
            {onEdit && (
              <button
                onClick={startEdit}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-zinc-500 opacity-0 transition hover:text-white group-hover:opacity-100"
                title="Edit and resend"
              >
                <Pencil size={12} /> Edit
              </button>
            )}
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-zinc-500 opacity-0 transition hover:text-white group-hover:opacity-100"
                title="Regenerate response"
              >
                <RotateCcw size={12} /> Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
