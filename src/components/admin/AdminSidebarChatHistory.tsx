import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useWebOperatorSidebarChats } from '../../contexts/WebOperatorChatsBridgeContext';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

type Props = { onAfterSelect?: () => void };

export function AdminSidebarChatHistory({ onAfterSelect }: Props) {
  const ctx = useWebOperatorSidebarChats();

  if (!ctx || !ctx.pageActive) {
    return null;
  }

  const { chats, currentChatId, indexLoading, selectChat, newChat, deleteChat } = ctx;

  return (
    <div className="flex flex-col flex-1 min-h-0 border-t border-gray-200 mt-1 pt-2">
      <div className="px-3 pb-2 flex items-center justify-between gap-2 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Historie</span>
        <button
          type="button"
          onClick={() => {
            newChat();
            onAfterSelect?.();
          }}
          className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-bold text-[#001161] bg-[#001161]/6 hover:bg-[#001161]/10 transition-colors cursor-pointer shrink-0"
          style={FF}
          title="Nový chat"
        >
          <Plus className="w-3 h-3" />
          Nový
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-3 space-y-0.5">
        {indexLoading && chats.length === 0 ? (
          <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-[#001161]/45" style={FF}>
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            Načítám…
          </div>
        ) : chats.length === 0 ? (
          <p className="text-[11px] text-[#001161]/45 px-2 leading-snug" style={FF}>
            Zatím žádné uložené konverzace. Po odpovědi agenta se chat uloží sám.
          </p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`group relative rounded-lg px-2 py-1.5 border ${
                chat.id === currentChatId
                  ? 'border-[#7C3AED]/35 bg-[#7C3AED]/6'
                  : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  selectChat(chat.id);
                  onAfterSelect?.();
                }}
                className="w-full text-left cursor-pointer pr-6"
              >
                <p style={FF} className="text-[12px] font-bold text-[#001161] truncate leading-tight">
                  {chat.title}
                </p>
                <p style={FF} className="text-[10px] text-[#001161]/35 mt-0.5 truncate">
                  {new Date(chat.updatedAt).toLocaleString('cs-CZ')}
                  {typeof chat.messageCount === 'number' ? ` · ${chat.messageCount} zpráv` : ''}
                </p>
              </button>
              <button
                type="button"
                onClick={(e) => deleteChat(chat.id, e)}
                className="absolute top-1 right-1 p-1 rounded-md text-[#001161]/25 hover:text-red-600 hover:bg-red-50 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Smazat chat"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
