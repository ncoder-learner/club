import { useState } from 'react';
import { Check, Download, Pencil, Plus, Settings, Trash2, X } from 'lucide-react';

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onExportChat,
  onOpenSettings,
  onGoHome,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');

  const startRename = (chat) => {
    setEditingId(chat.id);
    setDraftTitle(chat.title);
  };

  const commitRename = () => {
    if (editingId && draftTitle.trim()) {
      onRenameChat(editingId, draftTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <aside className="glass flex h-full w-72 shrink-0 flex-col rounded-muffin-lg p-3">
      <button
        onClick={onGoHome}
        className="mb-3 flex items-center gap-2 rounded-muffin px-2 py-2 text-left transition hover:bg-white/5"
      >
        <span className="text-2xl">🧁</span>
        <span className="font-semibold tracking-tight text-white">Muffin</span>
      </button>

      <button
        onClick={onNewChat}
        className="mb-3 flex items-center justify-center gap-2 rounded-muffin bg-accent/90 px-3 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-accent hover:shadow-lg hover:shadow-accent/25"
      >
        <Plus size={16} /> New chat
      </button>

      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
        {chats.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-zinc-500">No chats yet</p>
        )}
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`group flex items-center gap-1 rounded-muffin px-2 py-2 transition ${
              chat.id === activeChatId ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
          >
            {editingId === chat.id ? (
              <>
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 rounded-md bg-black/30 px-2 py-1 text-sm text-white outline-none"
                />
                <button onClick={commitRename} className="text-zinc-400 hover:text-emerald-400">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-red-400">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onSelectChat(chat.id)}
                  className="flex-1 truncate text-left text-sm text-zinc-200"
                  title={chat.title}
                >
                  {chat.title}
                </button>
                <button
                  onClick={() => onExportChat(chat.id)}
                  className="text-zinc-500 opacity-0 transition hover:text-white group-hover:opacity-100"
                  title="Export as Markdown"
                >
                  <Download size={13} />
                </button>
                <button
                  onClick={() => startRename(chat)}
                  className="text-zinc-500 opacity-0 transition hover:text-white group-hover:opacity-100"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => onDeleteChat(chat.id)}
                  className="text-zinc-500 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onOpenSettings}
        className="mt-2 flex items-center gap-2 rounded-muffin px-2 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
      >
        <Settings size={16} /> Settings
      </button>
    </aside>
  );
}
