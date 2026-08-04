import { useState } from 'react';
import { Moon, Sun, Trash2, X } from 'lucide-react';

export default function SettingsPanel({ onClose, onClearChats }) {
  const [confirming, setConfirming] = useState(false);

  const handleClear = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onClearChats();
    setConfirming(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="glass w-full max-w-md rounded-muffin-lg p-6 animate-message-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Theme</p>
          <div className="flex gap-2">
            <button className="flex flex-1 items-center justify-center gap-2 rounded-muffin bg-accent/20 px-3 py-2.5 text-sm font-medium text-white ring-1 ring-accent/50">
              <Moon size={16} /> Dark
            </button>
            <button
              disabled
              title="Light mode coming soon"
              className="flex flex-1 items-center justify-center gap-2 rounded-muffin px-3 py-2.5 text-sm text-zinc-600 opacity-50"
            >
              <Sun size={16} /> Light
            </button>
          </div>
        </div>

        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Data</p>
          <button
            onClick={handleClear}
            className={`flex w-full items-center justify-center gap-2 rounded-muffin px-3 py-2.5 text-sm font-medium transition ${
              confirming
                ? 'bg-red-500/90 text-white hover:bg-red-500'
                : 'bg-white/5 text-red-300 hover:bg-red-500/10'
            }`}
          >
            <Trash2 size={16} />
            {confirming ? 'Click again to confirm' : 'Clear all chats'}
          </button>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">About Muffin</p>
          <p className="text-sm leading-relaxed text-zinc-400">
            Muffin 🧁 is the CS Initiative club's assistant for USACO prep, coding help, and general
            questions. It's a free tool built on the Groq API, shared by the whole club with one
            passcode — no accounts, no tracking. Chat history stays only in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
