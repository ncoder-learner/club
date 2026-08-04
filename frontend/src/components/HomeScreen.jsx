import { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { getGreeting } from '../lib/time';

const SUGGESTIONS = [
  { label: 'Research', icon: '🔎', prompt: 'Can you help me research ' },
  { label: 'Code', icon: '💻', prompt: 'Help me write code that ' },
  { label: 'USACO', icon: '🏆', prompt: 'Help me solve this USACO problem: ' },
  { label: 'Homework', icon: '📚', prompt: 'Help me understand this homework problem: ' },
  { label: 'Debug', icon: '🐛', prompt: "Here's a bug in my code, help me find it:\n\n" },
  { label: 'Explain', icon: '💡', prompt: 'Explain how this works: ' },
];

export default function HomeScreen({ onSubmit }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  const submit = (e) => {
    e?.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
  };

  const useSuggestion = (prompt) => {
    setValue(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6">
      <div className="text-center animate-message-in">
        <div className="mb-3 text-5xl">🧁</div>
        <h1 className="text-2xl font-semibold text-white">{getGreeting()}</h1>
        <p className="mt-1 text-sm text-zinc-400">What are we working on today?</p>
      </div>

      <form onSubmit={submit} className="glass w-full max-w-2xl rounded-muffin-lg p-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <Search size={18} className="shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="What can I help with?"
            className="w-full bg-transparent text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
        </div>
      </form>

      <div className="flex w-full max-w-2xl flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => useSuggestion(s.prompt)}
            className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-zinc-300 transition hover:-translate-y-0.5 hover:text-white hover:shadow-lg hover:shadow-black/20"
          >
            <span>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
