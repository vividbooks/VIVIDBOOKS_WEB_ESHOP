import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner@2.0.3';
import { Plus, Trash2, Save, Upload, Loader2, ArrowLeft, ImageIcon, X } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import type { ReferenceImageStyle, ReferenceStyleAiTemplate } from '../../utils/referenceStylesApi';
import { fetchReferenceStyles, saveReferenceStyles } from '../../utils/referenceStylesApi';
import { STUDIO_KIDS_REFERENCE_STYLE_PROMPT } from '../../utils/studioKidsPrompt';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H_NO_CT = { Authorization: `Bearer ${publicAnonKey}` };
const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const MAX_IMAGES = 3;

function newStyleId(): string {
  return `rs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ReferenceStylesSettingsPage() {
  const navigate = useNavigate();
  const [styles, setStyles] = useState<ReferenceImageStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await fetchReferenceStyles();
        setStyles(list);
      } catch {
        toast.error('Nepodařilo se načíst referenční styly');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveReferenceStyles(styles);
      toast.success('Uloženo');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Chyba ukládání');
    } finally {
      setSaving(false);
    }
  };

  const addStyle = () => {
    setStyles((prev) => [
      ...prev,
      {
        id: newStyleId(),
        name: 'Nový styl',
        prompt: '',
        defaultSceneColor: '',
        imageUrls: [],
        updatedAt: new Date().toISOString(),
      },
    ]);
  };

  const addStudioKidsStyle = () => {
    setStyles((prev) => [
      ...prev,
      {
        id: newStyleId(),
        name: 'Děti ve studiu',
        prompt: STUDIO_KIDS_REFERENCE_STYLE_PROMPT,
        defaultSceneColor: '#A8D4E8',
        aiTemplate: 'studio_kids',
        imageUrls: [],
        updatedAt: new Date().toISOString(),
      },
    ]);
  };

  const patchStyle = (id: string, patch: Partial<ReferenceImageStyle>) => {
    setStyles((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
      ),
    );
  };

  const removeStyle = (id: string) => {
    if (!confirm('Smazat tento referenční styl?')) return;
    setStyles((prev) => prev.filter((s) => s.id !== id));
  };

  const uploadForStyle = async (styleId: string, files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}: pouze obrázky`);
        continue;
      }
      const current = styles.find((s) => s.id === styleId);
      if (current && current.imageUrls.length >= MAX_IMAGES) {
        toast.error(`Max ${MAX_IMAGES} referenční obrázky na styl`);
        break;
      }
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: AUTH_H_NO_CT, body: fd });
        const d = await res.json();
        if (d.url) {
          setStyles((prev) =>
            prev.map((s) => {
              if (s.id !== styleId) return s;
              const next = [...s.imageUrls, d.url].slice(0, MAX_IMAGES);
              return { ...s, imageUrls: next, updatedAt: new Date().toISOString() };
            }),
          );
          toast.success(`Nahráno: ${file.name}`);
        } else {
          toast.error(d.error || 'Upload selhal');
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Chyba uploadu');
      }
    }
  };

  const removeImageFromStyle = (styleId: string, url: string) => {
    setStyles((prev) =>
      prev.map((s) =>
        s.id === styleId
          ? {
              ...s,
              imageUrls: s.imageUrls.filter((u) => u !== url),
              updatedAt: new Date().toISOString(),
            }
          : s,
      ),
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f7f8fc] overflow-hidden" style={F}>
      <header className="shrink-0 px-4 md:px-6 py-3 md:py-4 bg-white border-b border-gray-200 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/marketing/image-agent')}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-[#001161] hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Image Agent
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center shrink-0">
            <ImageIcon className="w-5 h-5 text-[#7C3AED]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[16px] md:text-[18px] font-extrabold text-[#001161] leading-tight truncate">
              Referenční styly
            </h1>
            <p className="text-[11px] text-[#001161]/45 hidden sm:block">
              Moodboardy + textový prompt pro AI Image (Gemini)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#9F67F5] text-white text-[13px] font-bold hover:opacity-90 disabled:opacity-40 transition-all shadow-md"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Uložit
        </button>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-[13px] text-[#001161]/55 leading-relaxed">
            Nahrajte 1–3 obrázky, které mají AI napodobit (komposice, světlo, jednobarevnost…), a doplňte instrukce v angličtině nebo češtině.
            V <strong className="text-[#7C3AED]">Image Agent → AI Image</strong> pak styl vyberete v rozbalovací nabídce.
          </p>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin" />
            </div>
          ) : (
            <>
              {styles.map((st) => (
                <article
                  key={st.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="text"
                      value={st.name}
                      onChange={(e) => patchStyle(st.id, { name: e.target.value })}
                      className="flex-1 min-w-0 text-[15px] font-bold text-[#001161] border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                      placeholder="Název stylu"
                    />
                    <button
                      type="button"
                      onClick={() => removeStyle(st.id)}
                      className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition-colors shrink-0"
                      title="Smazat styl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#001161]/35 uppercase tracking-wider block mb-1.5">
                      Šablona v Image Agent
                    </label>
                    <p className="text-[11px] text-[#001161]/45 mb-2 leading-snug">
                      <strong className="text-[#7C3AED]">Děti ve studiu</strong> zobrazí v rozbalovací nabídce agenta panel s volbami (póza, věk, tiskoviny…) a doplní strukturovaný text do promptu.
                    </p>
                    <select
                      value={st.aiTemplate === 'studio_kids' ? 'studio_kids' : 'default'}
                      onChange={(e) => {
                        const v = e.target.value as ReferenceStyleAiTemplate | 'default';
                        patchStyle(st.id, { aiTemplate: v === 'studio_kids' ? 'studio_kids' : undefined });
                      }}
                      className="w-full text-[13px] text-[#001161] border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 bg-white cursor-pointer"
                    >
                      <option value="default">Obecný styl</option>
                      <option value="studio_kids">Děti ve studiu</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#001161]/35 uppercase tracking-wider block mb-1.5">
                      Prompt / instrukce pro AI
                    </label>
                    <textarea
                      value={st.prompt}
                      onChange={(e) => patchStyle(st.id, { prompt: e.target.value })}
                      rows={5}
                      className="w-full text-[13px] text-[#001161] border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 resize-y"
                      placeholder="Např. Monochromatická třída v jedné barvě, interaktivní tabule vlevo, sešity V1 (sešívkou) na lavici…"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#001161]/35 uppercase tracking-wider block mb-1.5">
                      Výchozí barva scény
                    </label>
                    <p className="text-[11px] text-[#001161]/45 mb-2 leading-snug">
                      Předvyplní se v <strong className="text-[#7C3AED]">AI Image</strong> při výběru tohoto stylu. Popis (např. matná mint) nebo hex.
                    </p>
                    <div className="flex gap-2 items-stretch">
                      <input
                        type="text"
                        value={st.defaultSceneColor ?? ''}
                        onChange={(e) => patchStyle(st.id, { defaultSceneColor: e.target.value })}
                        className="flex-1 min-w-0 text-[13px] text-[#001161] border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                        placeholder="např. pastelová mint zelená nebo #3DCEA6"
                      />
                      <input
                        type="color"
                        aria-label="Vybrat barvu (hex)"
                        title="Vloží hex do pole"
                        value={
                          /^#[0-9A-Fa-f]{6}$/.test((st.defaultSceneColor || '').trim())
                            ? (st.defaultSceneColor || '').trim()
                            : '#7C3AED'
                        }
                        onChange={(e) => patchStyle(st.id, { defaultSceneColor: e.target.value })}
                        className="w-12 h-11 rounded-xl border border-gray-200 cursor-pointer shrink-0 p-0.5 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[#001161]/35 uppercase tracking-wider">
                        Referenční obrázky ({st.imageUrls.length}/{MAX_IMAGES})
                      </span>
                      <label
                        className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                          st.imageUrls.length >= MAX_IMAGES
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/15'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Nahrát
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={st.imageUrls.length >= MAX_IMAGES}
                          onChange={(e) => {
                            void uploadForStyle(st.id, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {st.imageUrls.map((url) => (
                        <div key={url} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImageFromStyle(st.id, url)}
                            className="absolute top-1 right-1 p-1 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Odebrat"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {st.imageUrls.length === 0 && (
                        <div className="w-full py-8 rounded-xl border-2 border-dashed border-gray-200 text-center text-[12px] text-[#001161]/35">
                          Zatím žádné obrázky — použijte „Nahrát“
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={addStyle}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[#7C3AED]/35 text-[#7C3AED] text-[13px] font-bold hover:bg-[#7C3AED]/5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Přidat styl
                </button>
                <button
                  type="button"
                  onClick={addStudioKidsStyle}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-violet-300 text-violet-800 text-[13px] font-bold hover:bg-violet-50 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Přidat „Děti ve studiu“
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
