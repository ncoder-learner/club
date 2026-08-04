import { useState } from 'react';

export default function PasscodeGate({ onUnlock, error }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    setSubmitting(true);
    await onUnlock(value.trim());
    setSubmitting(false);
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg">
      <div className="glass w-full max-w-sm rounded-muffin-lg p-8 text-center animate-message-in">
        <div className="mb-4 text-5xl animate-glow">🧁</div>
        <h1 className="mb-1 text-xl font-semibold text-white">Muffin</h1>
        <p className="mb-6 text-sm text-zinc-400">Enter the CS Initiative club passcode to continue.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            autoFocus
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Passcode"
            className="w-full rounded-muffin border border-white/10 bg-black/30 px-4 py-3 text-center text-white placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-muffin bg-accent px-4 py-3 font-medium text-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/25 disabled:opacity-50"
          >
            {submitting ? 'Checking…' : 'Enter'}
          </button>
        </form>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
