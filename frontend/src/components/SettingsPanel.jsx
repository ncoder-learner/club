import { useEffect, useState } from 'react';
import { Moon, RefreshCw, Sun, Trash2, X } from 'lucide-react';
import { getUsage } from '../lib/api';

// Free-tier request caps aren't published as a single stable number and vary
// by account — this is just a visual reference scale for the bar, not a claim
// about your actual quota. Check aistudio.google.com / console.groq.com for
// the real numbers.
const REFERENCE_MAX = 500;

function UsageBar({ label, count }) {
  const pct = Math.min(100, Math.round((count / REFERENCE_MAX) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="text-zinc-500">{count} today</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SettingsPanel({ onClose, onClearChats }) {
  const [confirming, setConfirming] = useState(false);
  const [usage, setUsage] = useState(null);
  const [usageError, setUsageError] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  const loadUsage = () => {
    setLoadingUsage(true);
    setUsageError(null);
    getUsage()
      .then(setUsage)
      .catch((err) => setUsageError(err.message || 'Could not load usage'))
      .finally(() => setLoadingUsage(false));
  };

  useEffect(loadUsage, []);

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
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Usage today</p>
            <button onClick={loadUsage} className="text-zinc-500 hover:text-white" title="Refresh">
              <RefreshCw size={13} className={loadingUsage ? 'animate-spin' : ''} />
            </button>
          </div>
          {usageError && <p className="text-xs text-red-400">{usageError}</p>}
          {usage && !usageError && (
            <div className="space-y-3">
              <UsageBar label="Gemini" count={usage.gemini} />
              <UsageBar label="Groq" count={usage.groq} />
              <p className="text-[11px] text-zinc-600">
                Bars are just a visual reference, not your exact provider quota — check
                aistudio.google.com or console.groq.com for that.
              </p>
            </div>
          )}
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
            questions. It's a free tool built on the Groq API — no accounts, no tracking. Chat
            history stays only in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
