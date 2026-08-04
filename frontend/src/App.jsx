import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Splash from './components/Splash';
import PasscodeGate from './components/PasscodeGate';
import HomeScreen from './components/HomeScreen';
import { useChats } from './hooks/useChats';
import * as store from './lib/storage';
import { verifyPasscode } from './lib/api';

// ChatScreen pulls in react-markdown/katex/highlight.js, which are the bulk of the
// bundle — deferring them until the user actually opens a chat keeps the passcode
// gate and home screen loading fast.
const ChatScreen = lazy(() => import('./components/chat/ChatScreen'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
// CodeMirror + its language packages are only needed once someone opens the sandbox.
const CodeSandbox = lazy(() => import('./components/sandbox/CodeSandbox'));

export default function App() {
  const [phase, setPhase] = useState(() => (store.hasSeenSplash() ? 'ready' : 'splash'));
  const [passcode, setPasscode] = useState(() => store.getSavedPasscode());
  const [passcodeError, setPasscodeError] = useState(null);
  const [view, setView] = useState('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingInput, setPendingInput] = useState(null);
  const [sandboxSeed, setSandboxSeed] = useState(null); // { code, language } | null
  const [sandboxKey, setSandboxKey] = useState(0);

  const composerRef = useRef(null);
  const chatsApi = useChats();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const finishSplash = () => {
    store.markSeenSplash();
    setPhase('ready');
  };

  const handleUnlock = async (code) => {
    setPasscodeError(null);
    const ok = await verifyPasscode(code).catch(() => false);
    if (!ok) {
      setPasscodeError('Incorrect passcode. Try again.');
      return;
    }
    store.savePasscode(code);
    setPasscode(code);
  };

  const goHome = () => setView('home');

  const startChatWith = (text) => {
    setView('chat');
    chatsApi.sendMessage({ text, images: [], files: [], passcode });
  };

  const openChat = () => setView('chat');

  const openSandbox = (code, language) => {
    setSandboxSeed(code != null ? { code, language } : null);
    setSandboxKey((k) => k + 1); // remount the editor so new seed code actually loads
    setView('sandbox');
  };

  if (phase === 'splash') {
    return <Splash onDone={finishSplash} />;
  }

  if (!passcode) {
    return <PasscodeGate onUnlock={handleUnlock} error={passcodeError} />;
  }

  return (
    <div className="h-full w-full">
      <Suspense fallback={null}>
        {view === 'home' && <HomeScreen onSubmit={startChatWith} onOpenSandbox={() => openSandbox()} />}
        {view === 'chat' && (
          <ChatScreen
            chatsApi={chatsApi}
            passcode={passcode}
            onOpenSettings={() => setSettingsOpen(true)}
            onGoHome={goHome}
            onOpenSandbox={openSandbox}
            composerRef={composerRef}
            pendingInput={pendingInput}
            onConsumePendingInput={() => setPendingInput(null)}
          />
        )}
        {view === 'sandbox' && (
          <CodeSandbox
            key={sandboxKey}
            passcode={passcode}
            onGoHome={goHome}
            onOpenChat={openChat}
            initialCode={sandboxSeed?.code}
            initialLanguage={sandboxSeed?.language}
          />
        )}

        {settingsOpen && (
          <SettingsPanel onClose={() => setSettingsOpen(false)} onClearChats={chatsApi.clearAll} />
        )}

        {paletteOpen && (
          <CommandPalette
            onClose={() => setPaletteOpen(false)}
            commands={{
              newChat: () => {
                chatsApi.newChat();
                setView('chat');
              },
              clearChats: chatsApi.clearAll,
              focusInput: () => {
                setView('chat');
                setTimeout(() => composerRef.current?.focus(), 0);
              },
              openSettings: () => setSettingsOpen(true),
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
