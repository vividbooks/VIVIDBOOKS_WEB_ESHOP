import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Loader2, Play, RefreshCw, Radio } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useDvppVideos } from '../contexts/DvppVideosContext';
import { useWebinars } from '../contexts/WebinarsContext';
import { WebinarCard } from './WebinarCard';
import { SEOHead } from './SEOHead';
import { DvppVideoCard } from './DvppVideoCard';

const ff = "'Fenomen Sans', sans-serif";

/* ── Main page ───────────────────────────────────────────────────── */
export function WebinarsPage() {
  const { topics, videos, loading, error, sync } = useDvppVideos();
  const { upcoming, loading: webinarsLoading } = useWebinars();
  const navigate = useNavigate();
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      await sync();
      setSyncMsg('Synchronizováno!');
    } catch (e: any) {
      setSyncMsg(`Chyba: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const grouped = useMemo(() => {
    if (activeTopic) {
      const vids = videos.filter(v => v.topicIds.includes(activeTopic));
      const topic = topics.find(t => t.id === activeTopic);
      return topic ? [{ topic, videos: vids }] : [];
    }
    return topics
      .map(topic => ({
        topic,
        videos: videos.filter(v => v.topicIds.includes(topic.id)),
      }))
      .filter(g => g.videos.length > 0);
  }, [topics, videos, activeTopic]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen"
    >
      <SEOHead
        title={'Záznamy DVPP webinářů'}
        path="/webinare"
        description={'Záznamy DVPP webinářů Vividbooks pro učitele — interaktivní výuka, digitální učebnice, metodické tipy a novinky ze světa vzdělávání.'}
      />

      {/* Hero */}
      <div className="bg-white border-b border-[#001161]/6 px-6 md:px-10 pt-10 pb-10 text-center">
        <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[38px] md:text-[52px] leading-none mb-3">
          {'DVPP Webináře'}
        </h1>
        <p className="text-[#001161]/60 text-[15px] md:text-[16px] max-w-[520px] mx-auto leading-relaxed mb-3" style={{ fontFamily: ff }}>
          {'Připojte se k plánovaným webinářům nebo sledujte záznamy, kdy vám to vyhovuje.'}
        </p>
        <p className="text-[#5B4FD8] font-bold text-[14px]" style={{ fontFamily: ff }}>
          {'Všechny webináře jsou zdarma a lze na ně vystavit certifikát DVPP.'}
        </p>
      </div>

      {/* ══ SEKCE 1: Plánované webináře ══ */}
      <section className="px-6 md:px-10 py-10 bg-white">
        <div className="flex items-center gap-3 mb-7">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E8942A] shrink-0" />
          <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] md:text-[36px] leading-tight">
            {'Plánované webináře'}
          </h2>
        </div>

        {webinarsLoading && (
          <div className="flex items-center gap-3 py-8 text-[#001161]/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[13px]" style={{ fontFamily: ff }}>{'Načítám...'}</span>
          </div>
        )}

        {!webinarsLoading && upcoming.length === 0 && (
          <div className="flex items-center gap-3 py-8 text-[#001161]/35">
            <Radio className="w-5 h-5 opacity-40" />
            <p className="text-[14px]" style={{ fontFamily: ff }}>
              {'Momentálně nejsou naplánované žádné webináře. Sledujte novinky!'}
            </p>
          </div>
        )}

        {!webinarsLoading && upcoming.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {upcoming.map(w => (
              <WebinarCard key={w.id} webinar={w} />
            ))}
          </div>
        )}
      </section>

      {/* Oddělovač */}
      <div className="h-px bg-[#001161]/8 mx-6 md:mx-10" />

      {/* ══ SEKCE 2: Záznamy (DVPP témata) ══ */}
      <section className="bg-[#F5F6FB]">
        {/* Nadpis sekce */}
        <div className="px-6 md:px-10 pt-10 pb-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#001161] shrink-0" />
            <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] md:text-[36px] leading-tight">
              {'Záznamy webinářů'}
            </h2>
          </div>
          <p className="text-[#001161]/50 text-[14px] ml-5 mb-0" style={{ fontFamily: ff }}>
            {'Záznamy seřazené podle témat — sledujte, kdy vám to vyhovuje.'}
          </p>
        </div>

        {/* Témata filter */}
        {!loading && topics.length > 0 && (
          <div className="px-6 md:px-10 py-6">
            <p className="text-[#001161]/40 text-[11px] uppercase tracking-widest font-bold mb-3" style={{ fontFamily: ff }}>
              {'Témata:'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTopic(null)}
                className="px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer"
                style={{
                  fontFamily: ff,
                  background: activeTopic === null ? '#001161' : 'transparent',
                  color: activeTopic === null ? '#fff' : '#001161',
                  border: `2px solid ${activeTopic === null ? '#001161' : 'rgba(0,17,97,0.18)'}`,
                }}
              >
                {'Vše'}
              </button>
              {topics.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => setActiveTopic(activeTopic === topic.id ? null : topic.id)}
                  className="px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer"
                  style={{
                    fontFamily: ff,
                    background: activeTopic === topic.id ? '#001161' : 'transparent',
                    color: activeTopic === topic.id ? '#fff' : '#001161',
                    border: `2px solid ${activeTopic === topic.id ? '#001161' : 'rgba(0,17,97,0.18)'}`,
                  }}
                >
                  {topic.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-20 text-[#001161]/40">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[14px]" style={{ fontFamily: ff }}>{'Načítám videa...'}</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-4 py-16 px-6 text-center">
            <p className="text-red-500 text-[14px]" style={{ fontFamily: ff }}>{error}</p>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#001161] text-white text-[14px] font-bold cursor-pointer hover:opacity-90 disabled:opacity-50"
              style={{ fontFamily: ff }}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {'Načíst z Webflow'}
            </button>
            {syncMsg && <p className="text-[13px] text-[#001161]/60" style={{ fontFamily: ff }}>{syncMsg}</p>}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && videos.length === 0 && (
          <div className="flex flex-col items-center gap-5 py-20 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-white border border-[#001161]/10 flex items-center justify-center">
              <Play className="w-6 h-6 text-[#001161]/30" />
            </div>
            <p className="text-[#001161]/50 text-[14px]" style={{ fontFamily: ff }}>
              {'Videa se načítají z Webflow...'}
            </p>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#001161] text-white text-[14px] font-bold cursor-pointer hover:opacity-90 disabled:opacity-50"
              style={{ fontFamily: ff }}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronizuji...' : 'Synchronizovat z Webflow'}
            </button>
            {syncMsg && <p className="text-[13px] text-[#001161]/60" style={{ fontFamily: ff }}>{syncMsg}</p>}
          </div>
        )}

        {/* Topic groups */}
        {!loading && !error && grouped.map(({ topic, videos: topicVideos }, groupIdx) => (
          <div key={topic.id} className="px-6 md:px-10 py-8">
            <div className="flex items-center gap-3 mb-6">
              <h3 className="font-['Cooper_Light',serif] text-[#001161] text-[22px] md:text-[28px] leading-tight">
                {topic.name}
              </h3>
              <div className="flex-1 h-px bg-[#001161]/8 hidden md:block" />
              <span className="text-[#001161]/35 text-[12px] shrink-0" style={{ fontFamily: ff }}>
                {topicVideos.length}
                {' '}
                {topicVideos.length === 1 ? 'video' : topicVideos.length < 5 ? 'videa' : 'videí'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 md:gap-6">
              {topicVideos.map(video => (
                <DvppVideoCard key={video.id} video={video} onClick={() => navigate(`/webinare/zaznam/${video.id}`)} />
              ))}
            </div>
          </div>
        ))}

        <div className="h-12" />
      </section>
    </motion.div>
  );
}