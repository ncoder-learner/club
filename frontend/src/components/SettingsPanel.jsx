import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Moon, RefreshCw, Sun, Trash2, X } from 'lucide-react';
import { getUsage } from '../lib/api';

const GEMINI_STATUS = {
  ok: { label: 'Working normally', icon: CheckCircle2, color: 'text-emerald-400' },
  rate_limited: { label: 'Rate-limited right now — falling back to Groq', icon: AlertTriangle, color: 'text-amber-400' },
  zero_quota: {
    label: 'No quota allocated (billing not linked on the Google Cloud project) — falling back to Groq',
    icon: AlertTriangle,
    color: 'text-red-400',
  },
  unconfigured: { label: 'No API key set', icon: HelpCircle, color: 'text-zinc-500' },
  unknown: { label: 'No recent requests yet', icon: HelpCircle, color: 'text-zinc-500' },
};

function GroqUsage({ groq }) {
  if (!groq) {
    return <p className="text-xs text-zinc-500">No recent requests yet.</p>;
  }
  const pct = Math.min(100, groq.percentUsed);
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-accent';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-300">Groq</span>
        <span className="text-zinc-400">
          {groq.used} / {groq.limit} requests ({groq.percentUsed}%)
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {groq.resetIn && <p className="mt-1 text-[11px] text-zinc-600">Resets in {groq.resetIn}</p>}
    </div>
  );
}

function GeminiStatusRow({ gemini }) {
  const info = GEMINI_STATUS[gemini?.status] ?? GEMINI_STATUS.unknown;
  const Icon = info.icon;
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon size={14} className={`mt-0.5 shrink-0 ${info.color}`} />
      <div>
        <span className="text-zinc-300">Gemini — </span>
        <span className={info.color}>{info.label}</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="glass flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-muffin-lg animate-message-in"
        style={{ background: 'rgba(9, 9, 11, 0.97)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div>
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

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Usage</p>
              <button onClick={loadUsage} className="text-zinc-500 hover:text-white" title="Refresh">
                <RefreshCw size={13} className={loadingUsage ? 'animate-spin' : ''} />
              </button>
            </div>
            {usageError && <p className="text-xs text-red-400">{usageError}</p>}
            {usage && !usageError && (
              <div className="glass space-y-3 rounded-muffin p-3">
                <GroqUsage groq={usage.groq} />
                <div className="h-px bg-white/10" />
                <GeminiStatusRow gemini={usage.gemini} />
              </div>
            )}
          </div>

          <div>
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
              questions. It's a free tool — no accounts, no tracking. Chat history stays only in your
              browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
