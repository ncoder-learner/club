import { useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import MessageBubble from './MessageBubble';
import Composer from './Composer';
import ThinkingIndicator from './ThinkingIndicator';

export default function ChatScreen({
  chatsApi,
  passcode,
  onOpenSettings,
  onGoHome,
  onOpenSandbox,
  composerRef,
  pendingInput,
  onConsumePendingInput,
}) {
  const {
    chats,
    activeChat,
    activeChatId,
    isThinking,
    streaming,
    error,
    setError,
    selectChat,
    newChat,
    removeChat,
    rename,
    sendMessage,
    stopGenerating,
    regenerate,
    editMessage,
  } = chatsApi;
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  const isGenerating = isThinking || streaming != null;
  const isStreamingThisChat = streaming?.chatId === activeChatId;

  useEffect(() => {
    if (pendingInput != null) {
      setInput(pendingInput);
      onConsumePendingInput?.();
    }
  }, [pendingInput]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeChat?.messages?.length, isThinking, streaming?.text]);

  const handleSend = ({ text, images, files }) => {
    setInput('');
    sendMessage({ text, images, files, passcode });
  };

  const exportChat = (chatId) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    const markdown = chat.messages
      .map((m) => `**${m.role === 'user' ? 'You' : 'Muffin'}:**\n\n${m.text ?? ''}`)
      .join('\n\n---\n\n');
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chat.title || 'muffin-chat'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const messages = activeChat?.messages ?? [];
  const lastAssistantIndex = [...messages].reverse().findIndex((m) => m.role === 'assistant');
  const lastAssistantId =
    lastAssistantIndex === -1 ? null : messages[messages.length - 1 - lastAssistantIndex].id;

  return (
    <div className="flex h-full w-full gap-3 p-3">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={selectChat}
        onNewChat={newChat}
        onDeleteChat={removeChat}
        onRenameChat={rename}
        onExportChat={exportChat}
        onOpenSettings={onOpenSettings}
        onOpenSandbox={() => onOpenSandbox()}
        onGoHome={onGoHome}
      />

      <div className="flex h-full flex-1 flex-col gap-3">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto rounded-muffin-lg px-2 py-4">
          {messages.length === 0 && !isGenerating && (
            <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
              <span className="mb-3 text-4xl">🧁</span>
              <p className="text-sm">Ask Muffin anything — code, USACO prep, homework, debugging.</p>
            </div>
          )}
          {messages.map((message, i) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRegenerate={
                message.id === lastAssistantId && message.role === 'assistant' && !isGenerating
                  ? () => regenerate(passcode)
                  : undefined
              }
              onEdit={
                message.role === 'user' && !isGenerating
                  ? (newText) => editMessage(message.id, newText, passcode)
                  : undefined
              }
              onOpenSandbox={onOpenSandbox}
              // A reply to a message that came with an attached file is likely meant
              // to be handed back as a document, not just read in the chat — surface
              // the .docx export prominently instead of leaving it hidden on hover.
              highlightDocExport={message.role === 'assistant' && messages[i - 1]?.files?.length > 0}
            />
          ))}
          {isThinking && isStreamingThisChat && <ThinkingIndicator />}
          {isStreamingThisChat && streaming.text && (
            <MessageBubble
              message={{ id: 'streaming', role: 'assistant', text: streaming.text, images: [], files: [] }}
              isStreaming
            />
          )}
        </div>

        {error === 'auth' && (
          <div className="glass flex items-center justify-between rounded-muffin px-4 py-2 text-sm text-red-300">
            Incorrect passcode. Please refresh and re-enter it.
            <button onClick={() => setError(null)} className="text-zinc-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        <Composer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={isGenerating}
          isGenerating={isGenerating}
          onStop={stopGenerating}
          autoFocusRef={composerRef}
        />
      </div>
    </div>
  );
}
