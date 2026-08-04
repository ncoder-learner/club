import { useEffect, useState } from 'react';

const STAGES = ['Thinking', 'Searching the web', 'Reasoning'];

export default function ThinkingIndicator() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((i) => (i + 1) % STAGES.length);
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 animate-message-in">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass text-lg">
        🧁
      </div>
      <div className="glass flex items-center gap-3 rounded-muffin px-4 py-3">
        <span className="text-sm text-zinc-300">{STAGES[stageIndex]}</span>
        <span className="flex items-end gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="bounce-dot h-1.5 w-1.5 rounded-full bg-accent"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
