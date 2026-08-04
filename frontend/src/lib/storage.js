const KEYS = {
  chats: 'muffin_chats',
  activeChat: 'muffin_active_chat',
  seenSplash: 'muffin_seen_splash',
  passcode: 'muffin_passcode',
};

function readChats() {
  try {
    const raw = localStorage.getItem(KEYS.chats);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeChats(chats) {
  localStorage.setItem(KEYS.chats, JSON.stringify(chats));
}

export function listChats() {
  const chats = readChats();
  return Object.values(chats).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getChat(id) {
  const chats = readChats();
  return chats[id] ?? null;
}

export function createChat(title = 'New chat') {
  const chats = readChats();
  const id = crypto.randomUUID();
  const now = Date.now();
  chats[id] = { id, title, createdAt: now, updatedAt: now, messages: [] };
  writeChats(chats);
  setActiveChatId(id);
  return chats[id];
}

export function renameChat(id, title) {
  const chats = readChats();
  if (!chats[id]) return;
  chats[id].title = title;
  chats[id].updatedAt = Date.now();
  writeChats(chats);
}

export function deleteChat(id) {
  const chats = readChats();
  delete chats[id];
  writeChats(chats);
  if (getActiveChatId() === id) {
    setActiveChatId(null);
  }
}

export function clearAllChats() {
  writeChats({});
  setActiveChatId(null);
}

export function addMessage(chatId, message) {
  const chats = readChats();
  const chat = chats[chatId];
  if (!chat) return null;
  chat.messages.push(message);
  chat.updatedAt = Date.now();
  if (chat.title === 'New chat' && message.role === 'user' && message.text) {
    chat.title = message.text.slice(0, 48);
  }
  writeChats(chats);
  return chat;
}

export function updateChatMessages(chatId, messages) {
  const chats = readChats();
  const chat = chats[chatId];
  if (!chat) return null;
  chat.messages = messages;
  chat.updatedAt = Date.now();
  writeChats(chats);
  return chat;
}

export function getActiveChatId() {
  return localStorage.getItem(KEYS.activeChat);
}

export function setActiveChatId(id) {
  if (id) localStorage.setItem(KEYS.activeChat, id);
  else localStorage.removeItem(KEYS.activeChat);
}

export function hasSeenSplash() {
  return localStorage.getItem(KEYS.seenSplash) === '1';
}

export function markSeenSplash() {
  localStorage.setItem(KEYS.seenSplash, '1');
}

export function getSavedPasscode() {
  return localStorage.getItem(KEYS.passcode);
}

export function savePasscode(passcode) {
  localStorage.setItem(KEYS.passcode, passcode);
}

export function clearPasscode() {
  localStorage.removeItem(KEYS.passcode);
}
