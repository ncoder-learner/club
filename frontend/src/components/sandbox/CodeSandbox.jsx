import { useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { ArrowLeft, Check, Download, Loader2, MessageCircleQuestion, MessagesSquare, Play, Terminal, X } from 'lucide-react';
import { runCode, streamChat } from '../../lib/api';

function extractCodeBlock(text) {
  const match = /```(?:\w+)?\n([\s\S]*?)```/.exec(text);
  return match ? match[1].replace(/\n$/, '') : null;
}

// Judge0 reports "NZEC" (non-zero exit code) for any crash, but the single most
// common cause for students here is calling input()/cin/readline with nothing in
// the stdin box — that's a config issue, not a code bug, so it deserves its own
// clearer message instead of a raw Python traceback.
function isMissingStdinError(result, stdinValue) {
  if (!result || stdinValue.trim()) return false;
  const text = `${result.stderr || ''} ${result.statusMessage || ''}`;
  return /EOFError|EOF when reading a line|NZEC/i.test(text);
}

const LANGUAGES = [
  {
    id: 'python',
    label: 'Python',
    ext: 'py',
    extension: python(),
    stub: 'print("Hello, Muffin!")\n',
  },
  {
    id: 'cpp',
    label: 'C++',
    ext: 'cpp',
    extension: cpp(),
    stub:
      '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    cout << "Hello, Muffin!" << endl;\n    return 0;\n}\n',
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    ext: 'js',
    extension: javascript(),
    stub: 'console.log("Hello, Muffin!");\n',
  },
];

export default function CodeSandbox({ passcode, onGoHome, onOpenChat, initialCode, initialLanguage }) {
  const startingLanguage = LANGUAGES.find((l) => l.id === initialLanguage) ?? LANGUAGES[0];
  const [languageId, setLanguageId] = useState(startingLanguage.id);
  const [code, setCode] = useState(initialCode || startingLanguage.stub);
  const [stdin, setStdin] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState(null);
  const codeRef = useRef(code);
  codeRef.current = code;
  const resultRef = useRef(result);
  resultRef.current = result;
  const stdinRef = useRef(null);
  const containerRef = useRef(null);
  const splitRef = useRef(null);

  const [editorWidthPct, setEditorWidthPct] = useState(65);
  const [stdinHeight, setStdinHeight] = useState(96);
  const [askHeightPct, setAskHeightPct] = useState(45);

  // Each handler fixes the starting position and starting size once, at
  // mousedown, then computes an absolute new size on every move — accumulating
  // off the delta instead would compound every intermediate mousemove tick into
  // the total, making the drag runaway far faster than the mouse actually moved.
  const startColResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPct = editorWidthPct;
    const width = splitRef.current?.getBoundingClientRect().width || 1000;
    const onMove = (ev) => {
      const pct = startPct + ((ev.clientX - startX) / width) * 100;
      setEditorWidthPct(Math.min(80, Math.max(30, pct)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startStdinResize = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = stdinHeight;
    const onMove = (ev) => {
      setStdinHeight(Math.min(300, Math.max(48, startHeight + (ev.clientY - startY))));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startAskResize = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startPct = askHeightPct;
    const containerHeight = containerRef.current?.getBoundingClientRect().height || 600;
    const onMove = (ev) => {
      const pct = startPct + ((ev.clientY - startY) / containerHeight) * 100;
      setAskHeightPct(Math.min(80, Math.max(15, pct)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState('');
  const [askError, setAskError] = useState(null);

  const language = LANGUAGES.find((l) => l.id === languageId);

  const switchLanguage = (id) => {
    const next = LANGUAGES.find((l) => l.id === id);
    // Only swap in the new stub if the editor is empty or still holds the old
    // stub untouched — don't clobber code the student actually wrote.
    if (!codeRef.current.trim() || codeRef.current === language.stub) {
      setCode(next.stub);
    }
    setLanguageId(id);
    setResult(null);
    setRunError(null);
  };

  const run = async () => {
    setRunning(true);
    setRunError(null);
    try {
      const res = await runCode({ language: languageId, code, stdin, passcode });
      setResult(res);
    } catch (err) {
      setRunError(err.message || 'Something went wrong running your code.');
    } finally {
      setRunning(false);
    }
  };

  const askAboutCode = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError(null);
    setAnswer('');

    const lastRun = resultRef.current;
    const prompt = [
      `I'm working in a ${language.label} code sandbox. Here's my current code:`,
      '```' + languageId,
      codeRef.current,
      '```',
      stdin.trim() ? `Stdin I'm feeding it:\n${stdin}` : null,
      lastRun
        ? `Last run's output — stdout: ${lastRun.stdout || '(empty)'}${
            lastRun.stderr ? `, stderr: ${lastRun.stderr}` : ''
          }${lastRun.compileStderr ? `, compile error: ${lastRun.compileStderr}` : ''}`
        : null,
      `My question: ${q}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      await streamChat({
        messages: [{ role: 'user', text: prompt, images: [], files: [] }],
        passcode,
        onDelta: (_chunk, soFar) => setAnswer(soFar),
      });
      setQuestion('');
    } catch (err) {
      setAskError(err.message || 'Something went wrong asking Muffin.');
    } finally {
      setAsking(false);
    }
  };

  const applyAnswerCode = () => {
    const block = extractCodeBlock(answer);
    if (block) setCode(block);
  };

  const save = async () => {
    // File System Access API lets the student pick a name and folder in a real
    // "Save As" dialog. Only Chromium browsers support it — everywhere else falls
    // back to a plain download into the browser's default downloads folder.
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: `muffin-sandbox.${language.ext}`,
          types: [{ description: language.label, accept: { 'text/plain': [`.${language.ext}`] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(codeRef.current);
        await writable.close();
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
      return;
    }

    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muffin-sandbox.${language.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div ref={containerRef} className="flex h-full w-full flex-col gap-3 p-3">
      <div className="glass flex items-center justify-between rounded-muffin-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onGoHome} className="text-zinc-400 transition hover:text-white" title="Back">
            <ArrowLeft size={18} />
          </button>
          <span className="text-lg">🧪</span>
          <span className="font-semibold text-white">Code Sandbox</span>
        </div>
        <div className="flex items-center gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => switchLanguage(l.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                l.id === languageId
                  ? 'bg-accent text-white'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {l.label}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-white/10" />
          <button
            onClick={() => setAskOpen((o) => !o)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              askOpen ? 'bg-accent text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <MessageCircleQuestion size={15} /> Ask Muffin
          </button>
          <button
            onClick={onOpenChat}
            className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-white/10 hover:text-white"
            title="Back to normal chat"
          >
            <MessagesSquare size={15} /> Chat
          </button>
        </div>
      </div>

      {askOpen && (
        <div
          className="glass flex flex-col overflow-hidden rounded-muffin-lg"
          style={{ height: `${askHeightPct}%` }}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <span className="flex items-center gap-1.5 font-mono text-xs text-zinc-400">
              <MessageCircleQuestion size={13} /> Ask Muffin about this code
            </span>
            <button onClick={() => setAskOpen(false)} className="text-zinc-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && askAboutCode()}
              placeholder="e.g. why is this segfaulting? or: make this iterative instead of recursive"
              className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            <button
              onClick={askAboutCode}
              disabled={asking || !question.trim()}
              className="flex items-center gap-1 rounded-full bg-accent/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent disabled:opacity-50"
            >
              {asking ? <Loader2 size={13} className="animate-spin" /> : null}
              {asking ? 'Thinking…' : 'Ask'}
            </button>
          </div>
          <div className="flex-1 overflow-auto px-4 py-3 text-sm leading-relaxed text-zinc-200">
            {askError && <p className="text-red-400">{askError}</p>}
            {!askError && !answer && !asking && (
              <p className="text-zinc-600">
                Muffin can see your current code{stdin.trim() || result ? ', stdin, and last run output' : ''} —
                ask about bugs, ask it to explain a part, or ask for a change.
              </p>
            )}
            {answer && <pre className="whitespace-pre-wrap font-sans">{answer}</pre>}
            {!asking && extractCodeBlock(answer) && (
              <button
                onClick={applyAnswerCode}
                className="mt-2 flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30"
              >
                <Check size={13} /> Apply this code to the editor
              </button>
            )}
          </div>
          <div
            onMouseDown={startAskResize}
            className="h-1.5 shrink-0 cursor-row-resize bg-transparent transition hover:bg-accent/40"
            title="Drag to resize"
          />
        </div>
      )}

      <div ref={splitRef} className="flex flex-1 gap-0 overflow-hidden">
        <div
          className="glass flex flex-col overflow-hidden rounded-muffin-lg"
          style={{ width: `${editorWidthPct}%` }}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <span className="font-mono text-xs text-zinc-400">main.{language.ext}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white"
                title="Save to your computer"
              >
                <Download size={13} /> Save
              </button>
              <button
                onClick={run}
                disabled={running}
                className="flex items-center gap-1 rounded-full bg-accent/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent disabled:opacity-50"
              >
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                {running ? 'Running…' : 'Run'}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <CodeMirror
              value={code}
              onChange={setCode}
              theme={oneDark}
              extensions={[language.extension]}
              basicSetup={{ autocompletion: true, closeBrackets: true, bracketMatching: true }}
              height="100%"
              className="h-full text-[13px]"
            />
          </div>
        </div>

        <div
          onMouseDown={startColResize}
          className="mx-1 w-1.5 shrink-0 cursor-col-resize rounded-full bg-transparent transition hover:bg-accent/40"
          title="Drag to resize"
        />

        <div className="glass flex flex-1 flex-col overflow-hidden rounded-muffin-lg">
          <div className="border-b border-white/10 px-4 py-2">
            <span className="flex items-center gap-1.5 font-mono text-xs text-zinc-400">
              <Terminal size={13} /> Input (stdin)
            </span>
          </div>
          <textarea
            ref={stdinRef}
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Anything your program reads from stdin..."
            style={{ height: stdinHeight }}
            className="shrink-0 resize-none bg-transparent px-4 py-2 font-mono text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          <div
            onMouseDown={startStdinResize}
            className="h-1.5 shrink-0 cursor-row-resize bg-transparent transition hover:bg-accent/40"
            title="Drag to resize"
          />
          <div className="border-t border-white/10 px-4 py-2">
            <span className="font-mono text-xs text-zinc-400">Output</span>
          </div>
          <div className="flex-1 overflow-auto px-4 py-2 font-mono text-[13px] leading-relaxed">
            {runError && <p className="text-red-400">{runError}</p>}
            {!runError && !result && !running && (
              <p className="text-zinc-600">Run your code to see output here.</p>
            )}
            {running && <p className="text-zinc-500">Running…</p>}
            {result && (
              <>
                {isMissingStdinError(result, stdin) && (
                  <p className="mb-2 text-blue-300">
                    This program is waiting for input (via input()/cin/readline) but the "Input (stdin)"
                    box is empty.{' '}
                    <button
                      onClick={() => stdinRef.current?.focus()}
                      className="underline hover:text-blue-200"
                    >
                      Fill it in above
                    </button>{' '}
                    and run again.
                  </p>
                )}
                {result.statusMessage && <p className="text-amber-300">{result.statusMessage}</p>}
                {result.compileStderr && (
                  <>
                    <p className="mb-1 text-xs uppercase tracking-wide text-amber-400/80">Compile error</p>
                    <pre className="mb-3 whitespace-pre-wrap text-amber-300">{result.compileStderr}</pre>
                  </>
                )}
                {result.stdout && <pre className="whitespace-pre-wrap text-zinc-200">{result.stdout}</pre>}
                {result.stderr && <pre className="mt-2 whitespace-pre-wrap text-red-400">{result.stderr}</pre>}
                {!result.stdout && !result.stderr && !result.compileStderr && !result.statusMessage && (
                  <p className="text-zinc-600">(no output)</p>
                )}
                {result.exitCode != null && result.exitCode !== 0 && (
                  <p className="mt-2 text-xs text-zinc-500">Exited with code {result.exitCode}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
