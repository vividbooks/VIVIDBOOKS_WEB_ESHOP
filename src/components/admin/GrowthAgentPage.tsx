import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Brain,
  Check,
  Copy,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  MessageSquare,
  PauseCircle,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Trash2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useProducts } from '../../contexts/ProductsContext';
import {
  approveGrowthCreative,
  createGrowthCampaign,
  deleteGrowthChat,
  deleteGrowthCreative,
  fetchGrowthCampaigns,
  fetchGrowthChat,
  fetchGrowthChatIndex,
  fetchGrowthCreatives,
  fetchGrowthInsights,
  generateGrowthCreatives,
  generateGrowthInsights,
  rejectGrowthCreative,
  saveGrowthChat,
  sendGrowthAgentMessage,
  type GrowthAudienceHint,
  type GrowthCampaign,
  type GrowthChatIndexEntry,
  type GrowthChatMessage,
  type GrowthCreative,
  type GrowthCreativeFormat,
  type GrowthInsight,
  type GrowthPlatform,
  updateGrowthCreative,
  uploadGrowthCreatives,
} from '../../utils/growthAgentApi';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const MODEL_OPTIONS = [
  { id: 'gemini-3.1-pro-preview', label: 'Pro', color: '#7C3AED' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Lite', color: '#10b981' },
] as const;
type ModelId = typeof MODEL_OPTIONS[number]['id'];
type WorkspacePanel = 'agent' | 'creatives' | 'campaigns' | 'insights';

const INTRO: GrowthChatMessage = {
  id: 'intro',
  role: 'assistant',
  content:
    'Jsem Growth Agent pro Vividbooks. Pomohu připravit reklamní kreativy pro Meta Ads i Google Ads, navrhnout úhly komunikace, vybrat assety a připravit review frontu pro spuštění.',
  timestamp: new Date(),
};

function generateTitle(text: string) {
  const trimmed = text.trim().slice(0, 60);
  return trimmed.length < text.trim().length ? `${trimmed}…` : trimmed;
}

function formatRelativeDate(iso: string) {
  const date = new Date(iso);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return 'Právě teď';
  if (diffMinutes < 60) return `Před ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Před ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Včera';
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
}

function isAffirmativeReply(text: string) {
  return /^(ano|jo|jasne|jasně|ok|okej|souhlas|souhlasim|souhlasím|beru|jdeme na to)[!. ]*$/i.test(text.trim());
}

function extractCreativeAnglesFromReply(text: string) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const extracted: string[] = [];

  for (const line of lines) {
    const normalized = line
      .replace(/^#+\s*/, '')
      .replace(/^[•*]\s*/, '')
      .replace(/^\d+[\.\)]?\s*/, '')
      .replace(/\*\*/g, '')
      .trim();

    const matches = [
      normalized.match(/^Vizu[aá]l\s*\d+\s*\(([^)]+)\)/i),
      normalized.match(/^Creative\s*\d+\s*\(([^)]+)\)\s*:/i),
      normalized.match(/^Kreativa\s*\d+\s*\(([^)]+)\)\s*:/i),
      normalized.match(/^Creative\s*(?:č\.\s*)?\d*\s*:\s*[„"]?(.+?)[”"]?(?:\s*\(|$)/i),
      normalized.match(/^Kreativa\s*(?:č\.\s*)?\d*\s*:\s*[„"]?(.+?)[”"]?(?:\s*\(|$)/i),
      normalized.match(/^Creative\s*\d*\s*:\s*[„"]?(.+?)[”"]?(?:\s*\(|$)/i),
      normalized.match(/^Kreativa\s*\d*\s*:\s*[„"]?(.+?)[”"]?(?:\s*\(|$)/i),
      normalized.match(/^Angle\s+[A-Z]\s*\(([^)]+)\)\s*:/i),
      normalized.match(/^Angle\s+[A-Z]\s*:\s*[„"]?([^"”]+?)[”"]?$/i),
      normalized.match(/^Kreativa\s*:\s*[„"]?(.+?)[”"]?(?:\s*\(|$)/i),
    ].filter(Boolean) as RegExpMatchArray[];

    for (const match of matches) {
      const label = String(match[1] || '')
        .replace(/[“”"]/g, '')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (label) extracted.push(label);
    }
  }

  return [...new Set(extracted)].slice(0, 4);
}

function hasDraftableCreativeSignals(text: string) {
  if (extractCreativeAnglesFromReply(text).length > 0) return true;
  return /(kreativ|creative|vizu[aá]l|angle\s+[a-z]|\bdraft\b)/i.test(text);
}

function renderMessage(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
    .replace(/^[-*] (.+)$/gm, '• $1')
    .replace(/\n/g, '<br/>');
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-[#001161]/40 hover:text-[#001161] hover:bg-[#001161]/5"
      style={FF}
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Zkopírováno' : 'Kopírovat'}
    </button>
  );
}

function Chip({
  children,
  color = 'slate',
}: {
  children: React.ReactNode;
  color?: 'slate' | 'purple' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const styles = {
    slate: 'bg-slate-100 text-slate-600',
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
  }[color];
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${styles}`}>{children}</span>;
}

export default function GrowthAgentPage() {
  const { products, isLoading: productsLoading } = useProducts();
  const [model, setModel] = useState<ModelId>('gemini-3.1-flash-lite-preview');
  const [messages, setMessages] = useState<GrowthChatMessage[]>([INTRO]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string>(() => crypto.randomUUID());
  const [chatTitle, setChatTitle] = useState('');
  const [chatIndex, setChatIndex] = useState<GrowthChatIndexEntry[]>([]);
  const [indexLoading, setIndexLoading] = useState(true);

  const [creatives, setCreatives] = useState<GrowthCreative[]>([]);
  const [campaigns, setCampaigns] = useState<GrowthCampaign[]>([]);
  const [insights, setInsights] = useState<GrowthInsight[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<WorkspacePanel>('agent');
  const [selectedCreativeId, setSelectedCreativeId] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [anglesInput, setAnglesInput] = useState('Konkrétní situace z hodiny\nÚspora času pro učitele\nVizualita a zapojení žáků');
  const [countPerAngle, setCountPerAngle] = useState(2);
  const [audienceHint, setAudienceHint] = useState<GrowthAudienceHint>('teacher');
  const [format, setFormat] = useState<GrowthCreativeFormat>('image_single');
  const [platformTargets, setPlatformTargets] = useState<GrowthPlatform[]>(['meta', 'google']);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: '', platform: 'meta' as GrowthPlatform, budget: '1500' });
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [publishing, setPublishing] = useState<null | { id: string; platform: GrowthPlatform }>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedCreative = useMemo(
    () => creatives.find((item) => item.id === selectedCreativeId) || creatives[0] || null,
    [creatives, selectedCreativeId],
  );
  const selectedProduct = useMemo(
    () => products.find((item: any) => String(item.id) === String(selectedCreative?.productId || selectedProductId)) || null,
    [products, selectedCreative?.productId, selectedProductId],
  );
  const assetCandidates = useMemo(() => {
    const withImages = (products || []).filter((item: any) => item?.image);
    if (!selectedProduct) return withImages.slice(0, 24);
    const preferred = withImages.filter((item: any) => item.id === selectedProduct.id || item.category === selectedProduct.category);
    const rest = withImages.filter((item: any) => !preferred.includes(item));
    return [...preferred, ...rest].slice(0, 24);
  }, [products, selectedProduct]);

  function normalizeSearchText(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function inferProductIdFromText(text: string) {
    const normalizedText = normalizeSearchText(text);
    if (!normalizedText) return null;

    let bestMatch: { id: string; score: number } | null = null;
    for (const product of Array.isArray(products) ? products : []) {
      const fields = [product?.name, product?.category, product?.predmet, product?.description]
        .filter(Boolean)
        .map((value: string) => normalizeSearchText(value));
      if (fields.length === 0) continue;

      let score = 0;
      if (fields.some((field) => field && normalizedText.includes(field))) score += 10;
      const tokenMatches = fields
        .flatMap((field) => field.split(' '))
        .filter((token) => token.length >= 4)
        .reduce((sum, token) => sum + (normalizedText.includes(token) ? 1 : 0), 0);
      score += tokenMatches;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { id: String(product.id), score };
      }
    }

    return bestMatch && bestMatch.score >= 3 ? bestMatch.id : null;
  }

  function resolveProductIdFromContext(extraText = '') {
    const transcript = [
      chatTitle,
      ...messages.filter((msg) => msg.id !== 'intro').map((msg) => msg.content),
      extraText,
    ]
      .filter(Boolean)
      .join('\n');
    return (
      inferProductIdFromText(transcript) ||
      (selectedCreative?.productId ? String(selectedCreative.productId) : null) ||
      selectedProductId ||
      null
    );
  }

  function buildRelevantProductContext(query: string, preferredProductId?: string | null) {
    const allProducts = Array.isArray(products) ? products : [];
    const preferredProduct =
      allProducts.find((item: any) => String(item.id) === String(preferredProductId || '')) || selectedProduct;
    const selected = preferredProduct ? [preferredProduct] : [];
    const tokens = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3);

    const scored = allProducts
      .map((product: any) => {
        const haystack = [
          product?.name || '',
          product?.category || '',
          product?.predmet || '',
          product?.description || '',
        ]
          .join(' ')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
        return { product, score };
      })
      .filter(({ score, product }: any) => score > 0 && !selected.some((picked: any) => picked?.id === product?.id))
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 7)
      .map(({ product }: any) => product);

    const fallback = allProducts
      .filter((product: any) => !selected.some((picked: any) => picked?.id === product?.id))
      .slice(0, 5);

    const combined = [...selected, ...(scored.length > 0 ? scored : fallback)];
    return combined.slice(0, 8).map((product: any) => ({
      id: product?.id,
      name: product?.name,
      category: product?.category,
      predmet: product?.predmet,
      price: product?.price,
      note: product?.note,
    }));
  }

  useEffect(() => {
    void loadChatIndex();
    void loadWorkspaceData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!selectedCreativeId && creatives.length > 0) setSelectedCreativeId(creatives[0].id);
  }, [creatives, selectedCreativeId]);

  useEffect(() => {
    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(String(products[0].id));
    }
  }, [products, selectedProductId]);

  async function loadChatIndex() {
    setIndexLoading(true);
    try {
      setChatIndex(await fetchGrowthChatIndex());
    } catch (error) {
      console.error('[GrowthAgent] chat index error', error);
      toast.error('Nepodařilo se načíst historii chatů.');
    } finally {
      setIndexLoading(false);
    }
  }

  async function loadWorkspaceData() {
    setDataLoading(true);
    try {
      const [nextCreatives, nextCampaigns, nextInsights] = await Promise.all([
        fetchGrowthCreatives(),
        fetchGrowthCampaigns(),
        fetchGrowthInsights(),
      ]);
      setCreatives(nextCreatives);
      setCampaigns(nextCampaigns);
      setInsights(nextInsights);
      if (nextCreatives[0]) setSelectedCreativeId(nextCreatives[0].id);
    } catch (error) {
      console.error('[GrowthAgent] workspace load error', error);
      toast.error('Nepodařilo se načíst Growth Agent data.');
    } finally {
      setDataLoading(false);
    }
  }

  async function persistChat(nextMessages: GrowthChatMessage[], nextTitle: string) {
    const realMessages = nextMessages.filter((msg) => msg.id !== 'intro');
    if (realMessages.length === 0) return;
    await saveGrowthChat({ id: chatId, title: nextTitle, messages: nextMessages });
    await loadChatIndex();
  }

  function newChat() {
    setChatId(crypto.randomUUID());
    setChatTitle('');
    setMessages([{ ...INTRO, timestamp: new Date() }]);
    setInput('');
  }

  async function openChat(entry: GrowthChatIndexEntry) {
    try {
      const loaded = await fetchGrowthChat(entry.id);
      const hydratedMessages = loaded.messages.map((msg) => ({ ...msg, timestamp: new Date(msg.timestamp) }));
      setMessages(hydratedMessages);
      setChatId(loaded.id);
      setChatTitle(loaded.title);
      const inferredProductId = inferProductIdFromText(
        [loaded.title, ...hydratedMessages.filter((msg) => msg.id !== 'intro').map((msg) => msg.content)].join('\n'),
      );
      if (inferredProductId) setSelectedProductId(inferredProductId);
    } catch (error) {
      console.error('[GrowthAgent] open chat error', error);
      toast.error('Chat se nepodařilo otevřít.');
    }
  }

  async function removeChat(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    try {
      await deleteGrowthChat(id);
      if (chatId === id) newChat();
      await loadChatIndex();
    } catch (error) {
      console.error('[GrowthAgent] delete chat error', error);
      toast.error('Chat se nepodařilo smazat.');
    }
  }

  async function sendMessage(text?: string) {
    const content = (text || input).trim();
    if (!content || loading) return;
    const resolvedProductId = resolveProductIdFromContext(content);
    if (resolvedProductId && resolvedProductId !== selectedProductId) {
      setSelectedProductId(resolvedProductId);
    }

    const userMessage: GrowthChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    const nextMessages = [...messages, userMessage];
    const nextTitle = chatTitle || generateTitle(content);
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    if (!chatTitle) setChatTitle(nextTitle);

    try {
      const response = await sendGrowthAgentMessage({
        messages: nextMessages
          .filter((msg) => msg.id !== 'intro')
          .map((msg) => ({ role: msg.role, content: msg.content })),
        productContext: buildRelevantProductContext(content, resolvedProductId),
        model,
      });

      const assistantMessage: GrowthChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.reply,
        timestamp: new Date(),
        ragChunks: response.ragChunks,
        ragDebug: response.ragDebug,
        tokens: { in: response.tokensIn, out: response.tokensOut },
      };

      const savedMessages = [...nextMessages, assistantMessage];
      setMessages(savedMessages);
      await persistChat(savedMessages, nextTitle);

      const autoAngles = extractCreativeAnglesFromReply(assistantMessage.content);
      const draftProductId = inferProductIdFromText(
        [nextTitle, ...savedMessages.filter((msg) => msg.id !== 'intro').map((msg) => msg.content)].join('\n'),
      ) || resolvedProductId;
      if (draftProductId && draftProductId !== selectedProductId) {
        setSelectedProductId(draftProductId);
      }
      if (draftProductId && autoAngles.length > 0) {
        const created = await generateGrowthCreatives({
          productId: draftProductId,
          angles: autoAngles,
          countPerAngle: 1,
          audienceHint,
          platformTargets,
          format,
          sourceChatId: chatId,
        });
        if (created.length > 0) {
          setAnglesInput(autoAngles.join('\n'));
          setCreatives((prev) => [...created, ...prev]);
          setSelectedCreativeId(created[0].id);
          setActivePanel('creatives');
          if (isAffirmativeReply(content)) {
            toast.success('Z potvrzeného briefu jsem rovnou připravil drafty v panelu Creatives.');
          } else {
            toast.success('Z odpovědi agenta jsem připravil drafty v panelu Creatives.');
          }
        }
      }
    } catch (error: any) {
      console.error('[GrowthAgent] send error', error);
      toast.error(error?.message || 'Growth Agent neodpověděl.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateCreatives() {
    const angles = anglesInput
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!selectedProductId) {
      toast.error('Vyber produkt.');
      return;
    }
    if (angles.length === 0) {
      toast.error('Přidej alespoň jeden komunikační úhel.');
      return;
    }

    setGenerateLoading(true);
    try {
      const created = await generateGrowthCreatives({
        productId: selectedProductId,
        angles,
        countPerAngle,
        audienceHint,
        platformTargets,
        format,
        sourceChatId: chatId,
      });
      if (created.length === 0) {
        toast.error('Agent nevygeneroval žádné kreativy.');
        return;
      }
      setCreatives((prev) => [...created, ...prev]);
      setSelectedCreativeId(created[0].id);
      setActivePanel('creatives');
      toast.success(`Vygenerováno ${created.length} kreativ.`);
    } catch (error: any) {
      console.error('[GrowthAgent] generate creatives error', error);
      toast.error(error?.message || 'Generování kreativ selhalo.');
    } finally {
      setGenerateLoading(false);
    }
  }

  async function handleCreativeUpdate(id: string, updates: Partial<GrowthCreative>, okMessage = 'Kreativa upravena.') {
    try {
      const updated = await updateGrowthCreative(id, updates);
      setCreatives((prev) => prev.map((item) => (item.id === id ? updated : item)));
      toast.success(okMessage);
    } catch (error: any) {
      console.error('[GrowthAgent] creative update error', error);
      toast.error(error?.message || 'Úprava kreativy selhala.');
    }
  }

  async function handleCreativeApprove(id: string) {
    try {
      const updated = await approveGrowthCreative(id);
      setCreatives((prev) => prev.map((item) => (item.id === id ? updated : item)));
      toast.success('Kreativa schválena.');
    } catch (error: any) {
      toast.error(error?.message || 'Schválení selhalo.');
    }
  }

  async function handleCreativeReject(id: string) {
    try {
      const updated = await rejectGrowthCreative(id);
      setCreatives((prev) => prev.map((item) => (item.id === id ? updated : item)));
      toast.success('Kreativa zamítnuta.');
    } catch (error: any) {
      toast.error(error?.message || 'Zamítnutí selhalo.');
    }
  }

  async function handleCreativeDelete(id: string) {
    try {
      await deleteGrowthCreative(id);
      setCreatives((prev) => prev.filter((item) => item.id !== id));
      if (selectedCreativeId === id) setSelectedCreativeId(null);
      toast.success('Kreativa smazána.');
    } catch (error: any) {
      toast.error(error?.message || 'Mazání kreativy selhalo.');
    }
  }

  async function handleGenerateInsights() {
    setInsightsLoading(true);
    try {
      const next = await generateGrowthInsights();
      setInsights(next);
      setActivePanel('insights');
      toast.success('Insights byly přepočítány.');
    } catch (error: any) {
      toast.error(error?.message || 'Generování insights selhalo.');
    } finally {
      setInsightsLoading(false);
    }
  }

  async function handleCreateCampaign() {
    if (!campaignForm.name.trim()) {
      toast.error('Doplň název kampaně.');
      return;
    }
    setCampaignSaving(true);
    try {
      const created = await createGrowthCampaign({
        name: campaignForm.name.trim(),
        platform: campaignForm.platform,
        budget: Number(campaignForm.budget) || 0,
        status: 'draft',
      });
      setCampaigns((prev) => [created, ...prev]);
      setCampaignForm({ name: '', platform: campaignForm.platform, budget: campaignForm.budget });
      toast.success('Kampaň založena.');
    } catch (error: any) {
      toast.error(error?.message || 'Vytvoření kampaně selhalo.');
    } finally {
      setCampaignSaving(false);
    }
  }

  async function handleUpload(platform: GrowthPlatform) {
    if (!selectedCreative) return;
    setPublishing({ id: selectedCreative.id, platform });
    try {
      const result = await uploadGrowthCreatives(platform, [selectedCreative.id]);
      toast.success(result.message || `Pokus o upload na ${platform} byl odeslán.`);
      const nextCreatives = await fetchGrowthCreatives();
      setCreatives(nextCreatives);
    } catch (error: any) {
      toast.error(error?.message || `Upload na ${platform} selhal.`);
    } finally {
      setPublishing(null);
    }
  }

  function togglePlatform(platform: GrowthPlatform) {
    setPlatformTargets((prev) =>
      prev.includes(platform) ? prev.filter((item) => item !== platform) : [...prev, platform],
    );
  }

  function renderAgentWorkspace(linkedPreview = false) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <div className={`mb-4 rounded-[20px] border border-[#7C3AED]/15 bg-gradient-to-r from-[#7C3AED]/6 to-[#FF6B1A]/6 p-4 ${linkedPreview ? 'shrink-0' : ''}`}>
          <p className="text-[13px] font-bold text-[#001161]" style={FF}>
            {linkedPreview ? 'Brief a drafty jsou propojené' : 'Jak tenhle režim funguje'}
          </p>
          <p className="text-[12px] text-[#001161]/55 mt-1" style={FF}>
            {linkedPreview
              ? 'Vlevo zůstává chat k aktuálnímu briefu a vpravo vidíš drafty odvozené ze stejného kontextu.'
              : 'V chatu si nejdřív ujasni směr kampaně. Jakmile agent navrhne konkrétní vizuály nebo angly, klikni na `Vytvořit drafty` nebo počkej na automatické vytvoření a pak pokračuj v záložce `Creatives`.'}
          </p>
          {linkedPreview && selectedProduct && (
            <p className="text-[11px] text-[#7C3AED] font-bold mt-2" style={FF}>
              Aktivní produkt pro drafty: {selectedProduct.name}
            </p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[82%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div
                  className={`rounded-[18px] px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-[#001161] text-white rounded-tr-[6px] ml-auto'
                      : 'bg-white border border-gray-100 shadow-sm rounded-tl-[6px]'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap" style={FF}>
                      {msg.content}
                    </p>
                  ) : (
                    <div
                      style={FF}
                      className="text-[14px] text-[#001161]/85 leading-relaxed [&_strong]:font-bold [&_code]:font-mono"
                      dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }}
                    />
                  )}
                </div>
                <div className={`flex items-center gap-2 mt-1 px-1 flex-wrap ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] text-[#001161]/25" style={FF}>
                    {msg.timestamp.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.role === 'assistant' && msg.id !== 'intro' && <CopyButton text={msg.content} />}
                  {msg.role === 'assistant' && msg.id !== 'intro' && hasDraftableCreativeSignals(msg.content) && (
                    <button
                      onClick={async () => {
                        try {
                          const angles = extractCreativeAnglesFromReply(msg.content);
                          if (angles.length === 0) {
                            toast.error('V odpovědi jsem nenašel čitelné názvy draftů. Zkusím to po další úpravě chatu převést spolehlivěji.');
                            return;
                          }
                          const draftProductId = resolveProductIdFromContext(msg.content);
                          if (!draftProductId) {
                            toast.error('Z briefu se mi nepodařilo poznat produkt. Vyber ho prosím ručně.');
                            return;
                          }
                          if (draftProductId !== selectedProductId) {
                            setSelectedProductId(draftProductId);
                          }
                          const created = await generateGrowthCreatives({
                            productId: draftProductId,
                            angles,
                            countPerAngle: 1,
                            audienceHint,
                            platformTargets,
                            format,
                            sourceChatId: chatId,
                          });
                          if (created.length > 0) {
                            setAnglesInput(angles.join('\n'));
                            setCreatives((prev) => [...created, ...prev]);
                            setSelectedCreativeId(created[0].id);
                            setActivePanel('creatives');
                            toast.success('Drafty byly vytvořeny ve workspace vedle briefu.');
                          }
                        } catch (error: any) {
                          toast.error(error?.message || 'Vytvoření draftů z odpovědi selhalo.');
                        }
                      }}
                      style={FF}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-[#7C3AED] bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20"
                    >
                      <LayoutTemplate className="w-3 h-3" />
                      Vytvořit drafty z odpovědi
                    </button>
                  )}
                  {msg.tokens && (
                    <span className="text-[10px] text-[#001161]/25" style={FF}>
                      {msg.tokens.out} tokenů
                    </span>
                  )}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-[#001161] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white text-[10px] font-bold" style={FF}>VY</span>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center shrink-0 mt-0.5">
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-[18px] rounded-tl-[6px] px-4 py-3">
                <div className="space-y-1">
                  <span className="block text-[13px] text-[#001161]/55" style={FF}>Připravuji další směr kampaně…</span>
                  <span className="block text-[11px] text-[#001161]/30" style={FF}>Jakmile bude odpověď obsahovat konkrétní vizuály nebo angly, můžeš ji jedním klikem převést do draftů.</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={`border-t border-gray-200 bg-white px-5 py-4 mt-4 ${linkedPreview ? '' : '-mx-5 -mb-5'}`}>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Popiš brief, cíl kampaně nebo požadovaný angle..."
                rows={1}
                disabled={loading}
                className="w-full resize-none rounded-[14px] border border-gray-200 bg-[#f7f8fc] px-4 py-3 text-[14px] text-[#001161] placeholder-[#001161]/30 focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/10 transition-all disabled:opacity-60"
                style={{ ...FF, minHeight: '52px', maxHeight: '160px' }}
              />
            </div>
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || loading}
              className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-[#7C3AED] to-[#9F67F5] flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 shadow-[0_4px_12px_rgba(124,58,237,0.35)]"
            >
              {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
            </button>
          </div>
          <p className="text-[10px] text-[#001161]/25 mt-2 text-center" style={FF}>
            {linkedPreview
              ? 'Brief zůstává otevřený vedle draftů, takže je hned vidět, z jakého zadání vznikly.'
              : 'Briefy se ukládají automaticky. Chat slouží jen pro domluvu směru; vizuální drafty najdeš v záložce `Creatives`.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-x-auto overflow-y-hidden bg-[#f7f8fc]">
      <aside className="w-[280px] shrink-0 h-full border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center shadow-[0_10px_24px_rgba(124,58,237,0.25)]">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-[#001161]" style={FF}>Growth Agent</h1>
              <p className="text-[11px] text-[#001161]/45" style={FF}>Meta Ads + Google Ads creative loop</p>
            </div>
          </div>
          <button
            onClick={newChat}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-[14px] bg-[#001161] text-white py-2.5 text-[13px] font-bold hover:bg-[#0b1f84] transition-colors"
            style={FF}
          >
            <Plus className="w-3.5 h-3.5" />
            Nový brief
          </button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#f7f8fc] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[#001161]/35 font-bold" style={FF}>Drafty</p>
              <p className="text-[18px] text-[#001161] font-bold mt-1" style={FF}>{creatives.length}</p>
            </div>
            <div className="rounded-2xl bg-[#f7f8fc] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[#001161]/35 font-bold" style={FF}>Insights</p>
              <p className="text-[18px] text-[#001161] font-bold mt-1" style={FF}>{insights.length}</p>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4">
          <p className="text-[10px] uppercase tracking-wide text-[#001161]/35 font-bold mb-2" style={FF}>Model</p>
          <div className="grid grid-cols-2 gap-2">
            {MODEL_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setModel(option.id)}
                className={`rounded-[12px] border px-3 py-2 text-[12px] font-bold transition-all ${
                  model === option.id
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-gray-200 text-[#001161]/65 hover:border-[#7C3AED]/25'
                }`}
                style={{ ...FF, background: model === option.id ? option.color : '#fff' }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wide text-[#001161]/35 font-bold" style={FF}>Historie chatů</p>
            {indexLoading && <Loader2 className="w-3.5 h-3.5 text-[#7C3AED] animate-spin" />}
          </div>
          <div className="space-y-2">
            {chatIndex.map((entry) => (
              <div
                key={entry.id}
                className={`w-full rounded-[16px] border p-3 transition-all ${
                  chatId === entry.id ? 'border-[#7C3AED]/35 bg-[#7C3AED]/5' : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button onClick={() => openChat(entry)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-[#7C3AED] mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-[#001161] truncate" style={FF}>{entry.title || 'Nový brief'}</p>
                        <p className="text-[10px] text-[#001161]/35 mt-1" style={FF}>
                          {entry.messageCount} zpráv · {formatRelativeDate(entry.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(event) => void removeChat(entry.id, event)}
                    className="text-[#001161]/20 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {!indexLoading && chatIndex.length === 0 && (
              <div className="rounded-[16px] border border-dashed border-gray-200 bg-white p-4 text-center">
                <p className="text-[12px] text-[#001161]/45" style={FF}>Zatím není uložený žádný brief.</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className="min-w-0 flex-1 h-full bg-[#f9fafe] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#7C3AED] font-bold" style={FF}>Agent workspace</p>
              <h2 className="text-[18px] font-bold text-[#001161]" style={FF}>{chatTitle || 'Nový growth brief'}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActivePanel('agent')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${activePanel === 'agent' ? 'bg-[#001161] text-white' : 'bg-[#001161]/5 text-[#001161]/65'}`}
                style={FF}
              >
                Agent
              </button>
              <button
                onClick={() => setActivePanel('creatives')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${activePanel === 'creatives' ? 'bg-[#7C3AED] text-white' : 'bg-[#7C3AED]/10 text-[#7C3AED]'}`}
                style={FF}
              >
                Creatives
              </button>
              <button
                onClick={() => setActivePanel('campaigns')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${activePanel === 'campaigns' ? 'bg-[#001161] text-white' : 'bg-[#001161]/5 text-[#001161]/65'}`}
                style={FF}
              >
                Campaigns
              </button>
              <button
                onClick={() => setActivePanel('insights')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${activePanel === 'insights' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}
                style={FF}
              >
                Insights
              </button>
            </div>
          </div>
          <p className="text-[12px] text-[#001161]/45 mt-2" style={FF}>
            {activePanel === 'agent' && 'Nejdřív si ujasni brief v chatu. Jakmile z odpovědi vzniknou drafty, otevřou se v propojeném workspace.'}
            {activePanel === 'creatives' && 'Drafty jsou odvozené z aktuálního briefu a chat zůstává vedle nich pro rychlou kontrolu kontextu.'}
            {activePanel === 'campaigns' && 'Placeholder přehled pro Meta a Google kampaně, navázaný na budoucí publish flow.'}
            {activePanel === 'insights' && 'Shrnutí toho, co funguje, co stagnuje a co má smysl iterovat dál.'}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {activePanel === 'agent' ? (
            renderAgentWorkspace()
          ) : false ? (
            <div className="h-full flex flex-col">
              <div className="mb-4 rounded-[20px] border border-[#7C3AED]/15 bg-gradient-to-r from-[#7C3AED]/6 to-[#FF6B1A]/6 p-4">
                <p className="text-[13px] font-bold text-[#001161]" style={FF}>Jak tenhle režim funguje</p>
                <p className="text-[12px] text-[#001161]/55 mt-1" style={FF}>
                  V chatu si nejdřív ujasni směr kampaně. Jakmile agent navrhne konkrétní vizuály nebo angly, klikni na `Vytvořit drafty` nebo počkej na automatické vytvoření a pak pokračuj v záložce `Creatives`.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[82%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                      <div
                        className={`rounded-[18px] px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-[#001161] text-white rounded-tr-[6px] ml-auto'
                            : 'bg-white border border-gray-100 shadow-sm rounded-tl-[6px]'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap" style={FF}>
                            {msg.content}
                          </p>
                        ) : (
                          <div
                            style={FF}
                            className="text-[14px] text-[#001161]/85 leading-relaxed [&_strong]:font-bold [&_code]:font-mono"
                            dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }}
                          />
                        )}
                      </div>
                      <div className={`flex items-center gap-2 mt-1 px-1 flex-wrap ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[10px] text-[#001161]/25" style={FF}>
                          {msg.timestamp.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.role === 'assistant' && msg.id !== 'intro' && <CopyButton text={msg.content} />}
                        {msg.role === 'assistant' && msg.id !== 'intro' && hasDraftableCreativeSignals(msg.content) && (
                          <button
                            onClick={async () => {
                              try {
                                const angles = extractCreativeAnglesFromReply(msg.content);
                                if (angles.length === 0) {
                                  toast.error('V odpovědi jsem nenašel čitelné názvy draftů. Zkusím to po další úpravě chatu převést spolehlivěji.');
                                  return;
                                }
                                const draftProductId = resolveProductIdFromContext(msg.content);
                                if (!draftProductId) {
                                  toast.error('Z briefu se mi nepodařilo poznat produkt. Vyber ho prosím ručně.');
                                  return;
                                }
                                if (draftProductId !== selectedProductId) {
                                  setSelectedProductId(draftProductId);
                                }
                                const created = await generateGrowthCreatives({
                                  productId: draftProductId,
                                  angles,
                                  countPerAngle: 1,
                                  audienceHint,
                                  platformTargets,
                                  format,
                                  sourceChatId: chatId,
                                });
                                if (created.length > 0) {
                                  setAnglesInput(angles.join('\n'));
                                  setCreatives((prev) => [...created, ...prev]);
                                  setSelectedCreativeId(created[0].id);
                                  setActivePanel('creatives');
                                  toast.success('Drafty byly vytvořeny. Otevírám záložku Creatives.');
                                }
                              } catch (error: any) {
                                toast.error(error?.message || 'Vytvoření draftů z odpovědi selhalo.');
                              }
                            }}
                            style={FF}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-[#7C3AED] bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20"
                          >
                            <LayoutTemplate className="w-3 h-3" />
                            Vytvořit drafty z odpovědi
                          </button>
                        )}
                        {msg.tokens && (
                          <span className="text-[10px] text-[#001161]/25" style={FF}>
                            {msg.tokens.out} tokenů
                          </span>
                        )}
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-[#001161] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-white text-[10px] font-bold" style={FF}>VY</span>
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center shrink-0 mt-0.5">
                      <RefreshCw className="w-4 h-4 text-white animate-spin" />
                    </div>
                    <div className="bg-white border border-gray-100 shadow-sm rounded-[18px] rounded-tl-[6px] px-4 py-3">
                      <div className="space-y-1">
                        <span className="block text-[13px] text-[#001161]/55" style={FF}>Připravuji další směr kampaně…</span>
                        <span className="block text-[11px] text-[#001161]/30" style={FF}>Jakmile bude odpověď obsahovat konkrétní vizuály nebo angly, můžeš ji jedním klikem převést do draftů.</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-200 bg-white px-5 py-4 mt-4 -mx-5 -mb-5">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder="Popiš brief, cíl kampaně nebo požadovaný angle..."
                      rows={1}
                      disabled={loading}
                      className="w-full resize-none rounded-[14px] border border-gray-200 bg-[#f7f8fc] px-4 py-3 text-[14px] text-[#001161] placeholder-[#001161]/30 focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/10 transition-all disabled:opacity-60"
                      style={{ ...FF, minHeight: '52px', maxHeight: '160px' }}
                    />
                  </div>
                  <button
                    onClick={() => void sendMessage()}
                    disabled={!input.trim() || loading}
                    className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-[#7C3AED] to-[#9F67F5] flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 shadow-[0_4px_12px_rgba(124,58,237,0.35)]"
                  >
                    {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                  </button>
                </div>
                <p className="text-[10px] text-[#001161]/25 mt-2 text-center" style={FF}>
                  Briefy se ukládají automaticky. Chat slouží jen pro domluvu směru; vizuální drafty najdeš v záložce `Creatives`.
                </p>
              </div>
            </div>
          ) : dataLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#7C3AED] animate-spin" />
            </div>
          ) : activePanel === 'creatives' ? (
            <div className="grid gap-5 xl:grid-cols-[600px_600px] h-full">
              <div className="min-h-0 rounded-[24px] border border-gray-200 bg-[#f9fafe] p-4 overflow-hidden">
                {renderAgentWorkspace(true)}
              </div>
              <div className="space-y-5 min-h-0 overflow-y-auto pr-1">
              <div className="rounded-[20px] border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wand2 className="w-4 h-4 text-[#7C3AED]" />
                  <p className="text-[13px] font-bold text-[#001161]" style={FF}>Generate drafts</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-[#001161]/45 font-bold uppercase tracking-wide" style={FF}>Produkt</label>
                    <select
                      value={selectedProductId}
                      onChange={(event) => setSelectedProductId(event.target.value)}
                      className="mt-1 w-full rounded-[12px] border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/40"
                      style={FF}
                    >
                      {(products || []).map((product: any) => (
                        <option key={product.id} value={String(product.id)}>{product.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#001161]/45 font-bold uppercase tracking-wide" style={FF}>Audience</label>
                      <select
                        value={audienceHint}
                        onChange={(event) => setAudienceHint(event.target.value as GrowthAudienceHint)}
                        className="mt-1 w-full rounded-[12px] border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/40"
                        style={FF}
                      >
                        <option value="teacher">Teachers</option>
                        <option value="parent">Parents</option>
                        <option value="school">School</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#001161]/45 font-bold uppercase tracking-wide" style={FF}>Format</label>
                      <select
                        value={format}
                        onChange={(event) => setFormat(event.target.value as GrowthCreativeFormat)}
                        className="mt-1 w-full rounded-[12px] border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/40"
                        style={FF}
                      >
                        <option value="image_single">Single image</option>
                        <option value="carousel">Carousel</option>
                        <option value="story">Story</option>
                        <option value="pmax_asset">PMax asset</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#001161]/45 font-bold uppercase tracking-wide" style={FF}>Angles</label>
                    <textarea
                      value={anglesInput}
                      onChange={(event) => setAnglesInput(event.target.value)}
                      rows={4}
                      className="mt-1 w-full rounded-[12px] border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/40"
                      style={FF}
                    />
                    <p className="text-[10px] text-[#001161]/35 mt-1" style={FF}>Jeden angle na řádek.</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => togglePlatform('meta')}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${platformTargets.includes('meta') ? 'bg-[#0A66FF] text-white' : 'bg-[#0A66FF]/10 text-[#0A66FF]'}`}
                      style={FF}
                    >
                      Meta
                    </button>
                    <button
                      onClick={() => togglePlatform('google')}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${platformTargets.includes('google') ? 'bg-[#34A853] text-white' : 'bg-[#34A853]/10 text-[#34A853]'}`}
                      style={FF}
                    >
                      Google
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[11px] text-[#001161]/45 font-bold uppercase tracking-wide" style={FF}>Počet</span>
                      <input
                        type="number"
                        value={countPerAngle}
                        onChange={(event) => setCountPerAngle(Math.max(1, Number(event.target.value) || 1))}
                        className="w-16 rounded-[12px] border border-gray-200 bg-white px-3 py-2 text-[13px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/40"
                        style={FF}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => void handleGenerateCreatives()}
                    disabled={generateLoading || productsLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#7C3AED] to-[#9F67F5] text-white py-3 text-[13px] font-bold hover:opacity-90 transition-all disabled:opacity-45"
                    style={FF}
                  >
                    {generateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generateLoading ? 'Generuji…' : 'Vygenerovat kreativy'}
                  </button>
                </div>
              </div>

              <div className="rounded-[20px] border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-[13px] font-bold text-[#001161]" style={FF}>Review queue</p>
                  <Chip color="purple">{creatives.length} položek</Chip>
                </div>
                <div className="max-h-[240px] overflow-y-auto divide-y divide-gray-100">
                  {creatives.map((creative) => (
                    <button
                      key={creative.id}
                      onClick={() => setSelectedCreativeId(creative.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${selectedCreative?.id === creative.id ? 'bg-[#7C3AED]/6' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-[12px] bg-[#f5f3ff] overflow-hidden shrink-0">
                          {creative.imageUrl ? (
                            <img src={creative.imageUrl} alt={creative.headline} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-[#7C3AED]/35" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[12px] font-bold text-[#001161] truncate" style={FF}>{creative.headline}</p>
                            <Chip color={creative.reviewStatus === 'approved' ? 'green' : creative.reviewStatus === 'rejected' ? 'red' : 'amber'}>
                              {creative.reviewStatus}
                            </Chip>
                          </div>
                          <p className="text-[11px] text-[#001161]/45 mt-1 truncate" style={FF}>{creative.angle}</p>
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {creative.platformTargets.map((platform) => (
                              <Chip key={platform} color={platform === 'meta' ? 'blue' : 'green'}>{platform}</Chip>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  {creatives.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <p className="text-[12px] text-[#001161]/45" style={FF}>Zatím tu nejsou žádné drafty. Začni generováním.</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedCreative && (
                <>
                  <div className="rounded-[24px] border border-gray-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-[#001161]/35 font-bold" style={FF}>Preview</p>
                        <p className="text-[15px] font-bold text-[#001161]" style={FF}>{selectedCreative.headline}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Chip color={selectedCreative.reviewStatus === 'approved' ? 'green' : selectedCreative.reviewStatus === 'rejected' ? 'red' : 'amber'}>
                          {selectedCreative.reviewStatus}
                        </Chip>
                        <Chip color="slate">{selectedCreative.format}</Chip>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="rounded-[24px] overflow-hidden bg-gradient-to-br from-[#001161] to-[#263fb4] text-white">
                        <div className="aspect-[4/5] relative">
                          {selectedCreative.imageUrl ? (
                            <img src={selectedCreative.imageUrl} alt={selectedCreative.headline} className="absolute inset-0 w-full h-full object-cover opacity-55" />
                          ) : null}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#001161] via-[#001161]/75 to-[#001161]/20" />
                          <div className="absolute inset-0 p-6 flex flex-col justify-end">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {selectedCreative.platformTargets.map((platform) => (
                                <span key={platform} className="px-2.5 py-1 rounded-full bg-white/15 text-[10px] font-bold uppercase tracking-wide" style={FF}>
                                  {platform}
                                </span>
                              ))}
                            </div>
                            <h4 className="text-[28px] leading-[1.02] font-bold max-w-[85%]" style={FF}>{selectedCreative.headline}</h4>
                            <p className="text-[13px] leading-relaxed text-white/85 mt-3 whitespace-pre-line" style={FF}>
                              {selectedCreative.primaryText}
                            </p>
                            <div className="mt-4">
                              <span className="inline-flex items-center rounded-full bg-[#F9E000] text-[#001161] px-4 py-2 text-[12px] font-bold" style={FF}>
                                {selectedCreative.cta}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-[16px] bg-[#f7f8fc] p-3">
                          <p className="text-[10px] uppercase tracking-wide text-[#001161]/35 font-bold" style={FF}>Angle</p>
                          <p className="text-[12px] text-[#001161] mt-1" style={FF}>{selectedCreative.angle}</p>
                        </div>
                        <div className="rounded-[16px] bg-[#f7f8fc] p-3">
                          <p className="text-[10px] uppercase tracking-wide text-[#001161]/35 font-bold" style={FF}>Audience</p>
                          <p className="text-[12px] text-[#001161] mt-1" style={FF}>{selectedCreative.audienceHint}</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <label className="text-[11px] text-[#001161]/45 font-bold uppercase tracking-wide" style={FF}>Image URL</label>
                        <input
                          value={selectedCreative.imageUrl || ''}
                          onChange={(event) => {
                            const value = event.target.value;
                            setCreatives((prev) => prev.map((item) => item.id === selectedCreative.id ? { ...item, imageUrl: value } : item));
                          }}
                          onBlur={() => void handleCreativeUpdate(selectedCreative.id, { imageUrl: selectedCreative.imageUrl || '' }, 'Obrázek uložen.')}
                          className="w-full rounded-[12px] border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/40"
                          style={FF}
                        />
                      </div>

                      <div className="mt-4 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => void handleCreativeApprove(selectedCreative.id)}
                          className="px-3 py-2 rounded-[12px] bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700"
                          style={FF}
                        >
                          Schválit
                        </button>
                        <button
                          onClick={() => void handleCreativeReject(selectedCreative.id)}
                          className="px-3 py-2 rounded-[12px] bg-red-50 text-red-600 text-[12px] font-bold hover:bg-red-100"
                          style={FF}
                        >
                          Zamítnout
                        </button>
                        <button
                          onClick={() => void handleCreativeUpdate(selectedCreative.id, { publishStatus: 'paused' }, 'Kreativa pozastavena.')}
                          className="px-3 py-2 rounded-[12px] bg-slate-100 text-slate-700 text-[12px] font-bold hover:bg-slate-200"
                          style={FF}
                        >
                          <PauseCircle className="w-3.5 h-3.5 inline mr-1" />
                          Pause
                        </button>
                        <button
                          onClick={() => void handleCreativeDelete(selectedCreative.id)}
                          className="px-3 py-2 rounded-[12px] bg-[#001161]/5 text-[#001161]/65 text-[12px] font-bold hover:bg-[#001161]/10"
                          style={FF}
                        >
                          <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                          Smazat
                        </button>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          onClick={() => void handleUpload('meta')}
                          disabled={publishing?.id === selectedCreative.id}
                          className="flex-1 px-3 py-2.5 rounded-[12px] bg-[#0A66FF] text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-45"
                          style={FF}
                        >
                          {publishing?.id === selectedCreative.id && publishing.platform === 'meta' ? 'Odesílám…' : 'Upload Meta'}
                        </button>
                        <button
                          onClick={() => void handleUpload('google')}
                          disabled={publishing?.id === selectedCreative.id}
                          className="flex-1 px-3 py-2.5 rounded-[12px] bg-[#34A853] text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-45"
                          style={FF}
                        >
                          {publishing?.id === selectedCreative.id && publishing.platform === 'google' ? 'Odesílám…' : 'Upload Google'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[13px] font-bold text-[#001161]" style={FF}>Asset picker</p>
                      <Chip color="slate">{assetCandidates.length} assetů</Chip>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {assetCandidates.map((item: any) => (
                        <button
                          key={`${item.id}-${item.image}`}
                          onClick={() => void handleCreativeUpdate(selectedCreative.id, { imageUrl: item.image, productId: String(item.id) }, 'Asset přiřazen.')}
                          className={`rounded-[14px] overflow-hidden border transition-all ${selectedCreative.imageUrl === item.image ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/15' : 'border-gray-200 hover:border-[#7C3AED]/30'}`}
                          title={item.name}
                        >
                          <div className="aspect-square bg-[#f7f8fc]">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              </div>
            </div>
          ) : activePanel === 'campaigns' ? (
            <div className="space-y-5">
              <div className="rounded-[20px] border border-gray-200 bg-white p-4">
                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <input
                    value={campaignForm.name}
                    onChange={(event) => setCampaignForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Např. Jaro 2026 - pracovní sešity"
                    className="rounded-[12px] border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/40"
                    style={FF}
                  />
                  <select
                    value={campaignForm.platform}
                    onChange={(event) => setCampaignForm((prev) => ({ ...prev, platform: event.target.value as GrowthPlatform }))}
                    className="rounded-[12px] border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-[#001161]"
                    style={FF}
                  >
                    <option value="meta">Meta</option>
                    <option value="google">Google</option>
                  </select>
                  <input
                    value={campaignForm.budget}
                    onChange={(event) => setCampaignForm((prev) => ({ ...prev, budget: event.target.value }))}
                    className="w-24 rounded-[12px] border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-[#001161]"
                    style={FF}
                  />
                </div>
                <button
                  onClick={() => void handleCreateCampaign()}
                  disabled={campaignSaving}
                  className="mt-3 w-full rounded-[14px] bg-[#001161] text-white py-2.5 text-[13px] font-bold hover:bg-[#0b1f84] disabled:opacity-45"
                  style={FF}
                >
                  {campaignSaving ? 'Ukládám…' : 'Přidat placeholder kampaň'}
                </button>
              </div>

              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-[20px] border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-bold text-[#001161]" style={FF}>{campaign.name}</p>
                        <p className="text-[12px] text-[#001161]/45 mt-1" style={FF}>
                          {campaign.platform.toUpperCase()} · Budget {campaign.budget} Kč
                        </p>
                      </div>
                      <Chip color={campaign.status === 'active' ? 'green' : 'amber'}>{campaign.status}</Chip>
                    </div>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <div className="rounded-[20px] border border-dashed border-gray-200 bg-white p-6 text-center">
                    <p className="text-[12px] text-[#001161]/45" style={FF}>
                      Zatím nejsou založené žádné kampaně. Phase 1 počítá hlavně s creative review frontou.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => void handleGenerateInsights()}
                disabled={insightsLoading}
                className="w-full rounded-[14px] bg-emerald-600 text-white py-2.5 text-[13px] font-bold hover:bg-emerald-700 disabled:opacity-45"
                style={FF}
              >
                {insightsLoading ? 'Generuji insights…' : 'Přepočítat insights'}
              </button>
              {insights.map((insight) => (
                <div key={insight.id} className="rounded-[20px] border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Chip color={insight.type === 'pattern' ? 'blue' : 'green'}>{insight.type}</Chip>
                    <Chip color="slate">{Math.round(insight.confidence * 100)}%</Chip>
                  </div>
                  <p className="text-[13px] text-[#001161] leading-relaxed" style={FF}>{insight.content}</p>
                </div>
              ))}
              {insights.length === 0 && (
                <div className="rounded-[20px] border border-dashed border-gray-200 bg-white p-6 text-center">
                  <BarChart3 className="w-6 h-6 text-emerald-600/45 mx-auto mb-2" />
                  <p className="text-[12px] text-[#001161]/45" style={FF}>
                    Zatím nejsou žádné insights. V Phase 1 se budou odvozovat hlavně z review stavu a základních výkonových polí.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
