import { useEffect, useState } from 'react';

export default function Splash({ onDone }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1800);
    const doneTimer = setTimeout(onDone, 2400);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center bg-bg transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-glow rounded-full bg-accent/40 blur-2xl" />
        <div className="relative text-7xl">🧁</div>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-white">MUFFIN</h1>
      <p className="mt-2 text-sm text-zinc-400">
        <span className="text-secondary">Intelligent.</span> Fast. Personal.
      </p>
    </div>
  );
}
