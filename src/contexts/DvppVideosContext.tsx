import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

export interface DvppTopic {
  id: string;
  name: string;
  slug: string;
  order: number;
}

export interface DvppVideo {
  id: string;
  name: string;
  slug: string;
  thumbnail: string;
  youtubeUrl: string;
  certificateUrl: string;
  orangeButtonText: string;
  orangeButtonLink: string;
  greyButtonText: string;
  /** Stejné jako u webináře v CMS — `survey` = interní DVPP dotazník místo externího odkazu. */
  certificateLinkMode?: 'external' | 'survey';
  topicIds: string[];
  description: string;
}

interface DvppVideosContextType {
  topics: DvppTopic[];
  videos: DvppVideo[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  sync: () => Promise<void>;
}

const DvppVideosContext = createContext<DvppVideosContextType>({
  topics: [],
  videos: [],
  loading: true,
  error: null,
  refresh: () => {},
  sync: async () => {},
});

export function DvppVideosProvider({ children }: { children: ReactNode }) {
  const [topics, setTopics]   = useState<DvppTopic[]>([]);
  const [videos, setVideos]   = useState<DvppVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER}/dvpp-videos`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = await res.json();
      const sortedTopics = [...(data.topics ?? [])].sort(
        (a: DvppTopic, b: DvppTopic) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name),
      );
      setTopics(sortedTopics);
      setVideos(data.videos ?? []);
    } catch (e: any) {
      console.error('[DvppVideosContext] fetch error:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function sync() {
    try {
      const res = await fetch(`${SERVER}/dvpp-videos/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync selhal');
      console.log('[DvppVideosContext] sync ok:', data);
      await fetchData();
    } catch (e: any) {
      console.error('[DvppVideosContext] sync error:', e.message);
      throw e;
    }
  }

  useEffect(() => { fetchData(); }, []);

  return (
    <DvppVideosContext.Provider value={{ topics, videos, loading, error, refresh: fetchData, sync }}>
      {children}
    </DvppVideosContext.Provider>
  );
}

export function useDvppVideos() {
  return useContext(DvppVideosContext);
}