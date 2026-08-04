import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import { Check, Copy, RotateCcw } from 'lucide-react';
import CodeBlock from './CodeBlock';
import { normalizeLatexDelimiters } from '../../lib/latex';

export default function MessageBubble({ message, isStreaming, onRegenerate }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.text ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
          {message.text && (
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-2 prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeHighlight, rehypeKatex]}
                components={{
                  code({ className, children, ...props }) {
                    if (!className) {
                      return (
                        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[13px]" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return <CodeBlock className={className}>{children}</CodeBlock>;
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
        {!isStreaming && message.text && (
          <div className="flex w-fit items-center gap-1">
            <button
              onClick={copyMessage}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-zinc-500 opacity-0 transition hover:text-white group-hover:opacity-100"
              title="Copy reply text"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
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
