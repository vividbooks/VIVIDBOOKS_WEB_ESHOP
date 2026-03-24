import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

export type WOBChatIndex = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount?: number;
};

type PageApi = {
  loadChat: (id: string) => Promise<void>;
  newChat: () => void;
  deleteChat: (id: string, e: React.MouseEvent) => Promise<void>;
};

type BridgeApi = {
  syncFromPage: (chats: WOBChatIndex[], currentChatId: string, indexLoading: boolean) => void;
  registerPage: (api: PageApi) => void;
  unregisterPage: () => void;
};

type SidebarApi = {
  chats: WOBChatIndex[];
  currentChatId: string;
  indexLoading: boolean;
  selectChat: (id: string) => void;
  newChat: () => void;
  deleteChat: (id: string, e: React.MouseEvent) => void;
  pageActive: boolean;
};

const BridgeContext = createContext<BridgeApi | null>(null);
const SidebarContext = createContext<SidebarApi | null>(null);

export function WebOperatorChatsBridgeProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<WOBChatIndex[]>([]);
  const [currentChatId, setCurrentChatId] = useState('');
  const [indexLoading, setIndexLoading] = useState(false);
  const [pageActive, setPageActive] = useState(false);
  const apiRef = useRef<PageApi | null>(null);

  const registerPage = useCallback((api: PageApi) => {
    apiRef.current = api;
    setPageActive(true);
  }, []);

  const unregisterPage = useCallback(() => {
    apiRef.current = null;
    setPageActive(false);
    setChats([]);
    setCurrentChatId('');
    setIndexLoading(false);
  }, []);

  const syncFromPage = useCallback((next: WOBChatIndex[], id: string, loading: boolean) => {
    setChats(next);
    setCurrentChatId(id);
    setIndexLoading(loading);
  }, []);

  const selectChat = useCallback((id: string) => {
    void apiRef.current?.loadChat(id);
  }, []);

  const newChat = useCallback(() => {
    apiRef.current?.newChat();
  }, []);

  const deleteChat = useCallback((id: string, e: React.MouseEvent) => {
    void apiRef.current?.deleteChat(id, e);
  }, []);

  const bridgeVal = useMemo(
    () => ({ syncFromPage, registerPage, unregisterPage }),
    [syncFromPage, registerPage, unregisterPage]
  );

  const sidebarVal = useMemo(
    () => ({
      chats,
      currentChatId,
      indexLoading,
      selectChat,
      newChat,
      deleteChat,
      pageActive,
    }),
    [chats, currentChatId, indexLoading, selectChat, newChat, deleteChat, pageActive]
  );

  return (
    <BridgeContext.Provider value={bridgeVal}>
      <SidebarContext.Provider value={sidebarVal}>{children}</SidebarContext.Provider>
    </BridgeContext.Provider>
  );
}

export function useWebOperatorChatsBridge() {
  const v = useContext(BridgeContext);
  if (!v) throw new Error('useWebOperatorChatsBridge: chybí WebOperatorChatsBridgeProvider');
  return v;
}

export function useWebOperatorSidebarChats() {
  return useContext(SidebarContext);
}
