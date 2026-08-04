import { useEffect, useMemo, useState } from 'react';
import { MessageSquarePlus, Search, Settings, Trash2, TextCursorInput } from 'lucide-react';

export default function CommandPalette({ onClose, commands }) {
  const [query, setQuery] = useState('');

  const items = useMemo(
    () => [
      { id: 'new-chat', label: 'New Chat', icon: MessageSquarePlus, run: commands.newChat },
      { id: 'clear-chats', label: 'Clear Chats', icon: Trash2, run: commands.clearChats },
      { id: 'focus-input', label: 'Focus Input', icon: TextCursorInput, run: commands.focusInput },
      { id: 'open-settings', label: 'Open Settings', icon: Settings, run: commands.openSettings },
    ],
    [commands]
  );

  const filtered = items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = (item) => {
    item.run();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-lg overflow-hidden rounded-muffin-lg animate-message-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search size={16} className="text-zinc-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-zinc-500">No matching commands</p>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => run(item)}
              className="flex w-full items-center gap-3 rounded-muffin px-3 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-white/10"
            >
              <item.icon size={16} className="text-zinc-400" />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
