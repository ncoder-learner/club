import { useCallback, useEffect, useRef, useState } from 'react';
import * as store from '../lib/storage';
import { streamChat, AuthError, RateLimitError, UpstreamError } from '../lib/api';

function friendlyMessage(err) {
  if (err instanceof RateLimitError) {
    const wait = err.retryAfter ? ` Try again in about ${Math.ceil(err.retryAfter)}s.` : ' Try again in a bit.';
    return `Muffin's a little overloaded right now (rate limited).${wait}`;
  }
  if (err instanceof UpstreamError) {
    if (/context|too long|maximum.*token|reduce.*length/i.test(err.message)) {
      return "This conversation has gotten too long for Muffin to keep in mind at once. Try starting a new chat, or ask a more focused follow-up question.";
    }
    return "Sorry — Muffin's brain (Groq) had trouble answering that. Please try again.";
  }
  return `Sorry — something went wrong talking to Muffin: ${err.message}`;
}

// Groq's free models cap out well before "infinite" context, and resending the
// entire chat history on every message means a long conversation eventually gets
// permanently stuck. Keep only as much recent history (by rough character count,
// not exact tokens) as fits comfortably, always preserving the newest message.
const MAX_HISTORY_CHARS = 60000;

function messageCharLength(message) {
  const textLen = message.text?.length ?? 0;
  const filesLen = message.files?.reduce((sum, f) => sum + f.text.length, 0) ?? 0;
  return textLen + filesLen;
}

function trimHistoryForApi(messages) {
  let total = 0;
  const kept = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messageCharLength(messages[i]);
    kept.unshift(messages[i]);
    if (total > MAX_HISTORY_CHARS && kept.length > 1) break;
  }
  return kept;
}

export function useChats() {
  const [chats, setChats] = useState(() => store.listChats());
  const [activeChatId, setActiveChatIdState] = useState(() => store.getActiveChatId());
  const [isThinking, setIsThinking] = useState(false);
  const [streaming, setStreaming] = useState(null); // { chatId, text }
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const refresh = useCallback(() => {
    setChats(store.listChats());
  }, []);

  useEffect(() => {
    if (activeChatId && !store.getChat(activeChatId)) {
      setActiveChatIdState(null);
    }
  }, [activeChatId, chats]);

  const activeChat = activeChatId ? store.getChat(activeChatId) : null;

  const selectChat = useCallback((id) => {
    store.setActiveChatId(id);
    setActiveChatIdState(id);
  }, []);

  const newChat = useCallback(() => {
    const chat = store.createChat();
    refresh();
    setActiveChatIdState(chat.id);
    return chat;
  }, [refresh]);

  const removeChat = useCallback(
    (id) => {
      store.deleteChat(id);
      refresh();
      if (activeChatId === id) setActiveChatIdState(null);
    },
    [activeChatId, refresh]
  );

  const rename = useCallback(
    (id, title) => {
      store.renameChat(id, title);
      refresh();
    },
    [refresh]
  );

  const clearAll = useCallback(() => {
    store.clearAllChats();
    refresh();
    setActiveChatIdState(null);
  }, [refresh]);

  const runStream = useCallback(
    async (chatId, historyForApi, passcode) => {
      setError(null);
      setIsThinking(true);
      setStreaming({ chatId, text: '' });

      const controller = new AbortController();
      abortRef.current = controller;

      let full = '';
      let stoppedEarly = false;
      try {
        full = await streamChat({
          messages: trimHistoryForApi(historyForApi),
          passcode,
          signal: controller.signal,
          onDelta: (_chunk, soFar) => {
            setIsThinking(false);
            setStreaming({ chatId, text: soFar });
          },
        });
      } catch (err) {
        if (err.name === 'AbortError') {
          stoppedEarly = true;
        } else if (err instanceof AuthError) {
          setError('auth');
          setStreaming(null);
          setIsThinking(false);
          abortRef.current = null;
          return;
        } else {
          store.addMessage(chatId, {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: friendlyMessage(err),
            images: [],
            files: [],
            createdAt: Date.now(),
            isError: true,
          });
          refresh();
          setStreaming(null);
          setIsThinking(false);
          abortRef.current = null;
          return;
        }
      }

      abortRef.current = null;
      setIsThinking(false);
      setStreaming(null);

      const text = stoppedEarly
        ? `${full}\n\n*(stopped)*`
        : full.trim()
          ? full
          : "Muffin didn't generate a reply for that one (its response came back empty). Try rephrasing, or ask again.";
      store.addMessage(chatId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text,
        images: [],
        files: [],
        createdAt: Date.now(),
        isError: !stoppedEarly && !full.trim(),
      });
      refresh();
    },
    [refresh]
  );

  const sendMessage = useCallback(
    async ({ text, images = [], files = [], passcode }) => {
      let chatId = activeChatId;
      if (!chatId) {
        const chat = store.createChat();
        chatId = chat.id;
        setActiveChatIdState(chatId);
      }

      const userMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        images,
        files,
        createdAt: Date.now(),
      };
      store.addMessage(chatId, userMessage);
      refresh();

      const chat = store.getChat(chatId);
      await runStream(chatId, chat.messages, passcode);
    },
    [activeChatId, refresh, runStream]
  );

  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(
    async (passcode) => {
      if (!activeChatId) return;
      const chat = store.getChat(activeChatId);
      if (!chat || chat.messages.length === 0) return;

      const messages = [...chat.messages];
      while (messages.length && messages[messages.length - 1].role === 'assistant') {
        messages.pop();
      }
      if (messages.length === 0) return;

      store.updateChatMessages(activeChatId, messages);
      refresh();
      await runStream(activeChatId, messages, passcode);
    },
    [activeChatId, refresh, runStream]
  );

  return {
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
    clearAll,
    sendMessage,
    stopGenerating,
    regenerate,
  };
}
