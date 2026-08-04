import { useState } from 'react';
import { Check, Copy, Play } from 'lucide-react';

// Maps the language tag markdown gives us (from ```python, ```c++, ```js, etc.)
// to the sandbox's internal language ids. Anything not in here has no "Run" button.
const SANDBOX_LANGUAGE_ALIASES = {
  python: 'python',
  py: 'python',
  cpp: 'cpp',
  'c++': 'cpp',
  cc: 'cpp',
  javascript: 'javascript',
  js: 'javascript',
};

// rehype-highlight wraps tokens in nested <span> elements, so `children` here is a
// tree of React elements, not a plain string — String(children) on that produces
// "[object Object]" garbage. Walk the tree and pull out just the text.
function extractText(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node?.props?.children != null) return extractText(node.props.children);
  return '';
}

export default function CodeBlock({ className, children, onOpenSandbox }) {
  const [copied, setCopied] = useState(false);
  const language = /language-(\w+)/.exec(className || '')?.[1];
  const code = extractText(children).replace(/\n$/, '');
  const sandboxLanguage = SANDBOX_LANGUAGE_ALIASES[language?.toLowerCase()];

  const onCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-1.5">
        <span className="font-mono text-xs text-zinc-400">{language || 'text'}</span>
        <div className="flex items-center gap-1">
          {sandboxLanguage && onOpenSandbox && (
            <button
              onClick={() => onOpenSandbox(code, sandboxLanguage)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white"
              title="Run this code in the sandbox"
            >
              <Play size={13} />
              Run
            </button>
          )}
          <button
            onClick={onCopy}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}
