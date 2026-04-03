import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { Buffer } from "node:buffer";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Enable CORS
app.use("/*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization"], allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));

// Inline KV store
const kvClient = () => createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);

/** Ověří JWT z Authorization a vrátí user id, jinak null (anonymní / sdílený klíč). */
async function getUserIdFromRequestAuth(c: { req: { header: (name: string) => string | undefined } }): Promise<string | null> {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!token || token === anon) return null;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!supabaseUrl || !anon) return null;
  const supabase = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.id) return null;
  return user.id;
}

/**
 * Pokud je v Supabase secrets nastaveno ASSISTANT_ALLOWED_EMAILS, ověří e-mail z JWT.
 * ASSISTANT_ALLOWLIST_OFF=true — kontrolu vypne (např. vývoj).
 * Když ASSISTANT_ALLOWED_EMAILS chybí, nekontroluje (zpětná kompatibilita).
 */
async function assistantEmailForbiddenIfConfigured(c: {
  req: { header: (name: string) => string | undefined };
  json: (body: unknown, status?: number) => Response;
}): Promise<Response | null> {
  if (Deno.env.get("ASSISTANT_ALLOWLIST_OFF") === "true" || Deno.env.get("ASSISTANT_ALLOWLIST_OFF") === "1") {
    return null;
  }
  const raw = Deno.env.get("ASSISTANT_ALLOWED_EMAILS")?.trim();
  if (!raw) return null;

  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!token || token === anon) return null;

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!supabaseUrl || !anon) return null;
  const supabase = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) {
    return c.json({ error: "assistant_access_denied" }, 403);
  }
  const allow = new Set(
    raw.split(/[,;\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  if (allow.size === 0 || !allow.has(user.email.trim().toLowerCase())) {
    return c.json({ error: "assistant_access_denied" }, 403);
  }
  return null;
}

function scopedStorageKey(rawKey: string, userId: string | null): string {
  if (!userId) return rawKey;
  return `user:${userId}:${rawKey}`;
}

const kv = {
  get: async (key: string): Promise<any> => {
    const supabase = kvClient();
    const { data, error } = await supabase.from("kv_store_954b19ad").select("value").eq("key", key).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.value;
  },
  set: async (key: string, value: any): Promise<void> => {
    const supabase = kvClient();
    const { error } = await supabase.from("kv_store_954b19ad").upsert({ key, value });
    if (error) throw new Error(error.message);
  },
  del: async (key: string): Promise<void> => {
    const supabase = kvClient();
    const { error } = await supabase.from("kv_store_954b19ad").delete().eq("key", key);
    if (error) throw new Error(error.message);
  }
};

// Health check
app.get("/make-server-954b19ad/health", (c) => {
  return c.json({ status: "ok", time: new Date().toISOString() });
});

// Storage Endpoints (s JWT = klíče per uživatel: user:<id>:tasks …)
app.get("/make-server-954b19ad/storage/:key", async (c) => {
  const rawKey = c.req.param("key");
  try {
    const forbidden = await assistantEmailForbiddenIfConfigured(c);
    if (forbidden) return forbidden;
    const userId = await getUserIdFromRequestAuth(c);
    const key = scopedStorageKey(rawKey, userId);
    const value = await kv.get(key);
    return c.json({ value });
  } catch (error: any) {
    console.error(`Error fetching key ${rawKey}:`, error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
});

app.post("/make-server-954b19ad/storage", async (c) => {
  try {
    const forbidden = await assistantEmailForbiddenIfConfigured(c);
    if (forbidden) return forbidden;
    const body = await c.req.json();
    const { key: rawKey, value } = body;
    
    if (!rawKey) {
      return c.json({ error: "Key is required" }, 400);
    }

    const userId = await getUserIdFromRequestAuth(c);
    const key = scopedStorageKey(rawKey, userId);
    await kv.set(key, value);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error saving data:", error);
    return c.json({ error: "Failed to save data" }, 500);
  }
});

// TRANSCRIPTION using Gemini 2.0 Flash
app.post("/make-server-954b19ad/transcribe", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    
    if (!geminiKey) {
        return c.json({ error: "API Key not found." }, 500);
    }

    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No audio file provided" }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    
    let mimeType = file.type || "audio/webm";

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: `Jsi přesný přepisovač audio nahrávek. Přepiš PŘESNĚ co slyšíš. Použij správnou interpunkci. Vrať POUZE přepsaný text.`
          }]
        },
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Audio } },
            { text: "Přepiš toto audio do textu. Vrať pouze přepis." }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return c.json({ text: text.trim() });

  } catch (error: any) {
    console.error("Transcription error:", error);
    return c.json({ error: error.message || "Failed to transcribe audio" }, 500);
  }
});

/** Dlouhý přepis z diktování → název úkolu, konkrétní kroky, přesný přepis (pro poznámku). */
app.post("/make-server-954b19ad/task-breakdown", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    if (!geminiKey) return c.json({ error: "Missing API Key" }, 500);

    const body = await c.req.json();
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) return c.json({ error: "transcript required" }, 400);
    if (transcript.length > 24000) return c.json({ error: "transcript too long" }, 400);

    const prompt = `Jsi asistent pro úkoly. Uživatel nadiktoval delší text v češtině.

PŘEPIS Z DIKTÁNÍ:
"""
${transcript}
"""

ÚKOLY:
1. Urči hlavní téma / cíl — zvol krátký výstižný název úkolu (max 90 znaků, bez uvozovek).
2. Rozlož obsah na 3–14 KONKRÉTNÍCH kroků — každý krok je jedna věc k provedení (sloveso: zavolat, napsat, domluvit, zkontrolovat, …). Bez opakování stejné myšlenky.
3. Pole "transcript" musí obsahovat PŘESNĚ stejný text jako vstupní přepis (žádné úpravy).

Vrať POUZE JSON:
{
  "title": "název úkolu",
  "steps": ["krok 1", "krok 2"],
  "transcript": "přesná kopie vstupního přepisu"
}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json", temperature: 0.2, maxOutputTokens: 8192 },
        }),
      },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[task-breakdown] Gemini error:", resp.status, errText.slice(0, 500));
      return c.json({ error: "task-breakdown failed" }, 502);
    }

    const data = await resp.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: { title?: string; steps?: string[]; transcript?: string };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return c.json({ error: "invalid JSON from model" }, 502);
    }

    const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 200) : "";
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter((s) => s.length > 0)
      : [];
    const outTranscript = typeof parsed.transcript === "string" && parsed.transcript.trim()
      ? parsed.transcript.trim()
      : transcript;

    if (!title && steps.length === 0) {
      return c.json({ error: "empty breakdown" }, 502);
    }

    return c.json({
      title: title || transcript.split(/\s+/).slice(0, 8).join(" ").slice(0, 90) || "Úkol",
      steps,
      transcript: outTranscript,
    });
  } catch (error: any) {
    console.error("[task-breakdown]", error);
    return c.json({ error: error.message || "task-breakdown failed" }, 500);
  }
});

// SMART EDIT - Text cleanup and editing
app.post("/make-server-954b19ad/smart-edit", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    if (!geminiKey) return c.json({ error: "Missing API Key" }, 500);

    const { currentText, newVoiceText, context, selection } = await c.req.json();

    /** Tlačítko „Doplnit z knihovny“ posílá prázdný hlas — nesmíme skončit před RAG. */
    const voiceNorm = typeof newVoiceText === "string" ? newVoiceText : "";
    const manualRagUi = context === "manual_rag_trigger";
    if (!voiceNorm.trim() && !manualRagUi) {
      return c.json({ cleanText: currentText || "", text: currentText || "", detectedTask: null });
    }

    const lowerVoice = voiceNorm.toLowerCase();
    const fullTextLower = `${currentText || ''} ${voiceNorm}`.toLowerCase();
    
    // If user has text selected - edit only that part
    if (context === "edit_selection" && selection && selection.text) {
      const editPrompt = `Uživatel označil část textu a chce ji upravit.

OZNAČENÝ TEXT (který chce změnit):
"${selection.text}"

UŽIVATELOVA INSTRUKCE:
"${voiceNorm}"

ÚKOLY:
1. Přeformuluj/uprav označený text podle instrukce
2. Zachovej význam a styl
3. Pokud říká "jinak/přeformuluj/napiš znovu" → přepiš stejnou myšlenku jinými slovy
4. Pokud říká "kratší" → zkrať
5. Pokud říká "delší/rozvoj" → rozšiř

Vrať POUZE JSON:
{ "editedSelection": "upravený text" }`;

      const editResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: editPrompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      if (editResp.ok) {
        const editData = await editResp.json();
        const result = JSON.parse(editData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        const editedSelection = result.editedSelection || selection.text;
        
        // Replace the selection in original text
        const before = currentText.substring(0, selection.start);
        const after = currentText.substring(selection.end);
        const newText = before + editedSelection + after;
        
        return c.json({ cleanText: newText, text: newText, ragSuggestion: null });
      }
      return c.json({ cleanText: currentText, text: currentText, ragSuggestion: null });
    }
    
    // If editing RAG suggestion, use simplified prompt focused on edits
    if (context === "edit_rag_suggestion") {
      // Check if user wants to add another product
      const wantsProduct = lowerVoice.includes('přidej') || lowerVoice.includes('doplň') || lowerVoice.includes('ještě');
      let productInfo = "";
      
      if (wantsProduct) {
        // Fetch RAG documents to find requested product
        const index = await kv.get('rag_document_index') || [];
        const docs = await Promise.all(index.map(async (doc: any) => await kv.get(`rag_doc_${doc.id}`)));
        const allDocs = docs.filter(Boolean);
        
        // Find which product user wants
        const productKeywords = ['prvouk', 'matemati', 'fyzik', 'chemi'];
        const requestedProduct = productKeywords.find(kw => lowerVoice.includes(kw));
        
        if (requestedProduct && allDocs.length > 0) {
          const matchingDoc = allDocs.find((d: any) => 
            d.title?.toLowerCase().includes(requestedProduct) ||
            d.content?.toLowerCase().includes(requestedProduct) ||
            d.metadata?.product?.toLowerCase().includes(requestedProduct)
          );
          if (matchingDoc) {
            productInfo = `

DOKUMENT PRO PŘIDÁNÍ - "${matchingDoc.title}":
${matchingDoc.content?.substring(0, 1500)}

Shrň tento dokument do 3-4 vět a přidej ho do textu.`;
          }
        }
      }

      const editPrompt = `Jsi asistent pro úpravu textu.

STÁVAJÍCÍ TEXT (RAG návrh emailu):
${currentText}

UŽIVATELOVA INSTRUKCE:
${voiceNorm}${productInfo}

ÚKOLY:
1. APLIKUJ instrukci na stávající text
2. Pokud uživatel chce přidat produkt → přidej STRUČNÉ shrnutí (3-4 věty) z dokumentu
3. Pokud "zkrať/uprav/změň" → uprav text podle instrukce
4. NEPŘIDÁVEJ instrukci doslovně do textu!
5. Zachovej formát emailu (oslovení, odstavce, podpis)
6. Oslovení VŽDY na první řádce, podpis VŽDY na konci

Vrať POUZE JSON:
{ "text": "upravený email" }`;

      const editResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: editPrompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      if (editResp.ok) {
        const editData = await editResp.json();
        const result = JSON.parse(editData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        return c.json({ cleanText: result.text || currentText, text: result.text || currentText, ragSuggestion: null });
      }
      return c.json({ cleanText: currentText, text: currentText, ragSuggestion: null });
    }
    
    // Check for manual RAG trigger from UI button
    const isManualRagTrigger = lowerVoice.includes('zkontroluj rag knihovnu') || context === "manual_rag_trigger";
    
    // For manual trigger, use currentText directly (skip cleaning)
    let cleanText = isManualRagTrigger ? currentText : "";
    
    // STEP 1: Generate clean text (skip if manual trigger)
    if (!isManualRagTrigger) {
      const cleanPrompt = `Vyčisti nadiktovaný text a naformátuj ho jako profesionální email.

ÚKOLY:
1. VYČISTI přeřeky: ehmm, ehh, jako, prostě, no, takže, vlastně
2. OPRAV gramatiku a interpunkci
3. KOREKCE: "VirtualBox" → "Vividbooks"
4. Pokud "uprav/změň/kratší" → uprav STÁVAJÍCÍ text
5. Jinak připoj ke stávajícímu

FORMÁTOVÁNÍ EMAILU:
- Oslovení na první řádce
- Prázdný řádek po oslovení
- Odstavce max 2-3 věty
- Prázdné řádky mezi odstavci
- Podpis: "S pozdravem,\\nVítek Škop"

STÁVAJÍCÍ TEXT:
${currentText || "(prázdný)"}

NOVÝ VSTUP:
${voiceNorm}

Vrať JSON: { "text": "naformátovaný text" }`;

      const cleanResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          contents: [{ parts: [{ text: cleanPrompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      if (cleanResp.ok) {
        const cleanData = await cleanResp.json();
        const cleanResult = JSON.parse(cleanData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        cleanText = cleanResult.text || voiceNorm;
      } else {
        cleanText = currentText ? `${currentText}\n\n${voiceNorm}` : voiceNorm;
      }
    }
    
    // STEP 2: Use AI to decide if RAG is needed
    let needsRag = isManualRagTrigger;
    let ragSearchQuery = "";
    let ragDecisionReason = "";
    
    console.log(`[SmartEdit] Starting RAG decision. cleanText length: ${cleanText.length}, manual: ${isManualRagTrigger}`);
    
    if (!isManualRagTrigger && cleanText.length > 20) {
      const ragDecisionPrompt = `Analyzuj tento email/text a rozhodni, jestli potřebuje doplnit informace z firemní databáze.

TEXT:
"${cleanText}"

DATABÁZE OBSAHUJE info o:
- Vividbooks produktech (Matematika, Prvouka, Fyzika, Chemie, Přírodopis - učebnice pro ZŠ)
- Webinářích a školeních pro učitele
- Cenících a nabídkách

KDY POTŘEBUJE RAG (needsRag: true):
- Autor zmiňuje produkty, webináře, školení, učebnice, ceny
- Autor chce poslat někomu informace o firmě/produktech
- Text by byl lepší s konkrétními fakty

PŘÍKLADY kde needsRag=TRUE:
- "Posílám info o webinářích" → hledat: "webináře"
- "Nabízím matematiku" → hledat: "matematika"
- "Jaká je cena?" → hledat: "ceník"

Vrať JSON:
{
  "needsRag": true,
  "reason": "důvod",
  "searchQuery": "co hledat"
}`;

      try {
        const decisionResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
            contents: [{ parts: [{ text: ragDecisionPrompt }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });
        
        if (decisionResp.ok) {
          const decisionData = await decisionResp.json();
          const decision = JSON.parse(decisionData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
          console.log(`[SmartEdit] RAG Decision:`, JSON.stringify(decision));
          
          needsRag = decision.needsRag === true;
          ragSearchQuery = decision.searchQuery || "";
          ragDecisionReason = decision.reason || "";
        } else {
          console.error(`[SmartEdit] RAG decision API error: ${decisionResp.status}`);
        }
      } catch (e) {
        console.error("[SmartEdit] RAG decision failed:", e);
      }
    }
    
    console.log(`[SmartEdit] RAG needed: ${needsRag}, query: "${ragSearchQuery}", reason: "${ragDecisionReason}", manual: ${isManualRagTrigger}`);
    
    // If no RAG needed, return clean text only
    if (!needsRag) {
      console.log(`[SmartEdit] Skipping RAG - not needed`);
      return c.json({ 
        cleanText, 
        text: cleanText, 
        ragSuggestion: null, 
        ragDocTitle: null, 
        ragSkipped: true,
        ragSkipReason: ragDecisionReason || "AI rozhodla že RAG není potřeba",
        detectedTask: null 
      });
    }

    // STEP 3: Web RAG — stejné chunky jako Web operátor (POST …/rag/retrieve), ne syntéza z rag/query
    const refinedQuery = await refineRagQueryForSmartEdit(cleanText, ragSearchQuery, geminiKey);
    const ragQuery = refinedQuery.trim() || (ragSearchQuery || cleanText).trim();
    console.log(
      `[SmartEdit] Web RAG query (${ragQuery.length} znaků): ${ragQuery.slice(0, 200)}${ragQuery.length > 200 ? "…" : ""}`,
    );
    let pgChunks = await fetchPgvectorRagChunksForOrchestrator(ragQuery, { topK: 14 });
    if (!pgChunks?.context) {
      const fb = buildSmartEditRetrieveFallbackQuery(cleanText);
      if (fb && fb.trim() && fb.trim().toLowerCase() !== ragQuery.trim().toLowerCase()) {
        console.log("[SmartEdit] rag/retrieve prázdné; druhý pokus retrieve:", fb.slice(0, 160));
        pgChunks = await fetchPgvectorRagChunksForOrchestrator(fb, { topK: 16 });
      }
    }

    if (pgChunks?.context) {
      const sourceTitles = pgChunks.titles.length
        ? pgChunks.titles
        : [];
      const ragPrompt = `Jsi obchodník Vividbooks. Uživatel má ROZEPSANÝ EMAIL a chce ho doplnit o POMOCNÉ, K SOBĚ PATŘÍCÍ informace pro příjemce — ne o náhodné kusy katalogu ani nesouvisející akce.

PŮVODNÍ EMAIL:
---
${cleanText}
---

OVĚŘENÝ ZNALOSTNÍ KONTEKST (plné chunky z pgvector — stejný index jako Web operátor / chat; čti je doslova pro fakta):
---
${pgChunks.context}
---
${sourceTitles.length ? `Názvy zdrojů (orientační): ${sourceTitles.slice(0, 8).join(", ")}` : ""}

JAK POSTUPOVAT:
1. Urči hlavní téma emailu (co příjemce řeší). Doplň POUZE informace z kontextu, které tomuto tématu logicky pomáhají (webináře včetně termínů, nabídka, MŠMT/RVP, předmět, balíček).
2. Pokud kontext obsahuje **konkrétní termíny nebo názvy webinářů**, vlož je do těla e-mailu — **nepiš**, že „nemáme termíny“, pokud jsou v kontextu uvedeny.
3. Přidej 1–2 krátké věty nebo jeden souvislý odstavec „pomocných informací“ — přirozeně za hlavní větu těla, ne jako odrážkový výčet produktů.
4. Nepřidávej nesouvisející slevy ani katalog „NOVÝ KATALOG“ jen proto, že se objeví v kontextu, pokud to nesouvisí s tématem emailu.
5. Zachovej oslovení a podpis uživatele; neměň jeho tón, pokud není nutné pro srozumitelnost.
6. Piš česky, stručně, profesionálně.

ZAKÁZÁNO:
- Vymýšlet fakta mimo znalostní kontext
- Obecné věty typu „na webu najdete přehled…“
- Protichůdné tvrzení (např. „nemáme termíny“) pokud kontext termíny obsahuje
- Generické marketingové formulace („přinesou novinky“, „inspiraci od expertů“, „praktické tipy do výuky“, obecné chvály produktu), pokud se v kontextu doslova nevyskytují — to není obsah z knihovny, to je halucinace

Vrať POUZE JSON:
{ "ragEnhancedText": "kompletní upravený email" }`;

      const ragResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: ragPrompt }] }],
          generationConfig: { response_mime_type: "application/json" },
        }),
      });

      let ragSuggestion: string | null = null;
      if (ragResp.ok) {
        const ragData = await ragResp.json();
        const ragResult = JSON.parse(ragData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        ragSuggestion = ragResult.ragEnhancedText || null;
      }
      if (ragSuggestion) {
        const ragDocTitle = sourceTitles[0] || "Znalostní knihovna (RAG)";
        return c.json({ cleanText, text: cleanText, ragSuggestion, ragDocTitle, detectedTask: null });
      }
      console.log("[SmartEdit] Sloučení s pgvector kontextem selhalo; zkouším KV zálohu…");
    }

    console.log(`[SmartEdit] Web RAG returned nothing; falling back to KV library...`);
    const index = await kv.get('rag_document_index') || [];
    console.log(`[SmartEdit] KV library has ${index.length} documents`);

    if (index.length === 0) {
      console.log(`[SmartEdit] No KV documents and web RAG empty`);
      return c.json({
        cleanText,
        text: cleanText,
        ragSuggestion: null,
        ragDocTitle: null,
        ragSkipped: true,
        ragSkipReason: "Nenalezen relevantní obsah v knihovně (zkuste upřesnit text nebo formulovat dotaz jinak).",
        detectedTask: null,
      });
    }

    const docs = await Promise.all(index.map(async (doc: any) => await kv.get(`rag_doc_${doc.id}`)));
    const allDocs = docs.filter(Boolean);

    const searchPrompt = `HLEDANÝ KONTEXT: "${ragSearchQuery || cleanText}"

DOKUMENTY V KNIHOVNĚ:
${allDocs.map((d: any, i: number) => `[${i}] ${d.title}
    Kategorie: ${d.category || 'neznámá'}
    Produkt: ${d.metadata?.product || d.product || 'obecné'}
    Shrnutí: ${d.metadata?.summary || d.content?.substring(0, 150) || ''}`).join('\n\n')}

ÚKOL: Vyber dokument který NEJLÉPE odpovídá hledanému kontextu.

Vrať JSON:
{ 
  "bestMatchIndex": číslo indexu (0-${allDocs.length - 1}) nebo -1 pokud nic nesedí,
  "confidence": 0.0-1.0,
  "matchReason": "proč tento dokument"
}`;

    let bestDoc = null;
    try {
      const searchResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          contents: [{ parts: [{ text: searchPrompt }] }],
          generationConfig: { response_mime_type: "application/json" }
      })
    });

      if (searchResp.ok) {
        const searchData = await searchResp.json();
        const result = JSON.parse(searchData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        console.log(`[SmartEdit] KV search result:`, result);
        if (result.bestMatchIndex >= 0 && result.confidence > 0.5) {
          bestDoc = allDocs[result.bestMatchIndex];
        }
      }
    } catch (e) {
      console.error("[SmartEdit] KV search failed:", e);
    }

    if (!bestDoc) {
      return c.json({
        cleanText,
        text: cleanText,
        ragSuggestion: null,
        ragDocTitle: null,
        detectedTask: null,
        ragSkipped: true,
        ragSkipReason: "V knihovně (KV) nebyl vybrán vhodný dokument.",
      });
    }

    const ragPromptKv = `Jsi obchodník Vividbooks. Uživatel má ROZEPSANÝ EMAIL a chce ho doplnit o POMOCNÉ informace z dokumentu — jen takové, které souvisí s tématem emailu.

PŮVODNÍ EMAIL:
---
${cleanText}
---

DOKUMENT Z KNIHOVNY - "${bestDoc.title}":
---
${bestDoc.content?.substring(0, 2000)}
---

JAK POSTUPOVAT:
1. Urči téma emailu. Vyber z dokumentu jen fakta, která tomuto tématu pomáhají (produkt, stupeň, MŠMT/RVP, balíčky).
2. Přidej krátký souvislý odstavec nebo věty — ne náhodný výčet nesouvisejících akcí.
3. Zachovej oslovení a podpis.

ZAKÁZÁNO:
- Vymýšlet mimo dokument
- Obecné fráze bez konkrétních dat z dokumentu
- Generický marketing stejný pro každý email — pokud dokument nemá konkrétní termíny/data pro téma emailu, uprav email jen minimálně nebo ho nech beze změny (lépe než vymýšlet)

Vrať POUZE JSON:
{ "ragEnhancedText": "kompletní upravený email" }`;

    const ragResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: ragPromptKv }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    let ragSuggestion = null;
    if (ragResp.ok) {
      const ragData = await ragResp.json();
      const ragResult = JSON.parse(ragData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
      ragSuggestion = ragResult.ragEnhancedText || null;
    }

    return c.json({
      cleanText,
      text: cleanText,
      ragSuggestion,
      ragDocTitle: bestDoc?.title || null,
      detectedTask: null,
      ...(ragSuggestion ? {} : { ragSkipped: true, ragSkipReason: "Knihovna (KV) nenašla konkrétní fakta k doplnění." }),
    });

  } catch (error: any) {
    console.error("Smart Edit error:", error);
    return c.json({ cleanText: "", text: "", detectedTask: null, error: error.message }, 500);
  }
});

// ========== RAG SYSTEM WITH CATEGORIES ==========

// RAG Categories
const RAG_CATEGORIES = {
  'produkt': { name: 'Produkty', icon: '📚', description: 'Matematika, Prvouka, Fyzika, Chemie, Přírodopis' },
  'firma': { name: 'O firmě', icon: '🏢', description: 'O Vividbooks, Principy, Tým' },
  'prodej': { name: 'Prodej', icon: '💰', description: 'Ceníky, Nabídky, Argumenty' },
  'sablona': { name: 'Šablony', icon: '✉️', description: 'Email šablony, Odpovědi' },
  'novinka': { name: 'Novinky', icon: '📰', description: 'Blog, Webináře, Aktuality' }
};

// Get all RAG documents with full details
app.get("/make-server-954b19ad/rag/documents", async (c) => {
  try {
    const index = await kv.get('rag_document_index') || [];
    const includeContent = c.req.query('includeContent') === 'true';
    
    if (includeContent) {
      const docs = await Promise.all(index.map(async (doc: any) => {
        const fullDoc = await kv.get(`rag_doc_${doc.id}`);
        return fullDoc || doc;
      }));
      return c.json({ documents: docs, categories: RAG_CATEGORIES });
    }
    
    return c.json({ documents: index, categories: RAG_CATEGORIES });
  } catch (error: any) {
    return c.json({ documents: [], categories: RAG_CATEGORIES, error: error.message });
  }
});

// Add RAG document with category
app.post("/make-server-954b19ad/rag/documents", async (c) => {
  try {
    const { 
      id, 
      title, 
      content, 
      category = 'produkt',
      product = null,
      grade = null,
      tags = [],
      source = 'manual'
    } = await c.req.json();
    
    const docId = id || `doc_${Date.now()}`;
    
    const doc = {
      id: docId,
      title,
      content,
      category,
      product,
      grade,
      tags,
      source,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      wordCount: content.split(/\s+/).length
    };

    await kv.set(`rag_doc_${docId}`, doc);
    
    const index = await kv.get('rag_document_index') || [];
    const existingIdx = index.findIndex((d: any) => d.id === docId);
    
    const indexEntry = { 
      id: docId, 
      title, 
      category, 
      product,
      grade,
      tags,
      source,
      createdAt: doc.createdAt, 
      wordCount: doc.wordCount 
    };
    
    if (existingIdx >= 0) {
      index[existingIdx] = indexEntry;
    } else {
      index.push(indexEntry);
    }
    
    await kv.set('rag_document_index', index);

    return c.json({ success: true, document: doc });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Delete RAG document
app.delete("/make-server-954b19ad/rag/documents/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`rag_doc_${id}`);
    
    const index = await kv.get('rag_document_index') || [];
    const newIndex = index.filter((doc: any) => doc.id !== id);
    await kv.set('rag_document_index', newIndex);

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Seed RAG with Vividbooks product data
app.post("/make-server-954b19ad/rag/seed", async (c) => {
  try {
    const seedData = [
      {
        id: 'mat-2st',
        title: 'Matematika pro 2. stupeň',
        category: 'produkt',
        product: 'matematika',
        grade: '2. stupeň',
        tags: ['učebnice', 'pracovní sešit', '6.-9. ročník'],
        content: `Vividbooks Matematika pro 2. stupeň ZŠ (6.-9. ročník)

Žáky vedeme pomocí malých kroků k hledání vlastních postupů a řešení. Hezky od známého k neznámému, od jednoduchého ke složitějšímu. Nezapomínáme na důležitost procvičování a upevňování nabytých znalostí. Stavíme znalost matematiky jako dům – od pevných základů.

Vydáváme jako:
- Pracovní sešity se základním digitálním přístupem
- Digitální učebnice s rozšířeným digitálním přístupem

Má doložku MŠMT a je podle RVP.`
      },
      {
        id: 'mat-1st',
        title: 'Matematika pro 1. stupeň',
        category: 'produkt',
        product: 'matematika',
        grade: '1. stupeň',
        tags: ['učebnice', 'pracovní učebnice', '1. ročník'],
        content: `Vividbooks Matematika pro 1. stupeň ZŠ (1. ročník, NOVINKA)

Učebnice vede žáky k chápání matematiky jako smysluplné, užitečné a hodnotné činnosti. Podporuje jejich víru ve vlastní schopnosti a probouzí nadšení pro intelektuální práci. Nic nemotivuje žáka k práci v matematice více, než když dospěje k porozumění.

Vydáváme jako:
- Pracovní učebnice s digitálním přístupem

Redakční plán:
- 2. ročník: Jaro 2026
- 3. ročník: Podzim 2026`
      },
      {
        id: 'prvouka',
        title: 'Prvouka pro 1. stupeň',
        category: 'produkt',
        product: 'prvouka',
        grade: '1. stupeň',
        tags: ['učebnice', 'pracovní učebnice', '1. ročník', 'příroda'],
        content: `Vividbooks Prvouka pro 1. stupeň ZŠ (1. ročník, NOVINKA)

Nová pracovní učebnice prvouky propojuje teorii s praxí v přírodě. Reaguje na změny v RVP a rozvíjí badatelské dovednosti i kritické myšlení. Zaměřuje se na udržitelnost a poznávání přírody, aby děti objevovaly svět a učily se odpovědnosti.

Vydáváme jako:
- Pracovní učebnice s digitálním přístupem

Vyrobeno ve spolupráci se vzdělávacím centrem TEREZA.`
      },
      {
        id: 'fyzika',
        title: 'Fyzika pro 2. stupeň',
        category: 'produkt',
        product: 'fyzika',
        grade: '2. stupeň',
        tags: ['učebnice', 'pracovní sešit', '6.-9. ročník'],
        content: `Vividbooks Fyzika pro 2. stupeň ZŠ (6.-9. ročník)

Výuka fyziky by neměla probíhat pouhým předáváním informací od vyučujícího směrem k žákům. Učebnici Vividbooks Fyzika jsme navrhli tak, aby inspirovala žáky k aktivitě. Děti budou přemýšlet, řešit problémy a hledat vlastní odpovědi a argumenty.

Vydáváme jako:
- Pracovní sešity se základním digitálním přístupem
- Digitální učebnice s rozšířeným digitálním přístupem

Má doložku MŠMT a je podle RVP.`
      },
      {
        id: 'chemie',
        title: 'Chemie pro 2. stupeň',
        category: 'produkt',
        product: 'chemie',
        grade: '2. stupeň',
        tags: ['učebnice', 'pracovní sešit', '8.-9. ročník'],
        content: `Vividbooks Chemie pro 2. stupeň ZŠ (8.-9. ročník)

Výuka chemie by neměla probíhat pouhým předáváním informací. Učebnici Vividbooks Chemie jsme navrhli tak, aby inspirovala žáky k aktivitě. Děti budou přemýšlet, řešit problémy a hledat vlastní odpovědi a argumenty.

Vydáváme jako:
- Pracovní sešity se základním digitálním přístupem
- Digitální učebnice s rozšířeným digitálním přístupem

Má doložku MŠMT a je podle RVP.`
      },
      {
        id: 'prirodopis',
        title: 'Přírodopis pro 2. stupeň',
        category: 'produkt',
        product: 'přírodopis',
        grade: '2. stupeň',
        tags: ['učebnice', 'pracovní sešit', '6.-8. ročník', 'biologie'],
        content: `Vividbooks Přírodopis pro 2. stupeň ZŠ (6.-8. ročník)

Základem efektivního učení je aktivita žáků a budování vztahu k přírodě. Vividbooks Přírodopis klade důraz na aktivity místo pouhého výčtu pojmů, začleňuje skupiny do kontextu prostředí a vztahů s organismy a nabízí ekologický i systematický přístup k výuce.

Vydáváme jako:
- Pracovní sešity se základním digitálním přístupem
- Digitální učebnice s rozšířeným digitálním přístupem

Má doložku MŠMT a je podle RVP.`
      },
      {
        id: 'o-vividbooks',
        title: 'O Vividbooks',
        category: 'firma',
        product: null,
        tags: ['firma', 'nakladatelství', 'mise'],
        content: `Vividbooks - Učení, které inspiruje a baví

Vividbooks je nakladatelství pro základní školy, které nabízí učitelům vše potřebné pro moderní a smysluplnou výuku.

Naše produkty:
- Digitální učebnice
- Pracovní sešity a učebnice
- Vividboard (interaktivní tabule)
- Didaktické obrazy a plakáty

Vzdělávání učitelů:
- Webináře
- První kroky s Vividbooks
- Individuální mentoring učitelů

Vividbooks jsou digitální učební pomůcka a je možné je zakoupit z příspěvku od MŠMT v rámci Národního plánu obnovy.

Cena interaktivní licence od 55 Kč na žáka a rok. Cena za tištěný pracovní sešit 125 Kč. Cena za tištěnou učebnici 195 Kč.

Kontakt:
Vividbooks s.r.o.
Nad Královskou oborou 33
170 00, Praha`
      },
      {
        id: 'cenik',
        title: 'Ceník Vividbooks',
        category: 'prodej',
        product: null,
        tags: ['cena', 'licence', 'nabídka'],
        content: `Ceník Vividbooks

Interaktivní licence: od 55 Kč na žáka a rok
Tištěný pracovní sešit: 125 Kč
Tištěná učebnice: 195 Kč

Všechny ceny jsou uvedeny včetně DPH.

Vividbooks jsou digitální učební pomůcka - lze zakoupit z příspěvku od MŠMT v rámci Národního plánu obnovy.

Pro přesnou cenovou nabídku kontaktujte našeho obchodního zástupce.`
      },
      {
        id: 'webinare',
        title: 'Webináře Vividbooks',
        category: 'novinka',
        product: null,
        tags: ['webinář', 'vzdělávání', 'školení', 'online'],
        content: `Webináře Vividbooks - Vzdělávání učitelů

Pořádáme pravidelné webináře pro učitele, kde představujeme:
- Novinky v učebnicích
- Tipy pro efektivní využití digitálních materiálů
- Metodické postupy pro aktivní výuku
- Nové funkce a aktualizace

Typy webinářů:
1. Představení nových produktů (Matematika, Prvouka, Fyzika, Chemie)
2. První kroky s Vividbooks - pro začátečníky
3. Pokročilé techniky pro zkušené uživatele
4. Tematické webináře k jednotlivým předmětům

Webináře jsou ZDARMA pro všechny učitele.
Registrace na: https://www.vividbooks.com/cs/webinare

Aktuální webináře:
- Představení nové řady: Český jazyk od Vividbooks
- Jak efektivně využít interaktivní učebnice
- Novinky v matematice pro 1. stupeň`
      },
      {
        id: 'vzdelavani-ucitelu',
        title: 'Vzdělávání učitelů',
        category: 'firma',
        product: null,
        tags: ['mentoring', 'podpora', 'školení'],
        content: `Vzdělávání učitelů Vividbooks

Nabízíme komplexní podporu pro učitele:

1. WEBINÁŘE
- Pravidelné online semináře zdarma
- Představení novinek a aktualizací
- Metodické tipy a triky

2. PRVNÍ KROKY S VIVIDBOOKS
- Úvodní školení pro nové uživatele
- Nastavení a první použití
- Základní funkce a navigace

3. INDIVIDUÁLNÍ MENTORING
- Osobní konzultace s metodikem
- Přizpůsobení na míru vaší škole
- Dlouhodobá podpora

Všechna školení jsou součástí licence nebo dostupná za zvýhodněnou cenu.
Kontaktujte nás pro více informací.`
      }
    ];

    // Clear existing seed data
    const index = await kv.get('rag_document_index') || [];
    
    for (const seed of seedData) {
      const doc = {
        ...seed,
        source: 'seed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        wordCount: seed.content.split(/\s+/).length
      };
      
      await kv.set(`rag_doc_${seed.id}`, doc);
      
      const existingIdx = index.findIndex((d: any) => d.id === seed.id);
      const indexEntry = {
        id: seed.id,
        title: seed.title,
        category: seed.category,
        product: seed.product,
        grade: seed.grade,
        tags: seed.tags,
        source: 'seed',
        createdAt: doc.createdAt,
        wordCount: doc.wordCount
      };
      
      if (existingIdx >= 0) {
        index[existingIdx] = indexEntry;
      } else {
        index.push(indexEntry);
      }
    }
    
    await kv.set('rag_document_index', index);
    
    return c.json({ success: true, seeded: seedData.length, documents: index });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ========== WEBFLOW CMS INTEGRATION ==========

// Get Webflow sites (for debugging)
app.get("/make-server-954b19ad/rag/webflow-sites", async (c) => {
  try {
    const WEBFLOW_TOKEN = "7d0575ff912bd6c266716b85b9ff5239f91d52952515a15f4902130e0d0f9341";
    
    const sitesResp = await fetch(`https://api.webflow.com/v2/sites`, {
      headers: { 'Authorization': `Bearer ${WEBFLOW_TOKEN}` }
    });
    
    if (!sitesResp.ok) {
      const errText = await sitesResp.text();
      return c.json({ error: `Webflow API error: ${sitesResp.status}`, details: errText }, 500);
    }
    
    const data = await sitesResp.json();
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-954b19ad/rag/sync-webflow", async (c) => {
  try {
    const WEBFLOW_TOKEN = "7d0575ff912bd6c266716b85b9ff5239f91d52952515a15f4902130e0d0f9341";
    
    // First, get the site ID dynamically
    const sitesResp = await fetch(`https://api.webflow.com/v2/sites`, {
      headers: { 'Authorization': `Bearer ${WEBFLOW_TOKEN}` }
    });
    
    if (!sitesResp.ok) {
      const errText = await sitesResp.text();
      throw new Error(`Webflow Sites API error: ${sitesResp.status} - ${errText}`);
    }
    
    const sitesData = await sitesResp.json();
    const sites = sitesData.sites || [];
    
    if (sites.length === 0) {
      return c.json({ success: false, error: "No Webflow sites found with this token", syncedItems: 0 });
    }
    
    const SITE_ID = sites[0].id; // Use first site
    console.log(`[Webflow] Using site: ${sites[0].displayName} (${SITE_ID})`);
    
    // Get collections
    const collectionsResp = await fetch(`https://api.webflow.com/v2/sites/${SITE_ID}/collections`, {
      headers: { 'Authorization': `Bearer ${WEBFLOW_TOKEN}` }
    });
    
    if (!collectionsResp.ok) {
      const errText = await collectionsResp.text();
      throw new Error(`Webflow Collections API error: ${collectionsResp.status} - ${errText}`);
    }
    
    const collectionsData = await collectionsResp.json();
    const collections = collectionsData.collections || [];
    
    let syncedItems = 0;
    const index = await kv.get('rag_document_index') || [];
    
    for (const collection of collections) {
      // Get items from each collection
      const itemsResp = await fetch(`https://api.webflow.com/v2/collections/${collection.id}/items`, {
        headers: { 'Authorization': `Bearer ${WEBFLOW_TOKEN}` }
      });
      
      if (itemsResp.ok) {
        const itemsData = await itemsResp.json();
        const items = itemsData.items || [];
        
        for (const item of items) {
          const docId = `webflow_${item.id}`;
          const doc = {
            id: docId,
            title: item.fieldData?.name || item.fieldData?.title || 'Bez názvu',
            content: item.fieldData?.description || item.fieldData?.content || '',
            category: 'novinka',
            product: null,
            tags: ['webflow', collection.displayName],
            source: 'webflow',
            webflowId: item.id,
            collectionName: collection.displayName,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            wordCount: (item.fieldData?.description || '').split(/\s+/).length
          };
          
          if (doc.content) {
            await kv.set(`rag_doc_${docId}`, doc);
            
            const existingIdx = index.findIndex((d: any) => d.id === docId);
            const indexEntry = {
              id: docId,
              title: doc.title,
              category: 'novinka',
              source: 'webflow',
              createdAt: doc.createdAt,
              wordCount: doc.wordCount
            };
            
            if (existingIdx >= 0) {
              index[existingIdx] = indexEntry;
            } else {
              index.push(indexEntry);
            }
            syncedItems++;
          }
        }
      }
    }
    
    await kv.set('rag_document_index', index);
    await kv.set('rag_last_webflow_sync', Date.now());
    
    return c.json({ success: true, syncedItems, collections: collections.map((c: any) => c.displayName) });
  } catch (error: any) {
    console.error("[Webflow Sync] Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ========== WEB SCRAPING FOR BLOG & WEBINARS ==========
app.post("/make-server-954b19ad/rag/scrape-web", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    if (!geminiKey) return c.json({ error: "Missing GEMINI_API_KEY_RAG" }, 500);
    
    const index = await kv.get('rag_document_index') || [];
    let scrapedCount = 0;
    
    // STEP 1: Scrape webinars page and find individual webinar links
    console.log("[Scrape] Starting webinars scrape...");
    try {
      const webinarsResp = await fetch('https://www.vividbooks.com/cs/webinare');
      if (webinarsResp.ok) {
        const html = await webinarsResp.text();
        
        // Extract webinar links and details using AI
        const extractPrompt = `Analyzuj tuto HTML stránku s webináři Vividbooks.

HTML:
${html.substring(0, 30000)}

ÚKOL: Najdi VŠECHNY webináře na stránce. Hledej:
- Nadpisy (h1, h2, h3) s názvy webinářů
- Datumy ve formátu DD.MM.YYYY nebo podobné
- Časy ve formátu HH:MM
- Popisy a témata webinářů
- Jména přednášejících/lektorů
- Odkazy na registraci nebo detail

Pro KAŽDÝ webinář extrahuj všechny dostupné informace.

Vrať JSON:
{
  "webinars": [
    {
      "title": "Přesný název webináře",
      "date": "datum (DD.MM.YYYY)",
      "time": "čas (HH:MM)",
      "description": "CELÝ popis webináře - co se na něm naučíte, pro koho je určen",
      "link": "odkaz na registraci/detail nebo null",
      "speaker": "jméno přednášejícího"
    }
  ]
}`;

        const extractResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: extractPrompt }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });

        if (extractResp.ok) {
          const extractData = await extractResp.json();
          const result = JSON.parse(extractData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
          console.log(`[Scrape] Found ${result.webinars?.length || 0} webinars`);
          
          // Save each webinar as a separate document
          for (const webinar of (result.webinars || [])) {
            if (webinar.title) {
              const docId = `webinar_${webinar.title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 40)}`;
              const content = `WEBINÁŘ: ${webinar.title}
${webinar.date ? `Datum: ${webinar.date}` : ''}
${webinar.time ? `Čas: ${webinar.time}` : ''}
${webinar.speaker ? `Přednášející: ${webinar.speaker}` : ''}

${webinar.description || ''}

Registrace: https://www.vividbooks.com/cs/webinare`;

              const doc = {
                id: docId,
                title: webinar.title,
                content,
                category: 'novinka',
                tags: ['webinář', 'školení', 'online'],
                source: 'scrape',
                sourceUrl: webinar.link || 'https://www.vividbooks.com/cs/webinare',
                eventDate: webinar.date,
                createdAt: Date.now(),
                wordCount: content.split(/\s+/).length
              };
              
              await kv.set(`rag_doc_${docId}`, doc);
              
              const existingIdx = index.findIndex((d: any) => d.id === docId);
              const indexEntry = { id: docId, title: webinar.title, category: 'novinka', source: 'scrape', createdAt: doc.createdAt, wordCount: doc.wordCount };
              if (existingIdx >= 0) {
                index[existingIdx] = indexEntry;
              } else {
                index.push(indexEntry);
              }
              scrapedCount++;
            }
          }
        }
      }
    } catch (e) {
      console.error("[Scrape] Webinars error:", e);
    }

    // STEP 2: Scrape blog - first get list of articles, then scrape each one
    console.log("[Scrape] Starting blog scrape...");
    try {
      const blogResp = await fetch('https://www.vividbooks.com/cs/blog');
      if (blogResp.ok) {
        const html = await blogResp.text();
        
        // First, extract list of articles with their links
        const listPrompt = `Analyzuj tuto HTML stránku s blogem.

HTML:
${html.substring(0, 25000)}

ÚKOL: Najdi VŠECHNY blogové články a pro každý extrahuj:
- Název článku
- Odkaz na článek (href)
- Datum publikace
- Krátký popis

Vrať JSON:
{
  "articles": [
    {
      "title": "Název článku",
      "link": "/cs/blog/nazev-clanku nebo celá URL",
      "date": "datum",
      "summary": "krátký popis"
    }
  ]
}`;

        const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: listPrompt }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });

        if (listResp.ok) {
          const listData = await listResp.json();
          const result = JSON.parse(listData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
          console.log(`[Scrape] Found ${result.articles?.length || 0} blog articles`);
          
          // Now scrape each individual article
          for (const article of (result.articles || []).slice(0, 10)) { // Limit to 10 articles
            if (article.title && article.link) {
              try {
                // Build full URL
                let articleUrl = article.link;
                if (!articleUrl.startsWith('http')) {
                  articleUrl = `https://www.vividbooks.com${articleUrl.startsWith('/') ? '' : '/'}${articleUrl}`;
                }
                
                console.log(`[Scrape] Fetching article: ${articleUrl}`);
                const articleResp = await fetch(articleUrl);
                
                if (articleResp.ok) {
                  const articleHtml = await articleResp.text();
                  
                  // Extract full article content
                  const contentPrompt = `Extrahuj CELÝ obsah tohoto blogového článku.

HTML:
${articleHtml.substring(0, 30000)}

Vrať JSON:
{
  "title": "Název článku",
  "date": "datum publikace",
  "author": "autor pokud je uveden",
  "content": "CELÝ text článku - všechny odstavce, body, tipy. Bez HTML tagů."
}`;

                  const contentResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: contentPrompt }] }],
                      generationConfig: { response_mime_type: "application/json" }
                    })
                  });

                  if (contentResp.ok) {
                    const contentData = await contentResp.json();
                    const articleContent = JSON.parse(contentData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
                    
                    const docId = `blog_${(articleContent.title || article.title).toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 40)}`;
                    const fullContent = `ČLÁNEK: ${articleContent.title || article.title}
${articleContent.date ? `Publikováno: ${articleContent.date}` : ''}
${articleContent.author ? `Autor: ${articleContent.author}` : ''}

${articleContent.content || article.summary || ''}

Zdroj: ${articleUrl}`;

                    const doc = {
                      id: docId,
                      title: articleContent.title || article.title,
                      content: fullContent,
                      category: 'novinka',
                      tags: ['blog', 'článek'],
                      source: 'scrape',
                      sourceUrl: articleUrl,
                      createdAt: Date.now(),
                      wordCount: fullContent.split(/\s+/).length
                    };
                    
                    await kv.set(`rag_doc_${docId}`, doc);
                    
                    const existingIdx = index.findIndex((d: any) => d.id === docId);
                    const indexEntry = { id: docId, title: doc.title, category: 'novinka', source: 'scrape', createdAt: doc.createdAt, wordCount: doc.wordCount };
                    if (existingIdx >= 0) {
                      index[existingIdx] = indexEntry;
                    } else {
                      index.push(indexEntry);
                    }
                    scrapedCount++;
                    console.log(`[Scrape] Saved article: ${doc.title} (${doc.wordCount} words)`);
                  }
                }
              } catch (articleError) {
                console.error(`[Scrape] Error fetching article ${article.link}:`, articleError);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[Scrape] Blog error:", e);
    }
    
    await kv.set('rag_document_index', index);
    await kv.set('rag_last_scrape', Date.now());
    
    return c.json({ success: true, scrapedCount, lastScrape: new Date().toISOString() });
  } catch (error: any) {
    console.error("[Scrape] Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Get RAG sync status
app.get("/make-server-954b19ad/rag/status", async (c) => {
  try {
    const index = await kv.get('rag_document_index') || [];
    const lastScrape = await kv.get('rag_last_scrape');
    const lastWebflowSync = await kv.get('rag_last_webflow_sync');
    
    const stats = {
      totalDocuments: index.length,
      byCategory: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      lastScrape: lastScrape ? new Date(lastScrape).toISOString() : null,
      lastWebflowSync: lastWebflowSync ? new Date(lastWebflowSync).toISOString() : null
    };
    
    for (const doc of index) {
      stats.byCategory[doc.category || 'unknown'] = (stats.byCategory[doc.category || 'unknown'] || 0) + 1;
      stats.bySource[doc.source || 'manual'] = (stats.bySource[doc.source || 'manual'] || 0) + 1;
    }
    
    return c.json(stats);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Reindex RAG documents with AI
app.post("/make-server-954b19ad/rag/reindex", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    if (!geminiKey) return c.json({ error: "Missing GEMINI_API_KEY_RAG" }, 500);
    
    const index = await kv.get('rag_document_index') || [];
    if (index.length === 0) {
      return c.json({ success: true, indexed: 0, message: "No documents to index" });
    }
    
    let indexedCount = 0;
    
    for (const docMeta of index) {
      try {
        const doc = await kv.get(`rag_doc_${docMeta.id}`);
        if (!doc || !doc.content) continue;
        
        // Use AI to analyze and extract metadata
        const analyzePrompt = `Analyzuj tento dokument a extrahuj metadata.

DOKUMENT:
Název: ${doc.title}
Obsah: ${doc.content.substring(0, 2000)}

Extrahuj:
1. O jaký produkt jde? (matematika, prvouka, fyzika, chemie, přírodopis, obecně vividbooks, nebo null)
2. Pro jaký stupeň? (1. stupeň, 2. stupeň, nebo null)
3. Klíčová slova (max 10)
4. Krátké shrnutí (max 2 věty)

Vrať JSON:
{
  "product": "string nebo null",
  "grade": "string nebo null",
  "keywords": ["slovo1", "slovo2"],
  "summary": "krátké shrnutí"
}`;

        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
            contents: [{ parts: [{ text: analyzePrompt }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });
        
        if (resp.ok) {
          const data = await resp.json();
          const result = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
          
          // Update document with AI metadata
          const updatedDoc = {
            ...doc,
            metadata: {
              product: result.product,
              grade: result.grade,
              keywords: result.keywords || [],
              summary: result.summary
            },
            aiIndexedAt: Date.now()
          };
          
          await kv.set(`rag_doc_${docMeta.id}`, updatedDoc);
          
          // Update index entry
          const indexIdx = index.findIndex((d: any) => d.id === docMeta.id);
          if (indexIdx >= 0) {
            index[indexIdx] = {
              ...index[indexIdx],
              product: result.product,
              grade: result.grade,
              aiSummary: result.summary
            };
          }
          
          indexedCount++;
        }
      } catch (e) {
        console.error(`[Reindex] Error for ${docMeta.id}:`, e);
      }
    }
    
    await kv.set('rag_document_index', index);
    await kv.set('rag_last_reindex', Date.now());
    
    return c.json({ success: true, indexed: indexedCount, total: index.length });
  } catch (error: any) {
    console.error("[Reindex] Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// CRM Query endpoint
app.post("/make-server-954b19ad/crm/query", async (c) => {
  try {
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");

    if (!pipedriveToken) return c.json({ error: "PIPEDRIVE_API_TOKEN not configured" }, 500);
    if (!geminiKey) return c.json({ error: "GEMINI_API_KEY_RAG not configured" }, 500);

    const { query } = await c.req.json();
    if (!query) return c.json({ error: "Query is required" }, 400);

    // Search Pipedrive
    const PIPEDRIVE_BASE = "https://api.pipedrive.com/v1";
    const searchTerm = query.replace(/najdi|školu|kontakt|číslo|na/gi, '').trim();
    
    const itemSearchResp = await fetch(
      `${PIPEDRIVE_BASE}/itemSearch?term=${encodeURIComponent(searchTerm)}&api_token=${pipedriveToken}`
    );
    const itemSearchData = await itemSearchResp.json();
    
    const items = itemSearchData.data?.items || [];
    const grouped = {
      organizations: items.filter((i: any) => i.item?.type === 'organization').map((i: any) => i.item),
      persons: items.filter((i: any) => i.item?.type === 'person').map((i: any) => i.item),
      deals: items.filter((i: any) => i.item?.type === 'deal').map((i: any) => i.item)
    };

    // Generate summary with Gemini
    const summaryPrompt = `Jsi CRM asistent. Na základě dotazu "${query}" a dat ${JSON.stringify(grouped)} vytvoř stručnou odpověď v češtině.`;
    
    const summaryResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: summaryPrompt }] }] })
    });

    let summary = "Nepodařilo se vygenerovat shrnutí.";
    if (summaryResp.ok) {
      const summaryData = await summaryResp.json();
      summary = summaryData.candidates?.[0]?.content?.parts?.[0]?.text || summary;
    }

    return c.json({ query, data: grouped, summary });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// CRM Organization Detail endpoint
app.post("/make-server-954b19ad/crm/org-detail", async (c) => {
  try {
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    if (!pipedriveToken) return c.json({ error: "PIPEDRIVE_API_TOKEN not configured" }, 500);

    const { orgId, orgName } = await c.req.json();
    if (!orgId && !orgName) return c.json({ error: "orgId or orgName required" }, 400);

    const PIPEDRIVE_BASE = "https://api.pipedrive.com/v1";
    let org: any = null;

    // If we have orgId, fetch directly
    if (orgId) {
      const orgResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${orgId}?api_token=${pipedriveToken}`);
      if (orgResp.ok) {
        const orgData = await orgResp.json();
        org = orgData.data;
      }
    } else if (orgName) {
      // Search by name
      const searchResp = await fetch(`${PIPEDRIVE_BASE}/itemSearch?term=${encodeURIComponent(orgName)}&item_types=organization&limit=1&api_token=${pipedriveToken}`);
      if (searchResp.ok) {
        const searchData = await searchResp.json();
        if (searchData.data?.items?.length > 0) {
          const foundId = searchData.data.items[0].item.id;
          const orgResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${foundId}?api_token=${pipedriveToken}`);
          if (orgResp.ok) {
            const orgData = await orgResp.json();
            org = orgData.data;
          }
        }
      }
    }

    if (!org) {
      return c.json({ error: "Organization not found" }, 404);
    }

    // Fetch persons for this org
    const personsResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${org.id}/persons?limit=50&api_token=${pipedriveToken}`);
    const personsData = await personsResp.json();
    const persons = personsData.data || [];

    // Fetch deals for this org
    const dealsResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${org.id}/deals?limit=50&api_token=${pipedriveToken}`);
    const dealsData = await dealsResp.json();
    const deals = dealsData.data || [];

    // Fetch activities for this org
    const activitiesResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${org.id}/activities?limit=50&api_token=${pipedriveToken}`);
    const activitiesData = await activitiesResp.json();
    const activities = activitiesData.data || [];

    // Uživatelé Pipedrive — jména vlastníka organizace, vlastníka dealu, přiřazeného u aktivity
    const usersResp = await fetch(`${PIPEDRIVE_BASE}/users?api_token=${pipedriveToken}`);
    const usersData = await usersResp.json();
    const userMap: Record<number, string> = {};
    for (const u of usersData.data || []) {
      if (u?.id != null) userMap[Number(u.id)] = u.name || u.email || String(u.id);
    }

    const pipedriveNumericId = (v: any): number | null => {
      if (v == null) return null;
      if (typeof v === 'object' && v !== null) {
        if ('value' in v && v.value != null && v.value !== '') return Number(v.value);
        if ('id' in v && v.id != null && v.id !== '') return Number(v.id);
      }
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const orgOwnerId = pipedriveNumericId(org.owner_id);
    const orgOwnerNameEmbed =
      org.owner_id && typeof org.owner_id === 'object' && (org.owner_id as { name?: string }).name
        ? String((org.owner_id as { name: string }).name)
        : null;
    const orgWithOwner = {
      ...org,
      owner_name: orgOwnerNameEmbed ?? (orgOwnerId != null ? userMap[orgOwnerId] ?? null : null),
    };

    // Get deal field definitions for custom field mapping
    const dealFieldsResp = await fetch(`${PIPEDRIVE_BASE}/dealFields?api_token=${pipedriveToken}`);
    const dealFieldsData = await dealFieldsResp.json();
    const dealFields = dealFieldsData.data || [];

    const dealFieldMap: Record<string, { name: string; options: Record<string, string> }> = {};
    for (const field of dealFields) {
      if (field.key && field.name) {
        const optionsMap: Record<string, string> = {};
        if (field.options && Array.isArray(field.options)) {
          for (const opt of field.options) {
            if (opt.id !== undefined && opt.label) {
              optionsMap[String(opt.id)] = opt.label;
            }
          }
        }
        dealFieldMap[field.key] = { name: field.name, options: optionsMap };
      }
    }

    // Get field definitions for custom field mapping
    const personFieldsResp = await fetch(`${PIPEDRIVE_BASE}/personFields?api_token=${pipedriveToken}`);
    const personFieldsData = await personFieldsResp.json();
    const personFields = personFieldsData.data || [];

    // Map custom field IDs to labels and options for persons
    const fieldMap: Record<string, { name: string; options: Record<string, string> }> = {};
    for (const field of personFields) {
      if (field.key && field.name) {
        const optionsMap: Record<string, string> = {};
        // Build options map if field has options (enum/set fields)
        if (field.options && Array.isArray(field.options)) {
          for (const opt of field.options) {
            if (opt.id !== undefined && opt.label) {
              optionsMap[String(opt.id)] = opt.label;
            }
          }
        }
        fieldMap[field.key] = { name: field.name, options: optionsMap };
      }
    }

    // Helper to resolve option value to label
    const resolveValue = (fieldKey: string, value: any): string | string[] => {
      const fieldDef = fieldMap[fieldKey];
      if (!fieldDef) return value;
      
      // Handle comma-separated values (multiple select)
      if (typeof value === 'string' && value.includes(',')) {
        const ids = value.split(',').map(v => v.trim());
        return ids.map(id => fieldDef.options[id] || id);
      }
      
      // Handle single value
      const strVal = String(value);
      return fieldDef.options[strVal] || value;
    };

    // Enhance persons with mapped custom fields
    const enhancedPersons = persons.map((p: any) => {
      const customFields: Record<string, any> = {};
      for (const [key, value] of Object.entries(p)) {
        if (key.match(/^[a-f0-9]{40}$/) && value) {
          const fieldDef = fieldMap[key];
          const fieldName = fieldDef?.name || key;
          const resolvedValue = resolveValue(key, value);
          customFields[fieldName] = resolvedValue;
        }
      }
      return { ...p, customFields };
    });

    // Přístupové kódy učitel/žák — vlastní pole organizace (viz admin school-pipedrive-check)
    const orgFieldsResp = await fetch(`${PIPEDRIVE_BASE}/organizationFields?api_token=${pipedriveToken}`);
    const orgFieldsData = await orgFieldsResp.json();
    const orgFieldsRaw = orgFieldsData.data || [];
    const orgFieldMap: Record<string, { name: string; options: Record<string, string> }> = {};
    for (const field of orgFieldsRaw) {
      if (field.key && field.name) {
        const optionsMap: Record<string, string> = {};
        if (field.options && Array.isArray(field.options)) {
          for (const opt of field.options) {
            if (opt.id !== undefined && opt.label) {
              optionsMap[String(opt.id)] = opt.label;
            }
          }
        }
        orgFieldMap[field.key] = { name: field.name, options: optionsMap };
      }
    }

    const removeDiacritics = (s: string) =>
      s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

    const mapOrgCustomFields = (
      record: Record<string, unknown>,
      m: Record<string, { name: string; options: Record<string, string> }>,
    ) => {
      const customFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (!/^[a-f0-9]{40}$/.test(key) || value == null || value === '') continue;
        const fieldDef = m[key];
        const fieldName = fieldDef?.name || key;
        let resolvedValue: unknown = value;
        if (fieldDef) {
          if (typeof value === 'string' && value.includes(',')) {
            const ids = value.split(',').map((v) => v.trim());
            resolvedValue = ids.map((id) => fieldDef.options[id] || id);
          } else {
            const strVal = String(value);
            resolvedValue = fieldDef.options[strVal] || value;
          }
        }
        customFields[fieldName] = resolvedValue;
      }
      return customFields;
    };

    const pickOrgFieldValue = (customFields: Record<string, unknown>, nameHints: string[]) => {
      const normalizedHints = nameHints.map((hint) => removeDiacritics(hint));
      for (const [key, value] of Object.entries(customFields)) {
        const normalizedKey = removeDiacritics(key);
        if (normalizedHints.some((hint) => normalizedKey.includes(hint))) return value;
      }
      return undefined;
    };

    const organizationCustomFields = mapOrgCustomFields(org, orgFieldMap);
    const pickStr = (v: unknown): string => {
      if (v == null) return '';
      if (Array.isArray(v)) return String(v[0] ?? '').trim();
      return String(v).trim();
    };

    const pickStrFlexible = (v: unknown): string => {
      if (v == null) return '';
      if (Array.isArray(v)) {
        return v.map((x) => String(x).trim()).filter(Boolean).join(', ');
      }
      return String(v).trim();
    };

    /** Hodnota vypadá jako přístupový kód (ne e-mail, ne dlouhá věta). */
    const looksLikeAccessCode = (s: string): boolean => {
      const t = s.trim();
      if (t.length < 3 || t.length > 96) return false;
      if (/@|http|www\.|^\d{1,2}[./]\d/.test(t)) return false;
      return /^[A-Za-z0-9\-_.]+$/.test(t);
    };

    const scoreTeacherFieldName = (nk: string): number => {
      if (/pocet|počet|celkem|total|statist|sum|number|cislo|číslo|email|mail|@|telefon|phone|www|http|ico|dic|adresa|address/.test(nk)) {
        return -10;
      }
      let s = 0;
      if (/ucitel|učitel|teacher|pedagog|vyucuj|vyučuj/.test(nk)) s += 8;
      if (/kod|code|pristup|access|login|heslo|password|token|pin|klíč|klic/.test(nk)) s += 5;
      if (/trial/.test(nk) && /(teacher|ucitel|učitel)/.test(nk)) s += 14;
      if (/zak|student|ziak|zák|pupil|dite|děti/.test(nk) && !/ucitel|učitel|teacher/.test(nk)) s -= 12;
      return s;
    };

    const scoreStudentFieldName = (nk: string): number => {
      if (/pocet|počet|celkem|total|statist|sum|email|mail|@|telefon|phone|www|http/.test(nk)) return -10;
      let s = 0;
      if (/zak|student|ziak|zák|pupil|dite|děti|ziaci|žáci/.test(nk)) s += 8;
      if (/kod|code|pristup|access|login|heslo|password|token|pin|klíč|klic/.test(nk)) s += 5;
      if (/trial/.test(nk) && /(student|zak|ziak|zák)/.test(nk)) s += 14;
      if (/ucitel|učitel|teacher|pedagog/.test(nk) && !/(zak|student|ziak|zák)/.test(nk)) s -= 12;
      return s;
    };

    const pickBestCodeFromFields = (
      fields: Record<string, unknown>,
      scoreFn: (nk: string) => number,
    ): string | undefined => {
      let best: { val: string; score: number } | null = null;
      for (const [key, value] of Object.entries(fields)) {
        const val = pickStrFlexible(value);
        if (!val || !looksLikeAccessCode(val)) continue;
        const nk = removeDiacritics(key);
        const sc = scoreFn(nk);
        if (sc <= 0) continue;
        if (!best || sc > best.score || (sc === best.score && val.length > best.val.length)) {
          best = { val, score: sc };
        }
      }
      return best?.val;
    };

    const teacherHintsWide = [
      'kod ucitel',
      'kod učitel',
      'kod ucitele',
      'kód učitel',
      'kod pro ucitele',
      'teacher code',
      'teachercode',
      'trial teacher',
      'access teacher',
      'pristup ucitel',
      'ucitel kod',
      'učitel kód',
      'helix',
      'vividbooks ucitel',
    ];
    const studentHintsWide = [
      'kod zak',
      'kod žák',
      'kod zaka',
      'kod student',
      'student code',
      'studentcode',
      'trial student',
      'access student',
      'pristup zak',
      'zak kod',
      'žiák kód',
      'vividbooks student',
    ];

    const collectTokensFromOrgFields = (
      fields: Record<string, unknown>,
      keyTest: (nk: string) => boolean,
    ): string[] => {
      const out: string[] = [];
      for (const [key, value] of Object.entries(fields)) {
        const nk = removeDiacritics(key);
        if (!keyTest(nk)) continue;
        const raw = pickStrFlexible(value);
        if (!raw) continue;
        for (const part of raw.split(/[,;\n|]/).map((x) => x.trim()).filter(Boolean)) {
          if (part.length > 1 && part.length < 200) out.push(part);
        }
      }
      return out;
    };

    const subjectLikeKeys = (nk: string) =>
      /(purchased|predmet|predmety|předmět|subject|produkty|objedn|licence|license|vivid|skupina|balik|balíček|sluzby|služby)/.test(
        nk,
      );
    const categoryLikeKeys = (nk: string) =>
      /(kategorie|kategoria|category|segment|typ zakaznik|typ zákazník|obor)/.test(nk);

    const productNamesFromOrg = collectTokensFromOrgFields(organizationCustomFields, subjectLikeKeys);
    const productCategoriesFromOrg = collectTokensFromOrgFields(organizationCustomFields, categoryLikeKeys);

    const dealsWithProducts = await Promise.all(
      deals.map(async (d: any) => {
        const customFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(d)) {
          if (key.match(/^[a-f0-9]{40}$/) && value) {
            const fieldDef = dealFieldMap[key];
            const fieldName = fieldDef?.name || key;

            let resolvedValue = value;
            if (fieldDef) {
              if (typeof value === 'string' && value.includes(',')) {
                const ids = value.split(',').map((v: string) => v.trim());
                resolvedValue = ids.map((id: string) => fieldDef.options[id] || id);
              } else {
                const strVal = String(value);
                resolvedValue = fieldDef.options[strVal] || value;
              }
            }
            customFields[fieldName] = resolvedValue;
          }
        }

        let products: Array<{ name: string; quantity: number | null }> = [];
        const did = pipedriveNumericId(d.id);
        if (did != null) {
          try {
            const pr = await fetch(
              `${PIPEDRIVE_BASE}/deals/${did}/products?limit=100&api_token=${pipedriveToken}`,
            );
            if (pr.ok) {
              const pj = await pr.json();
              products = (pj.data || [])
                .map((item: any) => ({
                  name: String(item?.name || '').trim(),
                  quantity: Number(item?.quantity) || null,
                }))
                .filter((x: { name: string }) => Boolean(x.name));
            }
          } catch {
            /* ignore */
          }
        }

        const dealOwnerId = pipedriveNumericId(d.user_id);
        const ownerNameFromEmbed =
          d.user_id && typeof d.user_id === 'object' && (d.user_id as { name?: string }).name
            ? String((d.user_id as { name: string }).name)
            : null;
        return {
          ...d,
          customFields,
          products,
          owner_name: ownerNameFromEmbed ?? (dealOwnerId != null ? userMap[dealOwnerId] ?? null : null),
          statusColor: d.status === 'won' ? 'green' : d.status === 'lost' ? 'red' : 'yellow',
        };
      }),
    );

    /** Nejdřív kódy z dealů (vyhrané první), pak doplnění z organizace a kontaktů. */
    let teacherCode: string | undefined;
    let studentCode: string | undefined;

    /** Kódy a předměty často žijí ve vlastních polích dealu (např. TRIAL – TEACHER CODE, PURCHASED SUBJECT). */
    const dealsOrdered = [...dealsWithProducts].sort((a: any, b: any) => {
      const rank = (s: string) => (s === 'won' ? 3 : s === 'open' ? 2 : s === 'lost' ? 0 : 1);
      const dr = rank(String(a.status || '')) - rank(String(b.status || ''));
      if (dr !== 0) return -dr;
      return String(b.won_time || b.add_time || '').localeCompare(String(a.won_time || a.add_time || ''));
    });

    for (const row of dealsOrdered) {
      const cf = row.customFields as Record<string, unknown> | undefined;
      if (!cf || typeof cf !== 'object') continue;
      if (!teacherCode) {
        const t =
          pickBestCodeFromFields(cf, scoreTeacherFieldName) ||
          pickStr(pickOrgFieldValue(cf, teacherHintsWide)) ||
          undefined;
        if (t) teacherCode = t;
      }
      if (!studentCode) {
        const t =
          pickBestCodeFromFields(cf, scoreStudentFieldName) ||
          pickStr(pickOrgFieldValue(cf, studentHintsWide)) ||
          undefined;
        if (t) studentCode = t;
      }
      if (teacherCode && studentCode) break;
    }

    if (!teacherCode) {
      teacherCode =
        pickBestCodeFromFields(organizationCustomFields, scoreTeacherFieldName) ||
        pickStr(pickOrgFieldValue(organizationCustomFields, teacherHintsWide)) ||
        undefined;
    }
    if (!studentCode) {
      studentCode =
        pickBestCodeFromFields(organizationCustomFields, scoreStudentFieldName) ||
        pickStr(pickOrgFieldValue(organizationCustomFields, studentHintsWide)) ||
        undefined;
    }
    if (!teacherCode || !studentCode) {
      for (const p of enhancedPersons) {
        const cf = (p as { customFields?: Record<string, unknown> }).customFields;
        if (!cf) continue;
        if (!teacherCode) {
          teacherCode =
            pickBestCodeFromFields(cf, scoreTeacherFieldName) ||
            pickStr(pickOrgFieldValue(cf, teacherHintsWide)) ||
            teacherCode;
        }
        if (!studentCode) {
          studentCode =
            pickBestCodeFromFields(cf, scoreStudentFieldName) ||
            pickStr(pickOrgFieldValue(cf, studentHintsWide)) ||
            studentCode;
        }
        if (teacherCode && studentCode) break;
      }
    }

    const productNamesFromDeals = new Set<string>();
    const subjectHintsFromDeals: string[] = [];
    const categoryHintsFromDeals: string[] = [];
    for (const row of dealsWithProducts) {
      for (const p of row.products || []) {
        if (p.name) productNamesFromDeals.add(p.name);
      }
      const cf = row.customFields as Record<string, unknown> | undefined;
      if (cf && typeof cf === 'object') {
        subjectHintsFromDeals.push(...collectTokensFromOrgFields(cf, subjectLikeKeys));
        categoryHintsFromDeals.push(...collectTokensFromOrgFields(cf, categoryLikeKeys));
      }
    }

    const purchasedSubjects = Array.from(
      new Set([...productNamesFromDeals, ...productNamesFromOrg, ...subjectHintsFromDeals]),
    ).sort((a, b) => a.localeCompare(b, 'cs'));
    const productCategories = Array.from(
      new Set([...productCategoriesFromOrg, ...categoryHintsFromDeals]),
    ).sort((a, b) => a.localeCompare(b, 'cs'));

    return c.json({
      organization: orgWithOwner,
      persons: enhancedPersons,
      deals: dealsWithProducts,
      activities: activities.map((a: any) => {
        const aid = pipedriveNumericId(a.user_id);
        const nameFromEmbed =
          a.user_id && typeof a.user_id === 'object' && (a.user_id as { name?: string }).name
            ? String((a.user_id as { name: string }).name)
            : null;
        return {
          ...a,
          user_name: nameFromEmbed ?? (aid != null ? userMap[aid] ?? null : null),
        };
      }),
      summary: `${org.name}: ${enhancedPersons.length} kontaktů, ${deals.length} dealů`,
      teacherCode,
      studentCode,
      purchasedSubjects,
      productCategories,
    });

  } catch (error: any) {
    console.error('[CRM] Org detail error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get all organizations with active subscriptions (won deals) for map display
app.get("/make-server-954b19ad/crm/active-schools", async (c) => {
  try {
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    if (!pipedriveToken) return c.json({ error: "PIPEDRIVE_API_TOKEN not configured" }, 500);

    const PIPEDRIVE_BASE = "https://api.pipedrive.com/v1";
    
    // Get all won deals
    const dealsResp = await fetch(
      `${PIPEDRIVE_BASE}/deals?status=won&limit=500&api_token=${pipedriveToken}`
    );
    
    if (!dealsResp.ok) {
      const errText = await dealsResp.text();
      console.error('[ActiveSchools] Deals fetch failed:', dealsResp.status, errText);
      return c.json({ error: "Failed to fetch deals", status: dealsResp.status }, 500);
    }
    
    const dealsData = await dealsResp.json();
    const wonDeals = dealsData.data || [];
    
    console.log('[ActiveSchools] Won deals count:', wonDeals.length);
    if (wonDeals.length > 0) {
      console.log('[ActiveSchools] Sample deal:', JSON.stringify(wonDeals[0]).substring(0, 500));
    }
    
    // Get unique organization IDs from won deals - try both org_id and org_id.value
    const orgIds = [...new Set(wonDeals.map((d: any) => {
      // Pipedrive sometimes returns org_id as object with id, sometimes as number
      if (typeof d.org_id === 'object' && d.org_id?.value) return d.org_id.value;
      if (typeof d.org_id === 'number') return d.org_id;
      return null;
    }).filter(Boolean))];
    
    console.log('[ActiveSchools] Unique org IDs:', orgIds.length, orgIds.slice(0, 10));
    
    // Fetch organization details with addresses
    const organizations: any[] = [];
    
    for (const orgId of orgIds) {
      try {
        const orgResp = await fetch(
          `${PIPEDRIVE_BASE}/organizations/${orgId}?api_token=${pipedriveToken}`
        );
        
        if (orgResp.ok) {
          const orgData = await orgResp.json();
          const org = orgData.data;
          
          if (org) {
            // Get deals for this org to calculate total value
            const orgDeals = wonDeals.filter((d: any) => {
              const dealOrgId = typeof d.org_id === 'object' ? d.org_id?.value : d.org_id;
              return dealOrgId === orgId;
            });
            const totalValue = orgDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
            
            console.log('[ActiveSchools] Org:', org.id, org.name, 'address:', org.address, 'lat:', org.address_lat);
            
            organizations.push({
              id: org.id,
              name: org.name,
              address: org.address || null,
              address_formatted_address: org.address_formatted_address || null,
              address_lat: org.address_lat || null,
              address_lng: org.address_long || null,
              wonDealsCount: orgDeals.length,
              totalValue,
              currency: orgDeals[0]?.currency || 'CZK',
              // Include deal titles for popup
              dealTitles: orgDeals.map((d: any) => d.title).slice(0, 5)
            });
          }
        }
      } catch (e) {
        console.error(`Failed to fetch org ${orgId}:`, e);
      }
    }
    
    console.log('[ActiveSchools] Total organizations fetched:', organizations.length);
    
    // Geocode addresses that don't have coordinates - do in parallel batches
    const geocodeAddress = async (address: string): Promise<{lat: number, lng: number} | null> => {
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=cz`,
          { headers: { 'User-Agent': 'VividAssistant/1.0' } }
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data.length > 0) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          }
        }
      } catch (e) {
        console.error('Geocoding error for', address, e);
      }
      return null;
    };
    
    // Geocode in parallel batches of 10
    const BATCH_SIZE = 10;
    const orgsToGeocode = organizations.filter(org => !org.address_lat && (org.address || org.address_formatted_address));
    console.log('[ActiveSchools] Schools needing geocoding:', orgsToGeocode.length);
    
    for (let i = 0; i < Math.min(orgsToGeocode.length, 100); i += BATCH_SIZE) { // Limit to first 100
      const batch = orgsToGeocode.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (org) => {
          const address = org.address_formatted_address || org.address;
          const coords = await geocodeAddress(address);
          return { orgId: org.id, coords };
        })
      );
      
      // Update organizations with geocoded coordinates
      for (const result of results) {
        if (result.coords) {
          const org = organizations.find(o => o.id === result.orgId);
          if (org) {
            org.address_lat = result.coords.lat;
            org.address_lng = result.coords.lng;
          }
        }
      }
      
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < Math.min(orgsToGeocode.length, 100)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const schoolsWithCoords = organizations.filter(org => org.address_lat && org.address_lng);
    console.log('[ActiveSchools] Schools with coordinates after geocoding:', schoolsWithCoords.length);
    
    return c.json({
      success: true,
      totalCount: organizations.length,
      schools: organizations,
      debug: {
        wonDealsCount: wonDeals.length,
        uniqueOrgIds: orgIds.length,
        geocodedCount: schoolsWithCoords.length
      }
    });
    
  } catch (error: any) {
    console.error('[CRM] Active schools error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Test Google Maps geocoding
app.get("/make-server-954b19ad/crm/test-geocode", async (c) => {
  try {
    const googleMapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const address = c.req.query("address") || "Palackého 535, Česká Kamenice";
    
    if (!googleMapsKey) {
      return c.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, 500);
    }
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsKey}&region=cz`;
    console.log('[TestGeocode] URL:', url.replace(googleMapsKey, 'KEY_HIDDEN'));
    
    const resp = await fetch(url);
    const data = await resp.json();
    
    return c.json({
      success: true,
      input: address,
      status: data.status,
      error_message: data.error_message,
      results: data.results?.length || 0,
      location: data.results?.[0]?.geometry?.location || null
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get cached school locations for map (fast endpoint)
app.get("/make-server-954b19ad/crm/school-locations", async (c) => {
  try {
    const cached = await kv.get("school_locations_cache");
    if (cached) {
      return c.json({ success: true, ...cached, fromCache: true });
    }
    return c.json({ success: true, schools: [], totalCount: 0, fromCache: false });
  } catch (error: any) {
    console.error('[CRM] School locations error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Build school cache - INCREMENTAL version with pagination tracking
// Build school cache - INCREMENTAL version with pagination tracking
app.post("/make-server-954b19ad/crm/build-school-cache", async (c) => {
  try {
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    
    if (!pipedriveToken) return c.json({ error: "PIPEDRIVE_API_TOKEN not configured" }, 500);

    const PIPEDRIVE_BASE = "https://api.pipedrive.com/v1";
    
    // Load existing cache and pagination state
    const existingCache = await kv.get("school_locations_cache") || { schools: [] };
    const existingSchools = existingCache.schools || [];
    const existingIds = new Set(existingSchools.map((s: any) => s.id));
    
    // Load pagination state (where we left off)
    const paginationState = await kv.get("school_cache_pagination") || { start: 0 };
    let pipedriveStart = paginationState.start || 0;
    
    console.log('[BuildCache] Existing:', existingSchools.length, 'Pipedrive start:', pipedriveStart);
    
    // Get ONE batch of organizations (200 max)
    const limit = 200;
    const orgsResp = await fetch(
      `${PIPEDRIVE_BASE}/organizations?start=${pipedriveStart}&limit=${limit}&api_token=${pipedriveToken}`
    );
    
    if (!orgsResp.ok) {
      return c.json({ error: "Failed to fetch organizations" }, 500);
    }
    
    const orgsData = await orgsResp.json();
    const orgs = orgsData.data || [];
    const hasMore = orgsData.additional_data?.pagination?.more_items_in_collection || false;
    
    console.log('[BuildCache] Fetched orgs:', orgs.length, 'HasMore:', hasMore);
    
    // Get ALL won deals (with pagination to get more than 500)
    let wonOrgIds = new Set();
    let openOrgIds = new Set();
    
    // Fetch won deals
    let dealsStart = 0;
    const dealsLimit = 500;
    while (true) {
      const dealsResp = await fetch(
        `${PIPEDRIVE_BASE}/deals?status=won&start=${dealsStart}&limit=${dealsLimit}&api_token=${pipedriveToken}`
      );
      if (!dealsResp.ok) break;
      const dealsData = await dealsResp.json();
      const batch = dealsData.data || [];
      batch.forEach((d: any) => {
        const id = typeof d.org_id === 'object' ? d.org_id?.value : d.org_id;
        if (id) wonOrgIds.add(id);
      });
      if (!dealsData.additional_data?.pagination?.more_items_in_collection) break;
      dealsStart += dealsLimit;
    }

    // Fetch open deals
    dealsStart = 0;
    while (true) {
      const dealsResp = await fetch(
        `${PIPEDRIVE_BASE}/deals?status=open&start=${dealsStart}&limit=${dealsLimit}&api_token=${pipedriveToken}`
      );
      if (!dealsResp.ok) break;
      const dealsData = await dealsResp.json();
      const batch = dealsData.data || [];
      batch.forEach((d: any) => {
        const id = typeof d.org_id === 'object' ? d.org_id?.value : d.org_id;
        if (id) openOrgIds.add(id);
      });
      if (!dealsData.additional_data?.pagination?.more_items_in_collection) break;
      dealsStart += dealsLimit;
    }
    
    console.log('[BuildCache] Won:', wonOrgIds.size, 'Open:', openOrgIds.size);
    
    // Filter orgs that need geocoding
    const orgsToGeocode = orgs.filter((org: any) => 
      !existingIds.has(org.id) && org.address
    );
    
    console.log('[BuildCache] Orgs to geocode this batch:', orgsToGeocode.length);
    
    // Geocode this batch in parallel
    const newSchools: any[] = [];
    let geocodedCount = 0;
    let failedCount = 0;
    
    // Process in parallel batches of 10
    const PARALLEL_SIZE = 10;
    for (let i = 0; i < orgsToGeocode.length; i += PARALLEL_SIZE) {
      const batch = orgsToGeocode.slice(i, i + PARALLEL_SIZE);
      
      const results = await Promise.all(batch.map(async (org: any) => {
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(org.address)}&limit=1&countrycodes=cz`,
            { headers: { 'User-Agent': 'VividAssistant/1.0' } }
          );
          if (resp.ok) {
            const data = await resp.json();
            if (data.length > 0) {
              return {
                id: org.id,
                name: org.name,
                address: org.address,
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                isActive: wonOrgIds.has(org.id) || org.label === 12 || org.label === '12',
                isOpen: openOrgIds.has(org.id)
              };
            }
          }
        } catch (e) {
          // ignore
        }
        return null;
      }));
      
      for (const r of results) {
        if (r) {
          geocodedCount++;
          newSchools.push(r);
        } else {
          failedCount++;
        }
      }
      
      if (i + PARALLEL_SIZE < orgsToGeocode.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Merge with existing
    const allSchools = [...existingSchools, ...newSchools];
    
    // Update status for all schools using BOTH won deals and labels from the current batch
    const currentBatchLabels = new Map(orgs.map((o: any) => [o.id, o.label]));
    
    for (const school of allSchools) {
      const label = currentBatchLabels.get(school.id);
      const isCustomerLabel = label === 12 || label === '12'; 
      school.isActive = wonOrgIds.has(school.id) || isCustomerLabel || school.isActive;
      school.isOpen = openOrgIds.has(school.id);
    }
    
    console.log('[BuildCache] Total schools:', allSchools.length, 'New:', geocodedCount);
    
    // Save cache
    const cacheData = {
      schools: allSchools,
      totalCount: allSchools.length,
      activeCount: allSchools.filter((s: any) => s.isActive).length,
      openCount: allSchools.filter((s: any) => s.isOpen).length,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set("school_locations_cache", cacheData);
    
    // Update pagination state
    if (hasMore) {
      await kv.set("school_cache_pagination", { start: pipedriveStart + limit });
    } else {
      await kv.set("school_cache_pagination", { start: 0, completedAt: new Date().toISOString() });
    }
    
    return c.json({ 
      success: true,
      ...cacheData,
      debug: {
        batchStart: pipedriveStart,
        batchSize: orgs.length,
        newlyGeocoded: geocodedCount,
        failed: failedCount,
        hasMore: hasMore,
        complete: !hasMore,
        sampleLabels: orgs.slice(0, 5).map((o: any) => ({ id: o.id, name: o.name, label: o.label }))
      }
    });
    
  } catch (error: any) {
    console.error('[CRM] Build cache error:', error);
    return c.json({ error: error.message }, 500);
  }
});


// Gmail endpoints
app.post("/make-server-954b19ad/gmail/messages", async (c) => {
  try {
    const { googleAccessToken, maxResults = 10, query = "" } = await c.req.json();

    if (!googleAccessToken) {
      return c.json({ error: "google_auth_required" }, 403);
    }

    const q = query || "in:inbox";
    const listResp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${googleAccessToken}` } }
    );

    if (!listResp.ok) {
      return c.json({ error: "Gmail API error" }, 500);
    }

    const listData = await listResp.json();
    const messageIds = listData.messages || [];

    const messages = await Promise.all(
      messageIds.slice(0, maxResults).map(async (msg: { id: string }) => {
        const msgResp = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${googleAccessToken}` } }
        );
        if (!msgResp.ok) return null;
        const msgData = await msgResp.json();
        const headers = msgData.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || "";
        return {
          id: msgData.id,
          snippet: msgData.snippet,
          from: getHeader("From"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          isUnread: msgData.labelIds?.includes("UNREAD") || false
        };
      })
    );

    return c.json({ messages: messages.filter(Boolean), totalMessages: listData.resultSizeEstimate || 0 });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-954b19ad/gmail/send", async (c) => {
  try {
    const { googleAccessToken, to, subject, body } = await c.req.json();

    if (!googleAccessToken) return c.json({ error: "google_auth_required" }, 403);
    if (!to || !subject || !body) return c.json({ error: "Missing required fields" }, 400);

    const email = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=utf-8', '', body].join('\r\n');
    const encodedEmail = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const sendResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${googleAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: encodedEmail })
    });

    if (!sendResp.ok) {
      const err = await sendResp.text();
      return c.json({ error: "Failed to send email", details: err }, 500);
    }

    const result = await sendResp.json();
    return c.json({ success: true, messageId: result.id });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// MULTI-AGENT ROUTE PLANNER
// ============================================
app.post("/make-server-954b19ad/agent/route-planner", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    
    if (!geminiKey || !mapsKey || !pipedriveToken) {
      return c.json({ error: "Missing API keys" }, 500);
    }

    const { origin, destination, radius = 30 } = await c.req.json();
    
    if (!origin || !destination) {
      return c.json({ error: "Missing origin or destination" }, 400);
    }

    const steps: any[] = [];
    const PIPEDRIVE_BASE = "https://api.pipedrive.com/v1";

    // ========== AGENT 1: Route Planning ==========
    steps.push({ agent: "Route Planner", status: "running", message: `Plánuji trasu ${origin} → ${destination}...` });
    
    // Get route from Google Routes API
    const routeResp = await fetch(
      `https://routes.googleapis.com/directions/v2:computeRoutes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': mapsKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.steps.navigationInstruction,routes.legs.steps.startLocation,routes.legs.steps.endLocation'
        },
        body: JSON.stringify({
          origin: { address: origin },
          destination: { address: destination },
          travelMode: "DRIVE",
          languageCode: "cs"
        })
      }
    );

    let routeData: any = null;
    let routePoints: { lat: number; lng: number }[] = [];
    
    if (routeResp.ok) {
      routeData = await routeResp.json();
      const route = routeData.routes?.[0];
      
      if (route?.legs?.[0]?.steps) {
        // Extract waypoints from route steps
        for (const step of route.legs[0].steps) {
          if (step.startLocation?.latLng) {
            routePoints.push({
              lat: step.startLocation.latLng.latitude,
              lng: step.startLocation.latLng.longitude
            });
          }
        }
      }
      
      const durationMinutes = Math.round((route?.duration?.replace('s', '') || 0) / 60);
      const distanceKm = Math.round((route?.distanceMeters || 0) / 1000);
      
      steps[0] = { 
        agent: "Route Planner", 
        status: "done", 
        message: `Trasa nalezena: ${distanceKm} km, ~${durationMinutes} min`,
        data: { distance: distanceKm, duration: durationMinutes, waypoints: routePoints.length }
      };
    } else {
      steps[0] = { agent: "Route Planner", status: "error", message: "Nepodařilo se najít trasu" };
    }

    // ========== AGENT 2: Location Discovery ==========
    steps.push({ agent: "Location Discovery", status: "running", message: `Hledám města v okruhu ${radius}km od trasy...` });
    
    // Use Gemini to identify towns along the route - STRICT: only towns ON the route
    const locationPrompt = `Jsem na cestě z "${origin}" do "${destination}" autem v Česku.

DŮLEŽITÉ: Chci POUZE města a vesnice, kterými PŘÍMO PROJEDU na hlavní silnici (D1, E55, silnice I. třídy).
NEZAHRNUJ města mimo trasu, i když jsou blízko!

Příklad správné trasy Praha → Sedlčany:
- Praha → Zbraslav → Davle → Štěchovice → Neveklov → Sedlčany
ŠPATNĚ by bylo zahrnout: Suchdol, Černošice, Dobříš (ty jsou mimo hlavní trasu)

Vrať POUZE JSON pole měst v pořadí jak na ně narazím:
["${origin}", "Město2", "Město3", ..., "${destination}"]

MAX 10-15 měst, pouze ta na hlavní silnici.`;

    const locResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: locationPrompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });
    
    let locations: string[] = [];
    if (locResp.ok) {
      const locData = await locResp.json();
      const locText = locData.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      try {
        locations = JSON.parse(locText);
      } catch {
        locations = [];
      }
    }

    steps[1] = { 
      agent: "Location Discovery", 
      status: "done", 
      message: `Nalezeno ${locations.length} měst/vesnic`,
      data: { locations }
    };

    // ========== AGENT 3: CRM Search ==========
    steps.push({ agent: "CRM Search", status: "running", message: `Prohledávám Pipedrive pro ${locations.length} lokalit...` });
    
    const allOrgs: any[] = [];
    const allPersons: any[] = [];
    const allDeals: any[] = [];
    const locationMatches: { [key: string]: { orgs: any[], deals: any[] } } = {};

    // Search Pipedrive for each location
    for (const location of locations.slice(0, 20)) { // Limit to 20 to avoid rate limits
      const searchResp = await fetch(
        `${PIPEDRIVE_BASE}/itemSearch?term=${encodeURIComponent(location)}&item_types=organization,person,deal&api_token=${pipedriveToken}&limit=20`
      );
      
      if (searchResp.ok) {
        const searchData = await searchResp.json();
        const items = searchData.data?.items || [];
        
        const orgs = items.filter((i: any) => i.item?.type === 'organization').map((i: any) => ({ ...i.item, matchedLocation: location }));
        const persons = items.filter((i: any) => i.item?.type === 'person').map((i: any) => ({ ...i.item, matchedLocation: location }));
        const deals = items.filter((i: any) => i.item?.type === 'deal').map((i: any) => ({ ...i.item, matchedLocation: location }));
        
        // Avoid duplicates
        for (const org of orgs) {
          if (!allOrgs.find(o => o.id === org.id)) allOrgs.push(org);
        }
        for (const person of persons) {
          if (!allPersons.find(p => p.id === person.id)) allPersons.push(person);
        }
        for (const deal of deals) {
          if (!allDeals.find(d => d.id === deal.id)) allDeals.push(deal);
        }
        
        if (orgs.length > 0 || deals.length > 0) {
          locationMatches[location] = { orgs, deals };
        }
      }
    }

    // Sort deals: WON first
    allDeals.sort((a: any, b: any) => {
      const statusOrder = { won: 0, open: 1, lost: 2 };
      return (statusOrder[a.status as keyof typeof statusOrder] ?? 3) - (statusOrder[b.status as keyof typeof statusOrder] ?? 3);
    });

    // Enrich deals with contact phone numbers (first 15 deals only to avoid rate limits)
    for (const deal of allDeals.slice(0, 15)) {
      if (deal.person?.id && !deal.person.phone) {
        try {
          const personResp = await fetch(`${PIPEDRIVE_BASE}/persons/${deal.person.id}?api_token=${pipedriveToken}`);
          if (personResp.ok) {
            const personData = await personResp.json();
            if (personData.data) {
              deal.person.phone = personData.data.phone?.[0]?.value || personData.data.primary_phone || null;
              deal.person.email = personData.data.email?.[0]?.value || personData.data.primary_email || null;
            }
          }
        } catch (e) {
          console.error(`Failed to fetch person ${deal.person.id}:`, e);
        }
      }
    }

    steps[2] = { 
      agent: "CRM Search", 
      status: "done", 
      message: `Nalezeno: ${allOrgs.length} organizací, ${allPersons.length} kontaktů, ${allDeals.length} dealů`,
      data: { 
        organizations: allOrgs.length, 
        persons: allPersons.length, 
        deals: allDeals.length,
        locationsWithMatches: Object.keys(locationMatches)
      }
    };

    // ========== AGENT 4: Analysis & Recommendations ==========
    steps.push({ agent: "Analysis", status: "running", message: "Analyzuji a připravuji doporučení..." });

    const wonDeals = allDeals.filter(d => d.status === 'won');
    const openDeals = allDeals.filter(d => d.status === 'open');

    // Get more details for organizations with won deals
    const priorityOrgs: any[] = [];
    const orgIdsWithWonDeals = [...new Set(wonDeals.map(d => d.organization?.id).filter(Boolean))];
    
    for (const orgId of orgIdsWithWonDeals.slice(0, 5)) {
      const detailResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${orgId}?api_token=${pipedriveToken}`);
      if (detailResp.ok) {
        const detailData = await detailResp.json();
        if (detailData.data) {
          priorityOrgs.push({
            ...detailData.data,
            wonDealsCount: wonDeals.filter(d => d.organization?.id === orgId).length
          });
        }
      }
    }

    // Generate recommendation with Gemini - TWO versions: full + voice summary
    const analysisPrompt = `Analyzuj tyto CRM data pro cestu z ${origin} do ${destination}:

LOKALITY S NÁLEZY: ${Object.keys(locationMatches).join(', ')}

VYHRÁNÉ DEALY (${wonDeals.length}):
${wonDeals.slice(0, 10).map(d => `- ${d.title} (${d.organization?.name || 'bez org'}, ${d.matchedLocation})`).join('\n')}

OTEVŘENÉ DEALY (${openDeals.length}):
${openDeals.slice(0, 5).map(d => `- ${d.title} (${d.organization?.name || 'bez org'})`).join('\n')}

Vrať JSON s dvěma verzemi:
{
  "fullRecommendation": "Podrobné doporučení pro zobrazení (2-3 odstavce)",
  "voiceSummary": "STRUČNÉ shrnutí pro řidiče - max 2-3 věty, jen nejdůležitější zastávky a proč. Např: 'Na trase doporučuji zastavit v Jesenici u ZŠ K Rybníku - máte tam 3 aktivní dealy. Pak pokračuj do Sedlčan.'",
  "priorityStops": ["Město1", "Město2", "Město3"]
}`;

    const analysisResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: analysisPrompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    let recommendation = "Nepodařilo se vygenerovat doporučení.";
    let voiceSummary = "";
    let priorityStops: string[] = [];
    
    if (analysisResp.ok) {
      const analysisData = await analysisResp.json();
      try {
        const parsed = JSON.parse(analysisData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        recommendation = parsed.fullRecommendation || recommendation;
        voiceSummary = parsed.voiceSummary || "";
        priorityStops = parsed.priorityStops || [];
      } catch {
        recommendation = analysisData.candidates?.[0]?.content?.parts?.[0]?.text || recommendation;
      }
    }

    // Generate Google Maps URL with priority stops as waypoints
    const mapsWaypoints = priorityStops.slice(0, 5).join('|');
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${mapsWaypoints ? `&waypoints=${encodeURIComponent(mapsWaypoints)}` : ''}&travelmode=driving`;

    steps[3] = { 
      agent: "Analysis", 
      status: "done", 
      message: "Analýza dokončena",
      data: { recommendation }
    };

    // ========== Final Response ==========
    return c.json({
      success: true,
      route: {
        origin,
        destination,
        distance: steps[0]?.data?.distance,
        duration: steps[0]?.data?.duration,
        googleMapsUrl
      },
      locations,
      priorityStops,
      voiceSummary,
      crm: {
        organizations: allOrgs,
        persons: allPersons,
        deals: allDeals,
        priorityOrgs,
        locationMatches
      },
      recommendation,
      steps
    });

  } catch (error: any) {
    console.error("Route planner error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// LOCATION DETAILS - Get contacts for specific location
// ============================================
app.post("/make-server-954b19ad/agent/location-details", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    
    if (!pipedriveToken) {
      return c.json({ error: "Missing Pipedrive token" }, 500);
    }

    const { location, routeData } = await c.req.json();
    
    if (!location) {
      return c.json({ error: "Missing location" }, 400);
    }

    const PIPEDRIVE_BASE = "https://api.pipedrive.com/v1";

    console.log(`Getting details for location: ${location}`);

    // First check if we have data from the route
    let orgs: any[] = [];
    let persons: any[] = [];
    let deals: any[] = [];

    // Get data from routeData if available
    if (routeData?.crm?.locationMatches?.[location]) {
      const match = routeData.crm.locationMatches[location];
      orgs = match.orgs || [];
      deals = match.deals || [];
    }

    // Search Pipedrive for this location
    const searchResp = await fetch(
      `${PIPEDRIVE_BASE}/itemSearch?term=${encodeURIComponent(location)}&item_types=organization,person,deal&api_token=${pipedriveToken}&limit=30`
    );

    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const items = searchData.data?.items || [];
      
      // Add new orgs and persons
      for (const item of items) {
        if (item.item?.type === 'organization' && !orgs.find(o => o.id === item.item.id)) {
          orgs.push(item.item);
        }
        if (item.item?.type === 'person' && !persons.find(p => p.id === item.item.id)) {
          persons.push(item.item);
        }
        if (item.item?.type === 'deal' && !deals.find(d => d.id === item.item.id)) {
          deals.push(item.item);
        }
      }
    }

    // Get detailed info for each organization (including persons)
    const detailedOrgs: any[] = [];
    for (const org of orgs.slice(0, 5)) {
      // Get org details
      const orgResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${org.id}?api_token=${pipedriveToken}`);
      if (orgResp.ok) {
        const orgData = await orgResp.json();
        const orgDetails = orgData.data;
        
        // Get persons in this org
        const personsResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${org.id}/persons?api_token=${pipedriveToken}`);
        let orgPersons: any[] = [];
        if (personsResp.ok) {
          const personsData = await personsResp.json();
          orgPersons = personsData.data || [];
          // Add to global persons list
          for (const p of orgPersons) {
            if (!persons.find(ep => ep.id === p.id)) {
              persons.push(p);
            }
          }
        }
        
        // Get deals for this org
        const dealsResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${org.id}/deals?api_token=${pipedriveToken}`);
        let orgDeals: any[] = [];
        if (dealsResp.ok) {
          const dealsData = await dealsResp.json();
          orgDeals = dealsData.data || [];
        }
        
        detailedOrgs.push({
          ...orgDetails,
          persons: orgPersons,
          deals: orgDeals
        });
      }
    }

    // Sort deals by status (won first)
    deals.sort((a: any, b: any) => {
      const statusOrder = { won: 0, open: 1, lost: 2 };
      return (statusOrder[a.status as keyof typeof statusOrder] ?? 3) - (statusOrder[b.status as keyof typeof statusOrder] ?? 3);
    });

    // Generate summary with contacts
    let summary = `## 📍 ${location}\n\n`;
    
    if (detailedOrgs.length > 0) {
      summary += `### Organizace (${detailedOrgs.length})\n\n`;
      for (const org of detailedOrgs) {
        summary += `**${org.name}**\n`;
        if (org.address) summary += `📍 ${org.address}\n`;
        
        // List persons with phones
        if (org.persons?.length > 0) {
          summary += `\n**Kontakty:**\n`;
          for (const person of org.persons) {
            summary += `- ${person.name}`;
            if (person.phone?.[0]?.value) summary += ` 📞 ${person.phone[0].value}`;
            if (person.email?.[0]?.value) summary += ` ✉️ ${person.email[0].value}`;
            summary += `\n`;
          }
        }
        
        // List deals
        const wonDeals = org.deals?.filter((d: any) => d.status === 'won') || [];
        if (wonDeals.length > 0) {
          summary += `\n✅ **Aktivní dealy:** ${wonDeals.map((d: any) => d.title).join(', ')}\n`;
        }
        summary += `\n---\n\n`;
      }
    } else if (persons.length > 0) {
      summary += `### Kontakty (${persons.length})\n\n`;
      for (const person of persons) {
        summary += `- **${person.name}**`;
        if (person.phone?.[0]?.value || person.primary_phone) summary += ` 📞 ${person.phone?.[0]?.value || person.primary_phone}`;
        if (person.email?.[0]?.value || person.primary_email) summary += ` ✉️ ${person.email?.[0]?.value || person.primary_email}`;
        summary += `\n`;
      }
    } else {
      summary += `Žádné kontakty nenalezeny pro ${location}.\n`;
    }

    // Generate voice summary
    let voiceSummary = "";
    if (geminiKey && (detailedOrgs.length > 0 || persons.length > 0)) {
      const voicePrompt = `Vytvoř STRUČNÉ hlasové shrnutí kontaktů v ${location} pro řidiče (max 2 věty).

Data:
${detailedOrgs.map(o => `${o.name}: ${o.persons?.map((p: any) => `${p.name} ${p.phone?.[0]?.value || ''}`).join(', ')}`).join('\n')}

Formát: "V ${location} máš kontakty: [jména s čísly]. Doporučuji zavolat [komu] ohledně [čeho]."`;

      const voiceResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: voicePrompt }] }] })
      });

      if (voiceResp.ok) {
        const voiceData = await voiceResp.json();
        voiceSummary = voiceData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    }

    // Generate Google Maps URL for just this location
    const origin = routeData?.route?.origin || 'Praha';
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(location)}&travelmode=driving`;

    return c.json({
      success: true,
      location,
      summary,
      voiceSummary,
      googleMapsUrl,
      crmData: {
        organizations: detailedOrgs,
        persons,
        deals
      }
    });

  } catch (error: any) {
    console.error("Location details error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// CRM SEARCH - General CRM search with access codes
// ============================================
app.post("/make-server-954b19ad/agent/crm-search", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    
    if (!pipedriveToken) {
      return c.json({ error: "Missing Pipedrive token" }, 500);
    }

    const { query, originalMessage } = await c.req.json();
    
    if (!query) {
      return c.json({ error: "Missing query" }, 400);
    }

    const PIPEDRIVE_BASE = "https://api.pipedrive.com/v1";
    const lowerMessage = (originalMessage || query).toLowerCase();
    const wantsAccessCodes = lowerMessage.includes('přístup') || lowerMessage.includes('kód') || lowerMessage.includes('heslo');

    console.log(`CRM Search: "${query}", wantsAccessCodes: ${wantsAccessCodes}`);

    // Search Pipedrive
    const searchResp = await fetch(
      `${PIPEDRIVE_BASE}/itemSearch?term=${encodeURIComponent(query)}&item_types=organization,person,deal&api_token=${pipedriveToken}&limit=30`
    );

    let organizations: any[] = [];
    let persons: any[] = [];
    let deals: any[] = [];

    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const items = searchData.data?.items || [];
      
      organizations = items.filter((i: any) => i.item?.type === 'organization').map((i: any) => i.item);
      persons = items.filter((i: any) => i.item?.type === 'person').map((i: any) => i.item);
      deals = items.filter((i: any) => i.item?.type === 'deal').map((i: any) => i.item);
    }

    // Get detailed org info including custom fields (for access codes)
    const detailedOrgs: any[] = [];
    for (const org of organizations.slice(0, 5)) {
      const orgResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${org.id}?api_token=${pipedriveToken}`);
      if (orgResp.ok) {
        const orgData = await orgResp.json();
        const orgDetails = orgData.data;
        
        // Get persons in this org
        const personsResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${org.id}/persons?api_token=${pipedriveToken}`);
        let orgPersons: any[] = [];
        if (personsResp.ok) {
          const personsData = await personsResp.json();
          orgPersons = personsData.data || [];
        }
        
        // Get deals for this org
        const dealsResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${org.id}/deals?api_token=${pipedriveToken}`);
        let orgDeals: any[] = [];
        if (dealsResp.ok) {
          const dealsData = await dealsResp.json();
          orgDeals = dealsData.data || [];
        }
        
        // Extract teacher and student codes from custom fields
        let teacherCode = '';
        let studentCode = '';
        const orgKeys = Object.keys(orgDetails || {});
        
        // Log all keys for debugging
        console.log(`[CRM] Org ${orgDetails?.name} keys:`, orgKeys.filter(k => !['id', 'name', 'owner_id', 'add_time', 'update_time', 'visible_to', 'active_flag'].includes(k)));
        
        for (const key of orgKeys) {
          const value = orgDetails[key];
          if (value && typeof value === 'string' && value.length < 100) {
            const keyLower = key.toLowerCase();
            // Check for teacher/student code - Pipedrive uses hash prefixes
            if (keyLower.includes('teacher') || keyLower.includes('ucitel')) {
              teacherCode = value;
              console.log(`[CRM] Found teacher code in key ${key}: ${value}`);
            }
            if (keyLower.includes('student') || keyLower.includes('zak') || keyLower.includes('žák')) {
              studentCode = value;
              console.log(`[CRM] Found student code in key ${key}: ${value}`);
            }
          }
        }
        
        detailedOrgs.push({
          ...orgDetails,
          persons: orgPersons,
          deals: orgDeals,
          teacherCode,
          studentCode
        });
      }
    }

    // Enrich deals with person phone numbers
    for (const deal of deals.slice(0, 10)) {
      if (deal.person?.id && !deal.person.phone) {
        try {
          const personResp = await fetch(`${PIPEDRIVE_BASE}/persons/${deal.person.id}?api_token=${pipedriveToken}`);
          if (personResp.ok) {
            const personData = await personResp.json();
            if (personData.data) {
              deal.person.phone = personData.data.phone?.[0]?.value || null;
              deal.person.email = personData.data.email?.[0]?.value || null;
            }
          }
        } catch (e) {
          console.error(`Failed to fetch person:`, e);
        }
      }
    }

    // Build summary
    let summary = `## 🔍 Výsledky pro "${query}"\n\n`;
    
    if (detailedOrgs.length > 0) {
      summary += `### Organizace (${detailedOrgs.length})\n\n`;
      for (const org of detailedOrgs) {
        summary += `**${org.name}**\n`;
        if (org.address) summary += `📍 ${org.address}\n`;
        
        // Check for access codes in custom fields
        if (wantsAccessCodes) {
          // Look through all fields for anything that looks like access code
          const orgKeys = Object.keys(org);
          let teacherCode = '';
          let studentCode = '';
          
          for (const key of orgKeys) {
            const value = org[key];
            if (value && typeof value === 'string' && value.length < 100) {
              const keyLower = key.toLowerCase();
              
              // Check for teacher code
              if (keyLower.includes('teacher') && (keyLower.includes('code') || keyLower.includes('kod'))) {
                teacherCode = value;
              }
              // Check for student code  
              if (keyLower.includes('student') && (keyLower.includes('code') || keyLower.includes('kod'))) {
                studentCode = value;
              }
              // Generic access code fallback
              if (!teacherCode && !studentCode) {
                if (keyLower.includes('kod') || keyLower.includes('code') || keyLower.includes('pristup') || keyLower.includes('heslo') || keyLower.includes('password')) {
                  summary += `🔑 **Přístupový kód (${key})**: ${value}\n`;
                }
              }
            }
          }
          
          // Display teacher and student codes prominently
          if (teacherCode) {
            summary += `👨‍🏫 **Teacher Code**: \`${teacherCode}\`\n`;
          }
          if (studentCode) {
            summary += `👨‍🎓 **Student Code**: \`${studentCode}\`\n`;
          }
        }
        
        // List persons with phones
        if (org.persons?.length > 0) {
          summary += `\n**Kontakty:**\n`;
          for (const person of org.persons.slice(0, 3)) {
            summary += `- ${person.name}`;
            if (person.phone?.[0]?.value) summary += ` 📞 ${person.phone[0].value}`;
            if (person.email?.[0]?.value) summary += ` ✉️ ${person.email[0].value}`;
            summary += `\n`;
          }
        }
        
        // List deals
        const wonDeals = org.deals?.filter((d: any) => d.status === 'won') || [];
        const openDeals = org.deals?.filter((d: any) => d.status === 'open') || [];
        if (wonDeals.length > 0) {
          summary += `\n✅ **Aktivní produkty:** ${wonDeals.map((d: any) => d.title).join(', ')}\n`;
        }
        if (openDeals.length > 0) {
          summary += `🔵 **Otevřené dealy:** ${openDeals.map((d: any) => d.title).join(', ')}\n`;
        }
        summary += `\n---\n\n`;
      }
    }

    if (persons.length > 0 && detailedOrgs.length === 0) {
      summary += `### Kontakty (${persons.length})\n\n`;
      for (const person of persons.slice(0, 5)) {
        summary += `- **${person.name}**`;
        if (person.primary_phone) summary += ` 📞 ${person.primary_phone}`;
        if (person.primary_email) summary += ` ✉️ ${person.primary_email}`;
        summary += `\n`;
      }
    }

    if (detailedOrgs.length === 0 && persons.length === 0 && deals.length === 0) {
      summary += `Žádné výsledky nenalezeny pro "${query}".\n`;
    }

    // Generate voice summary
    let voiceSummary = "";
    if (geminiKey && detailedOrgs.length > 0) {
      const voicePrompt = `Vytvoř STRUČNÉ hlasové shrnutí (max 2 věty) pro výsledky hledání "${query}":
      
${detailedOrgs.slice(0, 2).map(o => `${o.name}: ${o.persons?.length || 0} kontaktů, ${o.deals?.filter((d: any) => d.status === 'won')?.length || 0} aktivních dealů`).join('\n')}

Formát: Přirozená čeština, stručné, jen nejdůležitější info.`;

      try {
        const voiceResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: voicePrompt }] }] })
        });

        if (voiceResp.ok) {
          const voiceData = await voiceResp.json();
          voiceSummary = voiceData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }
      } catch (e) {
        console.error("Voice summary error:", e);
      }
    }

    return c.json({
      success: true,
      query,
      summary,
      voiceSummary,
      crmData: {
        organizations: detailedOrgs,
        persons,
        deals
      }
    });

  } catch (error: any) {
    console.error("CRM search error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// GOOGLE CALENDAR - GET EVENTS
// ============================================
app.post("/make-server-954b19ad/calendar/events", async (c) => {
  try {
    const { googleAccessToken, timeMin, timeMax, maxResults = 50 } = await c.req.json();

    if (!googleAccessToken) {
      return c.json({ error: "google_auth_required" }, 403);
    }

    // Default: today to 7 days ahead
    const now = new Date();
    const weekAhead = new Date(now);
    weekAhead.setDate(weekAhead.getDate() + 7);
    
    const minTime = timeMin || now.toISOString();
    const maxTime = timeMax || weekAhead.toISOString();

    const calendarResp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(minTime)}&` +
      `timeMax=${encodeURIComponent(maxTime)}&` +
      `maxResults=${maxResults}&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      }
    );

    if (!calendarResp.ok) {
      const errText = await calendarResp.text();
      console.error("Calendar API error:", errText);
      if (calendarResp.status === 401) {
        return c.json({ error: "token_expired" }, 401);
      }
      return c.json({ error: "calendar_api_error", details: errText }, 500);
    }

    const calendarData = await calendarResp.json();
    const events = (calendarData.items || []).map((event: any) => ({
      id: event.id,
      title: event.summary || "(Bez názvu)",
      description: event.description || "",
      location: event.location || "",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      allDay: !event.start?.dateTime,
      status: event.status,
      htmlLink: event.htmlLink,
      colorId: event.colorId
    }));

    return c.json({ events, totalEvents: events.length });

  } catch (error: any) {
    console.error("Calendar events error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// CREATE CALENDAR EVENT
app.post("/make-server-954b19ad/calendar/create-event", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    const { googleAccessToken, taskText, date, time } = await c.req.json();

    if (!googleAccessToken) {
      return c.json({ error: "google_auth_required" }, 403);
    }

    // Use AI to parse event details from task text
    let eventTitle = taskText;
    let eventDescription = "";
    let eventDate = date || new Date().toISOString().split('T')[0];
    let eventTime = time || "09:00";
    let duration = 60; // minutes

    let eventLocation = "";
    
    if (geminiKey) {
      const today = new Date().toISOString().split('T')[0];
      const parsePrompt = `Analyzuj tento text a extrahuj informace o schůzce/události:
"${taskText}"

Dnešní datum je ${today}.

Vrať JSON:
{
  "title": "název události (např. 'Schůzka v Sedlčanech')",
  "description": "popis (volitelný)",
  "date": "YYYY-MM-DD" (pro 'pondělí' spočítej nejbližší pondělí od dneška),
  "time": "HH:MM" (default "10:00" pokud není specifikováno),
  "duration": číslo v minutách (default 60),
  "location": "místo schůzky (město, škola, adresa)" nebo null
}`;

      try {
    const parseResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
            contents: [{ parts: [{ text: parsePrompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

        if (parseResp.ok) {
          const parseData = await parseResp.json();
          const parsed = JSON.parse(parseData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
          if (parsed.title) eventTitle = parsed.title;
          if (parsed.description) eventDescription = parsed.description;
          if (parsed.date) eventDate = parsed.date;
          if (parsed.time) eventTime = parsed.time;
          if (parsed.duration) duration = parsed.duration;
          if (parsed.location) eventLocation = parsed.location;
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
    }

    // Build event datetime
    const startDateTime = new Date(`${eventDate}T${eventTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    const event: any = {
      summary: eventTitle,
      description: eventDescription,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "Europe/Prague"
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "Europe/Prague"
      }
    };
    
    if (eventLocation) {
      event.location = eventLocation;
    }

    const createResp = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );

    if (!createResp.ok) {
      const errText = await createResp.text();
      console.error("Create event error:", errText);
      if (createResp.status === 401) {
        return c.json({ error: "token_expired" }, 401);
      }
      return c.json({ error: "Failed to create event", details: errText }, 500);
    }

    const createdEvent = await createResp.json();
    return c.json({
      success: true,
      eventId: createdEvent.id,
      link: createdEvent.htmlLink,
      event: {
        title: eventTitle,
        date: eventDate,
        time: eventTime,
        duration: duration,
        description: eventDescription,
        location: eventLocation
      }
    });

  } catch (error: any) {
    console.error("Create event error:", error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Stejná znalostní knihovna jako webové RAG (`rag_document_index` + `rag_doc_*`).
 * Při velkém objemu vybere relevantní dokumenty přes Gemini, jinak pošle celý obsah (do limitu).
 */
async function fetchRagContextForSalesAssistant(
  geminiKey: string,
  userMessage: string,
  historySnippet: string,
): Promise<{ context: string; titles: string[] } | null> {
  try {
    const index = await kv.get("rag_document_index") || [];
    if (!index.length) return null;
    const docs = (await Promise.all(index.map(async (doc: any) => await kv.get(`rag_doc_${doc.id}`)))).filter(Boolean);
    if (!docs.length) return null;

    const MAX_TOTAL = 36000;
    const buildFromDocs = (list: any[]) =>
      list.map((d: any) => `### ${d.title || "Dokument"}\n${String(d.content || "").trim()}`).join("\n\n");

    const full = buildFromDocs(docs);
    if (full.length <= MAX_TOTAL) {
      return { context: full, titles: docs.map((d: any) => d.title || "").filter(Boolean) };
    }

    const catalog = docs.map((d: any, i: number) =>
      `[${i}] ${d.title || "Bez názvu"}
Kategorie: ${d.category || "—"}
Náhled: ${String(d.content || "").slice(0, 280).replace(/\s+/g, " ")}...`
    ).join("\n\n");

    const selectPrompt = `Jsi retriever pro obchodního asistenta. Vyber indexy dokumentů (0 až ${docs.length - 1}), které obsahují odpověď nebo souvisí s otázkou.

OTÁZKA: "${userMessage}"
${historySnippet ? `PŘEDCHOZÍ KONTEXT:\n${historySnippet.slice(0, 1500)}\n` : ""}

KATALOG DOKUMENTŮ:
${catalog}

Vrať JSON: { "indices": [čísla, max 6], "reason": "jedna věta" }`;

    const selResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: selectPrompt }] }],
          generationConfig: { response_mime_type: "application/json" },
        }),
      },
    );

    let indices: number[] = [];
    if (selResp.ok) {
      const selData = await selResp.json();
      const parsed = JSON.parse(selData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
      if (Array.isArray(parsed.indices)) {
        indices = parsed.indices.filter((i: number) => Number.isInteger(i) && i >= 0 && i < docs.length);
      }
    }

    if (indices.length === 0) {
      const out: any[] = [];
      let acc = 0;
      for (const d of docs) {
        const chunk = `### ${d.title || "Dokument"}\n${String(d.content || "").trim()}`;
        if (acc + chunk.length > MAX_TOTAL) break;
        out.push(d);
        acc += chunk.length;
      }
      if (out.length === 0) {
        return { context: full.slice(0, MAX_TOTAL), titles: docs.map((d: any) => d.title || "").filter(Boolean) };
      }
      const joined = buildFromDocs(out);
      return { context: joined.slice(0, MAX_TOTAL), titles: out.map((d: any) => d.title || "").filter(Boolean) };
    }

    const selected = [...new Set(indices)].slice(0, 6).map((i) => docs[i]).filter(Boolean);
    if (!selected.length) return { context: full.slice(0, MAX_TOTAL), titles: [] };
    let joined = buildFromDocs(selected);
    if (joined.length > MAX_TOTAL) joined = joined.slice(0, MAX_TOTAL);
    return { context: joined, titles: selected.map((d: any) => d.title || "").filter(Boolean) };
  } catch (e) {
    console.error("[Orchestrator] fetchRagContextForSalesAssistant:", e);
    return null;
  }
}

/** Druhý pokus retrieve: kratší dotaz s klíčovými slovy, když první embeddingové hledání nic nevrátí. */
function buildSmartEditRetrieveFallbackQuery(cleanText: string): string {
  const t = (cleanText || "").toLowerCase();
  const parts: string[] = [];
  if (/webin|dvpp|školen|workshop|plánovan|akcí/i.test(t)) {
    parts.push("webináře Vividbooks termíny kalendář rozvrh plánované akce DVPP");
  }
  if (/mšmt|příspěv|rvp/i.test(t)) {
    parts.push("MŠMT příspěvek zakoupení učební materiály");
  }
  if (/matemat|prvou|fyzik|chemi|přírodopis/i.test(t)) {
    parts.push("předmět učebnice ZŠ Vividbooks");
  }
  if (parts.length) return parts.join(" ");
  return (cleanText || "").slice(0, 800).trim();
}

/**
 * Z konceptu e-mailu sestaví cílený český dotaz pro pgvector RAG (ne jen copy-paste celého emailu).
 */
async function refineRagQueryForSmartEdit(
  cleanText: string,
  hintFromDecision: string,
  geminiKey: string,
): Promise<string> {
  const trimmed = cleanText.trim();
  const hint = hintFromDecision.trim();
  if (!trimmed) return "";
  const qPrompt = `Jsi asistent pro obchodníky Vividbooks (digitální interaktivní učebnice pro školy).

ROZEPSANÝ EMAIL (může být krátký):
"""
${trimmed}
"""

${hint ? `NÁPOVĚDA Z ANALÝZY (téma / co hledat): ${hint}` : ""}

ÚKOL: Sestav JEDEN dotaz v češtině pro vyhledávání ve firemní znalostní knihovně (RAG). Dotaz musí:
- Zacílit na předmět, ročník nebo typ nabídky (např. český jazyk, 1. stupeň, matematika, balíčky).
- Pokud email zmiňuje **webináře, školení, plánované akce, „tento měsíc“ nebo termíny**: dotaz musí výslovně obsahovat klíčová slova pro vyhledání **webinářů Vividbooks, termínů, data, rozvrh, DVPP** — aby RAG našel stejné chunky jako v chatu (kalendář webinářů), ne jen obecný katalog.
- Obsahovat klíčová slova pro: nabídku produktů, soulad s MŠMT a RVP, případně související předměty nebo balíčky — jen pokud souvisí s tématem emailu.
- Být konkrétní — NE kopírovat oslovení, podpis ani celý email jako jeden blok.
- Pomoci najít POMOCNÉ informace pro příjemce (fakta, která doplní krátký koncept), ne přepsat e-mail.

Vrať POUZE JSON:
{ "query": "..." }`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: qPrompt }] }],
          generationConfig: { response_mime_type: "application/json" },
        }),
      },
    );
    if (resp.ok) {
      const data = await resp.json();
      const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
      const q = String(parsed.query || "").trim();
      if (q.length >= 10) return q.slice(0, 2000);
    }
  } catch (e) {
    console.error("[SmartEdit] refineRagQueryForSmartEdit:", e);
  }
  const fallback = [hint, trimmed].filter(Boolean).join(" ").trim();
  return fallback.slice(0, 2000);
}

/**
 * Stejný RAG jako Web operátor (Admin agent / modal „RAG“): `make-server-93a20b6f` → POST `/rag/query` (pgvector + Gemini).
 * Odlišné od KV knihovny (`rag_document_index`) v této funkci.
 */
async function fetchWebRagAnswer(
  question: string,
  opts?: { topK?: number },
): Promise<{
  answer: string;
  sources: any[];
  chunksUsed: number;
} | null> {
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  /** Volání druhé Edge funkce — service role je spolehlivější než anon u server-to-server. */
  const jwt =
    (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim() ||
    (Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  if (!base || !jwt) {
    console.warn("[Orchestrator] fetchWebRagAnswer: chybí SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY/ANON_KEY");
    return null;
  }
  const topK = Math.min(16, Math.max(4, Number(opts?.topK) || 8));
  const url = `${base}/functions/v1/make-server-93a20b6f/rag/query`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: question.trim(), topK }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[Orchestrator] fetchWebRagAnswer HTTP", res.status, (data as any)?.error || "");
      return null;
    }
    if ((data as any).error) {
      console.error("[Orchestrator] fetchWebRagAnswer:", (data as any).error);
      return null;
    }
    const chunksUsed = Number((data as any).chunksUsed) || 0;
    const answer = String((data as any).answer || "").trim();
    if (chunksUsed === 0 || !answer) return null;
    return {
      answer,
      sources: Array.isArray((data as any).sources) ? (data as any).sources : [],
      chunksUsed,
    };
  } catch (e) {
    console.error("[Orchestrator] fetchWebRagAnswer:", e);
    return null;
  }
}

/** Stejný index jako Web operátor — jen chunky (bez rag/query syntézy); odpověď skládá orchestrátor z kontextu. */
async function fetchPgvectorRagChunksForOrchestrator(
  question: string,
  opts?: { topK?: number },
): Promise<{ context: string; titles: string[] } | null> {
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const jwt =
    (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim() ||
    (Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  if (!base || !jwt) {
    console.warn("[Orchestrator] fetchPgvectorRagChunksForOrchestrator: chybí SUPABASE_URL nebo JWT");
    return null;
  }
  const topK = Math.min(16, Math.max(4, Number(opts?.topK) || 12));
  const url = `${base}/functions/v1/make-server-93a20b6f/rag/retrieve`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: question.trim(), topK }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data as any).error) {
      console.error("[Orchestrator] rag/retrieve HTTP", res.status, (data as any)?.error || "");
      return null;
    }
    const chunksUsed = Number((data as any).chunksUsed) || 0;
    const context = String((data as any).context || "").trim();
    if (chunksUsed === 0 || !context) return null;
    const titles = Array.isArray((data as any).sources)
      ? (data as any).sources.map((s: any) => String(s?.title || s?.source || "").trim()).filter(Boolean)
      : [];
    return { context, titles };
  } catch (e) {
    console.error("[Orchestrator] fetchPgvectorRagChunksForOrchestrator:", e);
    return null;
  }
}

/** Rozšířené instrukce pro newsletter, maily, novinky — stejný styl cíle jako „Web operátor“ (copywriting bez CMS). */
function getCopywritingInstructionsBlock(message: string): string {
  const m = String(message || "").trim();
  if (!m) return "";
  const wantCopy =
    /\b(novink|newsletter|mailing|e-mailu|e-mail|email|mailchimp|oslovení|bulletin|perex|tiskov|marketingov|copywrit)\b/i.test(m) ||
    /\bformuluj|napiš\s+mi\s+mail|text\s+na\s+mail|text\s+pro\s+zákazník|mail\s+pro\s+zákazník|zákazníkovi\s+mail/i.test(m) ||
    /napiš\s+mi\s+z\s+toho\s+mail/i.test(m) ||
    /\b(doplň|dopln)\s+.*\bmail/i.test(m) ||
    /\bnapis\s+mi\s+z\s+toho\s+mail/i.test(m);
  if (!wantCopy) return "";
  return `

DODATEK — FORMULACE TEXTŮ (žádost vypadá jako copywriting / marketing / e-mail):
- Piš jako zkušený marketingový copywriter pro české školy (B2B): respekt k ředitelům a učitelům, žádný laciný prodejní tlak.
- Struktura: silný úvod, přehledné body výhod, případně krátká výzva k akci — jen pokud dává smysl.
- Tón: profesionální, přirozená čeština, vyhni se prázdným frázím („vážení přátelé“ bez obsahu).
- Pro newsletter nebo obchodní e-mail: na začátku odpovědi uveď návrh **Předmět:** (cca do 60 znaků) a **Perex:** (1–2 věty), pak tělo zprávy v Markdownu.
- U obchodního mailu nech místo pro doplnění jména školy nebo kontaktu tam, kde je potřeba ([Škola], [Jméno]).
- Vycházej z přiložené znalostní knihovny; nevymýšlej ceny, slevy ani termíny, které v kontextu nejsou.
`;
}

// ========== UNIFIED AGENT ORCHESTRATOR ==========
// Single endpoint that understands intent and executes appropriate action
app.post("/make-server-954b19ad/agent/orchestrate", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    
    if (!geminiKey) return c.json({ error: "Missing GEMINI_API_KEY_RAG" }, 500);

    const { message, conversationHistory = [], googleAccessToken, lastRouteData } = await c.req.json();
    if (!message) return c.json({ error: "Missing message" }, 400);

    const copywritingInstructions = getCopywritingInstructionsBlock(message);

    const PIPEDRIVE_BASE = "https://api.pipedrive.com/v1";

    // Step 1: AI understands intent
    const historyText = conversationHistory.length > 0 
      ? `Předchozí konverzace:\n${conversationHistory.map((m: any) => `${m.role}: ${m.content}`).join('\n')}\n\n`
      : '';

    const contextInfo = lastRouteData 
      ? `Kontext: Uživatel plánoval trasu z ${lastRouteData.origin} do ${lastRouteData.destination}. Lokality na trase: ${lastRouteData.locations?.slice(0, 10).join(', ')}\n\n`
      : '';

    const today = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    
    const intentPrompt = `Jsi inteligentní asistent. Analyzuj uživatelovu zprávu a rozhodni co udělat.

DNEŠNÍ DATUM: ${today} (rok ${currentYear})

${historyText}${contextInfo}Zpráva: "${message}"

DOSTUPNÉ AKCE:
1. crm_search - hledání v CRM (školy, firmy, kontakty, dealy, přístupové kódy)
2. route_plan - plánování trasy s CRM vyhledáváním
3. contact_lookup - hledání KONKRÉTNÍHO kontaktu (ředitel, učitel, osoba) v organizaci
4. create_task - vytvoření úkolu/připomenutí
5. create_calendar - naplánování schůzky do kalendáře
6. read_calendar - **pouze osobní Google kalendář přihlášeného uživatele** („co mám dnes v kalendáři“, „můj plán na čtvrtek“, „jaký mám program“)
7. general_response - obecná odpověď/konverzace včetně **webinářů, školení a nabídky Vividbooks z webu** (doplní se o firemní RAG — stejně jako Web operátor)

PRAVIDLA:
- Pokud zpráva NENÍ JASNÁ → nastav needsClarification=true a zeptej se
- Pokud zmiňuje "mezi X a Y", "přejezd", "po cestě", "na trase" → route_plan (vždy!)
- Pokud zmiňuje cestu/trasu/jedu/pojedu → route_plan
- Pokud hledá KONKRÉTNÍ KONTAKT/osobu (ředitel, učitel, email, telefon) → contact_lookup
- KRITICKÉ — produkt / předmět / nabídka: "co máme na [předmět]", "CO MÁME NA ČESKÝ JAZYK", "jaké máme učebnice na …", "co prodáváme na matematiku" → **general_response** (webový RAG jako Web operátor). **NIKDY crm_search.**
- crm_search jen když jde o **konkrétní organizaci, město, školu v CRM, kontakt, deal** (např. "školy v Sedlčanech", "ZŠ Dobříš") — ne „co máme za materiály“.
- Pokud zmiňuje školy/firmy/dealy BEZ konkrétního kontaktu a jde o **lokalitu / název instituce** → crm_search
- Pokud žádá napsat text, informovat nebo „napiš o…“ k školnímu předmětu, pedagogice nebo obecnému tématu (např. český jazyk, matematika) a NEJDE o konkrétní školu v CRM → general_response (NE crm_search)
- Pokud žádá **novinku, newsletter, mailing, text e-mailu, oslovení zákazníka, marketingový text** (ne konkrétní CRM záznam) → **general_response** (NIKDY crm_search)
- Pokud chce připomenout/úkol/todo → create_task
- Pokud chce VYTVOŘIT schůzku/meeting → create_calendar
- **KRITICKÉ — read_calendar vs. general_response:** \`read_calendar\` **jen** když jde o **uživatelův vlastní** Google kalendář (osobní schůzky, „co mám v kalendáři“, „můj plán“, „jaký mám program dnes“). **NIKDY read_calendar** pro dotazy na **webináře / školení / DVPP / nabídku Vividbooks**, termíny firemních akcí na webu, „informace o webinářích“, „webináře na příští měsíc“ — to je vždy **general_response** (znalostní báze), i když je větě slovo „měsíc“ nebo „příští týden“.
- Pokud se PTÁ co má **já** v **(mém) kalendáři** / osobním plánu / programu na den/týden → read_calendar
- Pro CRM vždy extrahuj konkrétní hledaný výraz (město, název školy, osoba)

DŮLEŽITÉ: "školy mezi X a Y" = route_plan (origin=X, destination=Y), NE crm_search!

Vrať POUZE JSON:
{
  "understood": true/false,
  "needsClarification": true/false,
  "clarificationQuestion": "otázka pokud needsClarification=true",
  "action": "crm_search|route_plan|contact_lookup|create_task|create_calendar|read_calendar|general_response",
  "params": {
    "searchQuery": "POUZE název města nebo organizace (např. 'Dobříš' nebo 'ZŠ Sedlčany') - BEZ slov jako 'aktivní', 'školy', 'kolem'",
    "origin": "odkud (pro route_plan)",
    "destination": "kam (pro route_plan)", 
    "organizationName": "název organizace pro vyhledání kontaktu (pro contact_lookup)",
    "contactRole": "role kontaktu - ředitel, učitel, kontaktní osoba (pro contact_lookup)",
    "taskText": "text úkolu (pro create_task)",
    "eventText": "popis schůzky (pro create_calendar)",
    "calendarDate": "datum pro read_calendar (YYYY-MM-DD nebo 'today', 'tomorrow', 'this_week')"
  },
  "response": "přímá odpověď pro general_response"
}

PŘÍKLADY:
- "Jaké aktivní školy jsou kolem Sedlčan?" → action: "crm_search", params.searchQuery: "Sedlčany"
- "Jaké aktivní školy jsou kolem Dobříše?" → action: "crm_search", params.searchQuery: "Dobříš"
- "Jedu z Prahy do Sedlčan" → action: "route_plan", params.origin: "Praha", params.destination: "Sedlčany"
- "Školy mezi Pacovem a Havlíčkovým Brodem" → action: "route_plan", params.origin: "Pacov", params.destination: "Havlíčkův Brod"
- "Najdi mi kontakt na ředitele ZŠ Želiv" → action: "contact_lookup", params.organizationName: "ZŠ Želiv", params.contactRole: "ředitel"
- "Jaký je email ředitele v Základní škola Sedlčany?" → action: "contact_lookup", params.organizationName: "Základní škola Sedlčany", params.contactRole: "ředitel"
- "Dej mi telefon na ZŠ Pacov" → action: "contact_lookup", params.organizationName: "ZŠ Pacov", params.contactRole: "kontaktní osoba"
- "Připomeň mi zavolat Dagmar" → action: "create_task", params.taskText: "zavolat Dagmar"
- "Naplánuj schůzku v pondělí" → action: "create_calendar", params.eventText: "schůzka v pondělí"
- "Co mám dnes v kalendáři?" → action: "read_calendar", params.calendarDate: "today"
- "Jaký mám plán na čtvrtek?" → action: "read_calendar", params.calendarDate: YYYY-MM-DD nejbližšího čtvrtka (POUŽIJ AKTUÁLNÍ ROK!)
- "Co mám 26. ledna?" → action: "read_calendar", params.calendarDate: "${currentYear}-01-26" (VŽDY použij aktuální rok ${currentYear}!)
- "Co mám tento týden?" → action: "read_calendar", params.calendarDate: "this_week"
- "Dej mi informace o webinářích na příští měsíc" / "kdy jsou webináře Vividbooks" → action: "general_response" (firemní webináře z RAG, **ne** Google kalendář)
- "napiš o českém jazyce" / "co je matematika ve 3. třídě" → action: "general_response" (předmět / obsah, ne CRM)
- "co máme na český jazyk" / "CO MÁME NA ČESKÝ JAZYK" / "jaké máme produkty na matematiku" → action: "general_response" (produktový RAG)
- "napiš novinku o webináři" / "text newsletteru o matematice" / "mail pro ředitele školy" → action: "general_response" (copywriting + RAG)
- "Dej mi info" → needsClarification: true, clarificationQuestion: "O čem přesně chcete informace? Můžu hledat školy, firmy, kontakty..."`;

    const intentResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: intentPrompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    if (!intentResp.ok) {
      throw new Error(`Intent detection failed: ${intentResp.status}`);
    }

    const intentData = await intentResp.json();
    const intent = JSON.parse(intentData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");

    console.log("[Orchestrator] Intent:", JSON.stringify(intent));

    /** Dotazy na sortiment / předmět patří do web RAG (jako Web operátor), ne do Pipedrive crm_search. */
    const msgNorm = String(message || "").trim();
    const isProductKnowledgeQuery =
      /\bco\s+m[aá]me\s+na\b/i.test(msgNorm) ||
      /\b(?:jak|jaké|jaký)\s+m[aá]me\s+(?:produkty|materiály|učebnice|tituly)\b/i.test(msgNorm) ||
      /\b(?:máte|máme)\s+(?:něco|n[ěe]co)\s+na\s+(?:česk|matematik|fyzik|chemi|přírodopis|prvouk)/i.test(
        msgNorm,
      );

    if (intent.action === "crm_search" && isProductKnowledgeQuery) {
      console.log("[Orchestrator] Přepínám crm_search → general_response (produktový RAG, ne CRM)");
      intent.action = "general_response";
    }

    const isCopywritingIntent =
      /\b(novink|newsletter|mailing|e-mail|email|formuluj|oslovení|mailchimp|bulletin|perex|marketingov)\b/i.test(msgNorm) ||
      /napiš\s+mi\s+z\s+toho\s+mail/i.test(msgNorm) ||
      /\bmail\s+pro\s+zákazník|\bzákazníkovi\s+mail\b/i.test(msgNorm);

    if (intent.action === "crm_search" && isCopywritingIntent) {
      console.log("[Orchestrator] Přepínám crm_search → general_response (copywriting / newsletter)");
      intent.action = "general_response";
    }

    /** Webináře / školení firmy = RAG, ne osobní Google kalendář */
    const wantsPersonalGoogleCalendar =
      /\bco\s+mám\s+(dnes|zítra|tento\s+týden|příští\s+týden|v\s+kalendáři|v\s+plánu)\b/i.test(msgNorm) ||
      /\bco\s+máme\s+(dnes|zítra|tento\s+týden|příští\s+týden)\b/i.test(msgNorm) ||
      /\b(jaký|jaké)\s+mám\s+(plán|program)\b/i.test(msgNorm) ||
      /\bmůj\s+(kalendář|plán|program)\b/i.test(msgNorm) ||
      /\b(kalendář|plán|program)\s+u\s+mě\b/i.test(msgNorm) ||
      /\bgoogle\s+kalendář\b/i.test(msgNorm);

    const isCompanyWebinarOrEventsKnowledge =
      /webin[áa]ř/i.test(msgNorm) ||
      /\bdvpp\b/i.test(msgNorm) ||
      /\binformac[ei]\s+o\s+webin/i.test(msgNorm) ||
      /\binfromac[ei]\b.*webin/i.test(msgNorm) ||
      /\b(?:školení|akce)\s+(?:firmy|vividbooks|na\s+webu)/i.test(msgNorm);

    if (intent.action === "read_calendar" && isCompanyWebinarOrEventsKnowledge && !wantsPersonalGoogleCalendar) {
      console.log("[Orchestrator] Přepínám read_calendar → general_response (webináře z RAG, ne osobní kalendář)");
      intent.action = "general_response";
    }

    // Handle clarification
    if (intent.needsClarification) {
      return c.json({
        success: true,
        needsClarification: true,
        clarificationQuestion: intent.clarificationQuestion
      });
    }

    // Step 2: Execute action based on intent
    const action = intent.action;
    const params = intent.params || {};

    // ========== CRM SEARCH ==========
    if (action === 'crm_search' && pipedriveToken) {
      const searchQuery = params.searchQuery || message;
      console.log("[Orchestrator] CRM Search:", searchQuery);

      let allOrgs: any[] = [];
      let allPersons: any[] = [];
      let allDeals: any[] = [];

      // Search Pipedrive
      const searchResp = await fetch(
        `${PIPEDRIVE_BASE}/itemSearch?term=${encodeURIComponent(searchQuery)}&item_types=organization,person,deal&api_token=${pipedriveToken}&limit=50`
      );

      if (searchResp.ok) {
        const searchData = await searchResp.json();
        const items = searchData.data?.items || [];

        for (const item of items) {
          if (item.item?.type === 'organization') allOrgs.push(item.item);
          if (item.item?.type === 'person') allPersons.push(item.item);
          if (item.item?.type === 'deal') allDeals.push(item.item);
        }
      }

      // ========== DEDUPLICATION AGENT ==========
      // Group deals by organization and deduplicate
      const orgDealsMap = new Map<number, { org: any, deals: any[], wonCount: number, openCount: number }>();
      
      for (const deal of allDeals) {
        const orgId = deal.organization?.id || deal.org_id;
        const orgName = deal.organization?.name || deal.org_name || 'Neznámá org';
        
        if (orgId) {
          if (!orgDealsMap.has(orgId)) {
            orgDealsMap.set(orgId, {
              org: { id: orgId, name: orgName },
              deals: [],
              wonCount: 0,
              openCount: 0
            });
          }
          const entry = orgDealsMap.get(orgId)!;
          entry.deals.push(deal);
          if (deal.status === 'won') entry.wonCount++;
          if (deal.status === 'open') entry.openCount++;
        }
      }

      // Get unique organizations from deals
      const uniqueOrgIds = new Set<number>();
      for (const deal of allDeals) {
        const orgId = deal.organization?.id || deal.org_id;
        if (orgId) uniqueOrgIds.add(orgId);
      }
      
      // Also add directly found orgs
      for (const org of allOrgs) {
        uniqueOrgIds.add(org.id);
      }

      // Get detailed org info (deduplicated)
      const detailedOrgs: any[] = [];
      const processedOrgIds = new Set<number>();
      
      for (const orgId of Array.from(uniqueOrgIds).slice(0, 15)) {
        if (processedOrgIds.has(orgId)) continue;
        processedOrgIds.add(orgId);
        
        const orgResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${orgId}?api_token=${pipedriveToken}`);
        if (orgResp.ok) {
        const orgData = await orgResp.json();
          const orgDetail = orgData.data;
          
          // Add deal stats from our map
          const dealStats = orgDealsMap.get(orgId);
          if (dealStats) {
            orgDetail.dealCount = dealStats.deals.length;
            orgDetail.wonDeals = dealStats.wonCount;
            orgDetail.openDeals = dealStats.openCount;
          }
          
          detailedOrgs.push(orgDetail);
        }
      }

      // Sort orgs: most won deals first
      detailedOrgs.sort((a, b) => (b.wonDeals || 0) - (a.wonDeals || 0));

      // Get detailed person info with phones (deduplicated)
      const detailedPersons: any[] = [];
      const processedPersonIds = new Set<number>();
      
      for (const person of allPersons.slice(0, 10)) {
        if (processedPersonIds.has(person.id)) continue;
        processedPersonIds.add(person.id);
        
        const personResp = await fetch(`${PIPEDRIVE_BASE}/persons/${person.id}?api_token=${pipedriveToken}`);
        if (personResp.ok) {
        const personData = await personResp.json();
          detailedPersons.push(personData.data);
        }
      }

      // Create deduplicated deal list (one per org, prioritize won)
      const deduplicatedDeals: any[] = [];
      for (const [orgId, entry] of orgDealsMap) {
        // Sort this org's deals: won first
        entry.deals.sort((a, b) => {
          const order = { won: 0, open: 1, lost: 2 };
          return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
        });
        // Take only the best deal per org
        if (entry.deals.length > 0) {
          const bestDeal = entry.deals[0];
          bestDeal.totalDealsForOrg = entry.deals.length;
          bestDeal.wonDealsForOrg = entry.wonCount;
          deduplicatedDeals.push(bestDeal);
        }
      }

      // Sort deduplicated deals: WON first
      deduplicatedDeals.sort((a: any, b: any) => {
        const order = { won: 0, open: 1, lost: 2 };
        return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
      });

      console.log(`[Orchestrator] Deduplicated: ${allDeals.length} deals → ${deduplicatedDeals.length} unique orgs`);

      const wonOrgsCount = detailedOrgs.filter(o => o.wonDeals > 0).length;
      const summary = detailedOrgs.length > 0 || deduplicatedDeals.length > 0
        ? `✅ **${detailedOrgs.length} unikátních organizací** (${wonOrgsCount} aktivních zákazníků)\n📊 Celkem ${allDeals.length} dealů → ${deduplicatedDeals.length} po deduplikaci`
        : `Žádné výsledky pro "${searchQuery}". Zkuste jiný hledaný výraz.`;

      return c.json({
        success: true,
        action: 'crm_search',
        response: summary,
        summary,
        voiceSummary: detailedOrgs.length > 0 
          ? `Nalezeno ${detailedOrgs.length} unikátních organizací, z toho ${wonOrgsCount} aktivních zákazníků.`
          : `Pro ${searchQuery} jsem nic nenašel.`,
        crmData: {
          organizations: detailedOrgs,
          persons: detailedPersons,
          deals: deduplicatedDeals // Use deduplicated deals
        }
      });
    }

    // ========== CREATE TASK ==========
    if (action === 'create_task') {
      const taskText = params.taskText || message.replace(/vytvoř.*úkol/i, '').trim();
      return c.json({
        success: true,
        action: 'task_created',
        response: `✅ Úkol vytvořen: "${taskText}"`,
        taskText,
        voiceSummary: `Úkol vytvořen: ${taskText}`
      });
    }

    // ========== CREATE CALENDAR EVENT ==========
    if (action === 'create_calendar') {
    if (!googleAccessToken) {
        return c.json({ 
          success: false,
          response: '❌ Pro plánování schůzek se nejprve připojte ke Google účtu v Nastavení.',
          voiceSummary: 'Nejste připojeni ke Google kalendáři.'
        });
      }

      const eventText = params.eventText || message;
      const today = new Date().toISOString().split('T')[0];
      
      // Parse event with Gemini
      const parsePrompt = `Analyzuj text a extrahuj info o schůzce: "${eventText}"
Dnes je ${today}.
Vrať JSON: { "title": "název", "date": "YYYY-MM-DD", "time": "HH:MM", "location": "místo nebo null" }`;

      const parseResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: parsePrompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      let eventTitle = "Schůzka";
      let eventDate = today;
      let eventTime = "10:00";
      let eventLocation = "";

      if (parseResp.ok) {
        const parsed = JSON.parse((await parseResp.json()).candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        if (parsed.title) eventTitle = parsed.title;
        if (parsed.date) eventDate = parsed.date;
        if (parsed.time) eventTime = parsed.time;
        if (parsed.location) eventLocation = parsed.location;
      }

      const startDateTime = new Date(`${eventDate}T${eventTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

      const event: any = {
        summary: eventTitle,
        start: { dateTime: startDateTime.toISOString(), timeZone: "Europe/Prague" },
        end: { dateTime: endDateTime.toISOString(), timeZone: "Europe/Prague" }
      };
      if (eventLocation) event.location = eventLocation;

      const createResp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

      if (createResp.ok) {
        const created = await createResp.json();
        return c.json({
          success: true,
          action: 'calendar_created',
          response: `✅ Schůzka naplánována!\n\n📅 **${eventTitle}**\n⏰ ${eventDate} v ${eventTime}${eventLocation ? `\n📍 ${eventLocation}` : ''}\n\n[🔗 Otevřít v kalendáři](${created.htmlLink})`,
          voiceSummary: `Schůzka naplánována na ${eventDate} v ${eventTime}.`,
          calendarLink: created.htmlLink
        });
      } else {
        return c.json({
          success: false,
          response: '❌ Nepodařilo se vytvořit schůzku. Zkuste se znovu přihlásit.',
          voiceSummary: 'Nepodařilo se vytvořit schůzku.'
        });
      }
    }

    // ========== READ CALENDAR ==========
    if (action === 'read_calendar') {
      if (!googleAccessToken) {
        return c.json({
          success: false,
          response: '❌ Pro zobrazení kalendáře se nejprve připojte ke Google účtu v Nastavení.',
          voiceSummary: 'Nejste připojeni ke Google kalendáři.'
        });
      }

      const calendarDate = params.calendarDate || 'today';
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let timeMin: Date, timeMax: Date;
      
      if (calendarDate === 'today') {
        timeMin = today;
        timeMax = new Date(today);
        timeMax.setDate(timeMax.getDate() + 1);
      } else if (calendarDate === 'tomorrow') {
        timeMin = new Date(today);
        timeMin.setDate(timeMin.getDate() + 1);
        timeMax = new Date(timeMin);
        timeMax.setDate(timeMax.getDate() + 1);
      } else if (calendarDate === 'this_week') {
        timeMin = today;
        timeMax = new Date(today);
        timeMax.setDate(timeMax.getDate() + 7);
      } else {
        // Specific date YYYY-MM-DD
        timeMin = new Date(calendarDate);
        timeMin.setHours(0, 0, 0, 0);
        timeMax = new Date(timeMin);
        timeMax.setDate(timeMax.getDate() + 1);
      }

      console.log(`[Orchestrator] Reading calendar from ${timeMin.toISOString()} to ${timeMax.toISOString()}`);

      const calendarResp = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${googleAccessToken}`
          }
        }
      );

      if (!calendarResp.ok) {
        const errText = await calendarResp.text();
        console.error("Calendar read error:", errText);
        if (calendarResp.status === 401) {
          return c.json({
            success: false,
            response: '❌ Google token vypršel. Přihlaste se znovu v Nastavení.',
            voiceSummary: 'Token vypršel, přihlaste se znovu.'
          });
        }
        return c.json({
          success: false,
          response: '❌ Nepodařilo se načíst kalendář.',
          voiceSummary: 'Nepodařilo se načíst kalendář.'
        });
      }

      const calendarData = await calendarResp.json();
      const events = calendarData.items || [];

      if (events.length === 0) {
        const dateLabel = calendarDate === 'today' ? 'dnes' : 
                         calendarDate === 'tomorrow' ? 'zítra' :
                         calendarDate === 'this_week' ? 'tento týden' :
                         `na ${calendarDate}`;
        return c.json({
          success: true,
          action: 'read_calendar',
          response: `📅 Nemáte ${dateLabel} žádné události v kalendáři.`,
          voiceSummary: `Nemáte ${dateLabel} žádné naplánované události.`
        });
      }

      // Format events
      let responseText = `📅 **Vaše události`;
      const dateLabel = calendarDate === 'today' ? ' dnes' : 
                       calendarDate === 'tomorrow' ? ' zítra' :
                       calendarDate === 'this_week' ? ' tento týden' :
                       ` (${calendarDate})`;
      responseText += dateLabel + `** (${events.length}):\n\n`;

      const eventSummaries: string[] = [];
      for (const event of events) {
        const start = event.start?.dateTime || event.start?.date;
        const startTime = start ? new Date(start).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : 'Celý den';
        const title = event.summary || 'Bez názvu';
        const location = event.location ? ` 📍 ${event.location}` : '';
        
        responseText += `• **${startTime}** - ${title}${location}\n`;
        eventSummaries.push(`${startTime} ${title}`);
      }

      const voiceSummary = events.length === 1 
        ? `Máte jednu událost: ${eventSummaries[0]}.`
        : `Máte ${events.length} událostí. ${eventSummaries.slice(0, 3).join(', ')}.`;

      return c.json({
        success: true,
        action: 'read_calendar',
        response: responseText,
        voiceSummary,
        calendarEvents: events
      });
    }

    // ========== LOCATION DETAIL ==========
    // ========== CONTACT LOOKUP - Find specific contact ==========
    if (action === 'contact_lookup' && pipedriveToken) {
      const orgName = params.organizationName || '';
      const contactRole = params.contactRole || 'kontaktní osoba';
      console.log("[Orchestrator] Contact lookup:", orgName, "role:", contactRole);

      // Search for organization
      const orgSearchResp = await fetch(
        `${PIPEDRIVE_BASE}/itemSearch?term=${encodeURIComponent(orgName)}&item_types=organization&api_token=${pipedriveToken}&limit=5`
      );

      let org: any = null;
      let persons: any[] = [];
      
      if (orgSearchResp.ok) {
        const orgData = await orgSearchResp.json();
        const orgs = orgData.data?.items || [];
        if (orgs.length > 0) {
          org = orgs[0].item;
          
          // Get persons linked to this organization
          const personsResp = await fetch(
            `${PIPEDRIVE_BASE}/organizations/${org.id}/persons?api_token=${pipedriveToken}`
          );
          
          if (personsResp.ok) {
            const personsData = await personsResp.json();
            persons = personsData.data || [];
          }
        }
      }

      if (!org) {
        return c.json({
          success: true,
          action: 'contact_lookup',
          response: `Organizaci "${orgName}" jsem v CRM nenašel. Zkuste jiný název.`,
          voiceSummary: `Organizaci ${orgName} jsem nenašel.`
        });
      }

      if (persons.length === 0) {
        // Try to get org details for phone
        const orgDetailResp = await fetch(`${PIPEDRIVE_BASE}/organizations/${org.id}?api_token=${pipedriveToken}`);
        let orgPhone = '';
        if (orgDetailResp.ok) {
          const orgDetail = await orgDetailResp.json();
          orgPhone = orgDetail.data?.phone?.[0]?.value || '';
        }
        
        const response = orgPhone 
          ? `V organizaci **${org.name}** nemám žádné kontaktní osoby, ale telefon organizace je: **${orgPhone}**`
          : `V organizaci **${org.name}** nemám žádné kontaktní osoby ani telefon.`;
          
        return c.json({
          success: true,
          action: 'contact_lookup',
          response,
          voiceSummary: response.replace(/\*\*/g, '')
        });
      }

      // Format contacts
      const contactList = persons.map((p: any) => {
        const emails = p.email?.map((e: any) => e.value).filter(Boolean) || [];
        const phones = p.phone?.map((ph: any) => ph.value).filter(Boolean) || [];
        return {
          name: p.name,
          email: emails[0] || null,
          phone: phones[0] || null
        };
      });

      // Generate nice response
      const mainContact = contactList[0];
      let response = `**${org.name}**\n\n`;
      
      if (contactList.length === 1) {
        response += `👤 **${mainContact.name}**`;
        if (mainContact.email) response += `\n📧 ${mainContact.email}`;
        if (mainContact.phone) response += `\n📞 ${mainContact.phone}`;
      } else {
        response += `Kontakty (${contactList.length}):\n`;
        contactList.slice(0, 5).forEach((c: any) => {
          response += `\n👤 **${c.name}**`;
          if (c.email) response += ` - 📧 ${c.email}`;
          if (c.phone) response += ` - 📞 ${c.phone}`;
        });
      }

      const voiceSummary = mainContact 
        ? `V ${org.name} je kontakt ${mainContact.name}${mainContact.email ? `, email ${mainContact.email}` : ''}${mainContact.phone ? `, telefon ${mainContact.phone}` : ''}.`
        : `V ${org.name} jsem našel ${contactList.length} kontaktů.`;

      return c.json({
        success: true,
        action: 'contact_lookup',
        response,
        voiceSummary,
        crmData: {
          organization: org,
          persons: contactList
        }
      });
    }

    if (action === 'location_detail' && pipedriveToken) {
      const location = params.location || 'neznámá lokalita';
      console.log("[Orchestrator] Location detail:", location);

      let allOrgs: any[] = [];
      let allPersons: any[] = [];
      let allDeals: any[] = [];

      const searchResp = await fetch(
        `${PIPEDRIVE_BASE}/itemSearch?term=${encodeURIComponent(location)}&item_types=organization,person,deal&api_token=${pipedriveToken}&limit=30`
      );

      if (searchResp.ok) {
        const searchData = await searchResp.json();
        const items = searchData.data?.items || [];
        for (const item of items) {
          if (item.item?.type === 'organization') allOrgs.push(item.item);
          if (item.item?.type === 'person') allPersons.push(item.item);
          if (item.item?.type === 'deal') allDeals.push(item.item);
        }
      }

      // Get person details with phones
      const detailedPersons: any[] = [];
      for (const person of allPersons.slice(0, 15)) {
        const personResp = await fetch(`${PIPEDRIVE_BASE}/persons/${person.id}?api_token=${pipedriveToken}`);
        if (personResp.ok) {
          const personData = await personResp.json();
          detailedPersons.push(personData.data);
        }
      }

      const summary = `Nalezeno ${allOrgs.length} organizací, ${detailedPersons.length} kontaktů a ${allDeals.length} dealů v ${location}.`;

      return c.json({
        success: true,
        action: 'location_detail',
        response: summary,
        summary,
        voiceSummary: summary,
        crmData: {
          organizations: allOrgs,
          persons: detailedPersons,
          deals: allDeals
        }
      });
    }

    // ========== ROUTE PLAN ==========
    if (action === 'route_plan' && googleMapsApiKey && pipedriveToken) {
      const origin = params.origin || 'Praha';
      const destination = params.destination;
      
      if (!destination) {
        return c.json({
          success: true,
          needsClarification: true,
          clarificationQuestion: 'Kam chcete jet? Zadejte cílové město.'
        });
      }

      console.log(`[Orchestrator] Route planning: ${origin} → ${destination}`);

      // Get route from Google Maps
      const routesResp = await fetch(`https://routes.googleapis.com/directions/v2:computeRoutes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleMapsApiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
        },
        body: JSON.stringify({
          origin: { address: origin },
          destination: { address: destination },
          travelMode: 'DRIVE',
          languageCode: 'cs'
        })
      });

      let distance = 0, duration = 0;
      if (routesResp.ok) {
        const routesData = await routesResp.json();
        const route = routesData.routes?.[0];
        duration = Math.round((parseInt(route?.duration?.replace('s', '') || '0')) / 60);
        distance = Math.round((route?.distanceMeters || 0) / 1000);
      }

      // Use Gemini to identify towns along the route - STRICT
      const locationPrompt = `Jsem na cestě z "${origin}" do "${destination}" autem v Česku.

DŮLEŽITÉ: Chci POUZE města a vesnice, kterými PŘÍMO PROJEDU na hlavní silnici.
NEZAHRNUJ města mimo trasu! Například pro Praha→Sedlčany NEZAHRNUJ Suchdol, Černošice, Dobříš.

Vrať POUZE JSON pole měst v pořadí jak na ně narazím (max 12):
["${origin}", "Město2", ..., "${destination}"]`;

      const locResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: locationPrompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      let locations: string[] = [];
      if (locResp.ok) {
        const locData = await locResp.json();
        try {
          locations = JSON.parse(locData.candidates?.[0]?.content?.parts?.[0]?.text || "[]");
        } catch { locations = []; }
      }

      // Search CRM for each location
      const allOrgs: any[] = [];
      const allDeals: any[] = [];
      const locationMatches: { [key: string]: any[] } = {};

      for (const location of locations.slice(0, 15)) {
        const searchResp = await fetch(
          `${PIPEDRIVE_BASE}/itemSearch?term=${encodeURIComponent(location)}&item_types=organization,deal&api_token=${pipedriveToken}&limit=10`
        );
        
        if (searchResp.ok) {
        const searchData = await searchResp.json();
          const items = searchData.data?.items || [];
          
          const orgs = items.filter((i: any) => i.item?.type === 'organization').map((i: any) => ({ ...i.item, matchedLocation: location }));
          const deals = items.filter((i: any) => i.item?.type === 'deal').map((i: any) => ({ ...i.item, matchedLocation: location }));
          
          for (const org of orgs) {
            if (!allOrgs.find(o => o.id === org.id)) allOrgs.push(org);
          }
          for (const deal of deals) {
            if (!allDeals.find(d => d.id === deal.id)) allDeals.push(deal);
          }
          
          if (orgs.length > 0 || deals.length > 0) {
            locationMatches[location] = [...orgs, ...deals];
          }
        }
      }

      // Sort deals: WON first
      allDeals.sort((a: any, b: any) => {
        const order = { won: 0, open: 1, lost: 2 };
        return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
      });

      const wonDeals = allDeals.filter(d => d.status === 'won');
      const priorityStops = Object.keys(locationMatches).slice(0, 5);
      
      // Generate Google Maps URL
      const mapsWaypoints = priorityStops.join('|');
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${mapsWaypoints ? `&waypoints=${encodeURIComponent(mapsWaypoints)}` : ''}&travelmode=driving`;

      const summary = `🗺️ **Trasa ${origin} → ${destination}**\n📏 ${distance} km, ⏱️ ~${duration} min\n\n📍 **Města na trase:** ${locations.slice(0, 8).join(', ')}\n\n🏢 **CRM výsledky:** ${allOrgs.length} organizací, ${allDeals.length} dealů (${wonDeals.length} vyhráno)\n\n${priorityStops.length > 0 ? `✅ **Doporučené zastávky:** ${priorityStops.join(', ')}` : ''}\n\n[🗺️ Otevřít v Google Maps](${googleMapsUrl})`;

      return c.json({
        success: true,
        action: 'route_planned',
        response: summary,
        voiceSummary: `Trasa z ${origin} do ${destination} je ${distance} kilometrů. Nalezeno ${allOrgs.length} organizací a ${wonDeals.length} vyhraných dealů.${priorityStops.length > 0 ? ` Doporučuji zastavit v ${priorityStops.slice(0, 2).join(' a ')}.` : ''}`,
        routeData: {
          route: { origin, destination, distance, duration, googleMapsUrl },
          locations,
          priorityStops,
          crm: { organizations: allOrgs, deals: allDeals, locationMatches }
        }
      });
    }

    // ========== GENERAL RESPONSE: pgvector chunky + Gemini (jako Web operátor / admin RAG), pak záloha KV ==========
    const pgCtx = await fetchPgvectorRagChunksForOrchestrator(message, { topK: 12 });
    if (pgCtx?.context) {
      const answerPromptPg = `Jsi obchodní pomocník Vividbooks (digitální interaktivní učebnice pro školy). Odpověz česky, srozumitelně a profesionálně.

ZNALOSTNÍ KNIHOVNA — obsah z webového RAG (stejný index jako Web operátor; plné chunky z pgvector):
${pgCtx.context}

${historyText}AKTUÁLNÍ ZPRÁVA UŽIVATELE: "${message}"
${copywritingInstructions}
${intent.response ? `NÁVRH ODPOVĚDI Z PRVNÍ ANALÝZY (můžeš ho vylepšit nebo ignorovat, pokud je nepřesný): ${intent.response}` : ""}

Pravidla:
- Vycházej primárně ze znalostní knihovny; uváděj konkrétní fakta (názvy produktů, čísla, termíny, odkazy), pokud tam jsou.
- Nevymýšlej údaje, které nejsou v knihovně nebo v běžných znalostech o Vividbooks.
- Pokud uživatel žádá obsahový text o předmětu (např. „napiš o českém jazyce“) a knihovna obsahuje hlavně katalog produktů: stručně shrň z knihovny, co Vividbooks nabízí, a dopln 2–4 věty obecného kontextu o předmětu (běžné vzdělávací znalosti), aby odpověď nebyla jen omluva „nemáme učebnici“ — pokud dotaz zjevně není nákupní.
- Pokud uživatel chce konkrétní školu, kontakt, kód nebo deal z CRM, stručně řekni, že to vyhledá zadáním města nebo názvu školy do asistenta (nebo v mapě), případně klepnutím na výsledek — ty sám CRM v této odpovědi neprohledáváš.
- Použij Markdown (tučné, odrážky), kde to zlepší čitelnost.

Vrať POUZE JSON:
{ "response": "text odpovědi", "voiceSummary": "max 2 krátké věty pro hlasový výstup" }`;

      try {
        const genRespPg = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: answerPromptPg }] }],
              generationConfig: { response_mime_type: "application/json" },
            }),
          },
        );
        if (genRespPg.ok) {
          const genDataPg = await genRespPg.json();
          const parsedPg = JSON.parse(genDataPg.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
          const responseTextPg =
            typeof parsedPg.response === "string" && parsedPg.response.trim()
              ? parsedPg.response.trim()
              : intent.response ||
                "Jak vám mohu pomoci? Mohu hledat v CRM, plánovat trasy, vytvářet úkoly nebo schůzky.";
          const voiceOutPg =
            typeof parsedPg.voiceSummary === "string" && parsedPg.voiceSummary.trim()
              ? parsedPg.voiceSummary.trim()
              : responseTextPg.slice(0, 280);
          return c.json({
            success: true,
            action: "general_response",
            response: responseTextPg,
            voiceSummary: voiceOutPg,
            ragSourcesUsed: pgCtx.titles,
            ragPipeline: "pgvector_chunks",
          });
        }
      } catch (e) {
        console.error("[Orchestrator] general_response pgvector generation failed:", e);
      }
    }

    const ragBundle = await fetchRagContextForSalesAssistant(geminiKey, message, historyText);

    if (ragBundle?.context) {
      const answerPrompt = `Jsi obchodní pomocník Vividbooks (digitální interaktivní učebnice pro školy). Odpověz česky, srozumitelně a profesionálně.

ZNALOSTNÍ KNIHOVNA — obsah z webového RAG (stejný index jako v administraci / synchronizace z webu):
${ragBundle.context}

${historyText}AKTUÁLNÍ ZPRÁVA UŽIVATELE: "${message}"
${copywritingInstructions}
${intent.response ? `NÁVRH ODPOVĚDI Z PRVNÍ ANALÝZY (můžeš ho vylepšit nebo ignorovat, pokud je nepřesný): ${intent.response}` : ""}

Pravidla:
- Vycházej primárně ze znalostní knihovny; uváděj konkrétní fakta (názvy produktů, čísla, termíny, odkazy), pokud tam jsou.
- Nevymýšlej údaje, které nejsou v knihovně nebo v běžných znalostech o Vividbooks.
- Pokud uživatel žádá obsahový text o předmětu (např. „napiš o českém jazyce“) a knihovna obsahuje hlavně katalog produktů: stručně shrň z knihovny, co Vividbooks nabízí, a dopln 2–4 věty obecného kontextu o předmětu (běžné vzdělávací znalosti), aby odpověď nebyla jen omluva „nemáme učebnici“ — pokud dotaz zjevně není nákupní.
- Pokud uživatel chce konkrétní školu, kontakt, kód nebo deal z CRM, stručně řekni, že to vyhledá zadáním města nebo názvu školy do asistenta (nebo v mapě), případně klepnutím na výsledek — ty sám CRM v této odpovědi neprohledáváš.
- Použij Markdown (tučné, odrážky), kde to zlepší čitelnost.

Vrať POUZE JSON:
{ "response": "text odpovědi", "voiceSummary": "max 2 krátké věty pro hlasový výstup" }`;

      try {
        const genResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: answerPrompt }] }],
              generationConfig: { response_mime_type: "application/json" },
            }),
          },
        );
        if (genResp.ok) {
          const genData = await genResp.json();
          const parsed = JSON.parse(genData.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
          const responseText =
            typeof parsed.response === "string" && parsed.response.trim()
              ? parsed.response.trim()
              : intent.response ||
                "Jak vám mohu pomoci? Mohu hledat v CRM, plánovat trasy, vytvářet úkoly nebo schůzky.";
          const voiceOut =
            typeof parsed.voiceSummary === "string" && parsed.voiceSummary.trim()
              ? parsed.voiceSummary.trim()
              : responseText.slice(0, 280);
          return c.json({
            success: true,
            action: "general_response",
            response: responseText,
            voiceSummary: voiceOut,
            ragSourcesUsed: ragBundle.titles,
          });
        }
      } catch (e) {
        console.error("[Orchestrator] RAG general_response generation failed:", e);
      }
    }

    return c.json({
      success: true,
      action: "general_response",
      response:
        intent.response ||
        "Jak vám mohu pomoci? Mohu hledat v CRM, plánovat trasy, vytvářet úkoly nebo schůzky.",
      voiceSummary: intent.response || "Jak vám mohu pomoci?",
    });

  } catch (error: any) {
    console.error("[Orchestrator] Error:", error);
    return c.json({
      success: false,
      needsClarification: true,
      clarificationQuestion: 'Omlouvám se, něco se pokazilo. Můžete to zkusit znovu?',
      error: error.message
    });
  }
});

// AGENT UNDERSTAND - AI intent detection with clarification (legacy, kept for compatibility)
app.post("/make-server-954b19ad/agent/understand", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    if (!geminiKey) return c.json({ error: "Missing API key" }, 500);

    const { message, conversationHistory = [] } = await c.req.json();
    if (!message) return c.json({ error: "Missing message" }, 400);

    // Build conversation context
    const historyText = conversationHistory.length > 0 
      ? `Předchozí konverzace:\n${conversationHistory.map((m: any) => `${m.role}: ${m.content}`).join('\n')}\n\n`
      : '';

    const understandPrompt = `Jsi inteligentní asistent Vítka Škopa. Analyzuj uživatelovu zprávu a rozhodni co dělat.

${historyText}Aktuální zpráva uživatele: "${message}"

TVOJE SCHOPNOSTI:
1. CRM hledání (Pipedrive) - školy, organizace, kontakty, dealy, přístupové kódy
2. Plánování tras - cesty mezi městy s vyhledáním škol/zákazníků
3. Vytváření úkolů - připomenutí, to-do
4. Plánování schůzek - Google kalendář
5. Obecná konverzace - odpovědi na otázky

PRAVIDLA:
- Pokud zpráva NENÍ JASNÁ nebo chybí důležité detaily → ptej se!
- Pokud uživatel chce něco v CRM ale nespecifikoval CO/KDE → ptej se!
- Pokud rozumíš → navrhni akci

Vrať POUZE JSON:
{
  "understood": true/false,
  "needsClarification": true/false,
  "clarificationQuestion": "Upřesňující otázka pokud needsClarification=true",
  "action": "crm_search" | "route_plan" | "create_task" | "schedule_meeting" | "general_response" | null,
  "query": "hledaný výraz pro CRM nebo parametry pro akci",
  "response": "přímá odpověď pokud action=general_response",
  "confidence": 0.0-1.0
}

PŘÍKLADY:
- "Jaké školy jsou kolem Sedlčan?" → action: "crm_search", query: "školy Sedlčany okolí"
- "Dej mi info" → needsClarification: true, clarificationQuestion: "O čem přesně chcete informace? Organizace, kontakt, nebo deal?"
- "Ahoj" → action: "general_response", response: "Ahoj! Jak vám mohu pomoci?"
- "aktivní školy" → needsClarification: true, clarificationQuestion: "V jaké oblasti hledáte aktivní školy?"`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: understandPrompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API failed: ${response.status}`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");

    return c.json({
      success: true,
      ...parsed
    });

  } catch (error: any) {
    console.error("Agent understand error:", error);
    return c.json({ 
      success: false,
      needsClarification: true,
      clarificationQuestion: "Omlouvám se, nerozuměl jsem. Můžete to zopakovat jinak?",
      error: error.message 
    }, 200); // Return 200 so frontend can handle gracefully
  }
});

// TRAVEL TIME CALCULATION - Google Maps Distance Matrix API
app.post("/make-server-954b19ad/travel-times", async (c) => {
  try {
    const { locations } = await c.req.json();
    const googleMapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    console.log("[Travel Times] API Key present:", !!googleMapsKey, "Locations:", locations?.length);

    if (!googleMapsKey) {
      // Fallback: estimate based on distance (rough: 50km = 30min)
      const travelTimes: { from: string; to: string; durationMinutes: number; durationText: string }[] = [];
      for (let i = 0; i < locations.length - 1; i++) {
        // Rough estimate - 45 minutes average between locations
        travelTimes.push({
          from: locations[i],
          to: locations[i + 1],
          durationMinutes: 45,
          durationText: "~45 min (odhad)"
        });
      }
      return c.json({ travelTimes, estimated: true });
    }

    // Use Google Maps Distance Matrix API for accurate times
    const travelTimes: { from: string; to: string; durationMinutes: number; durationText: string }[] = [];
    
    for (let i = 0; i < locations.length - 1; i++) {
      const origin = encodeURIComponent(locations[i]);
      const destination = encodeURIComponent(locations[i + 1]);
      
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=driving&language=cs&key=${googleMapsKey}`;
      console.log("[Travel Times] Fetching:", locations[i], "→", locations[i + 1]);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log("[Travel Times] Response status:", data.status, "Element status:", data.rows?.[0]?.elements?.[0]?.status);
      
      if (response.ok && data.status === "OK") {
        const element = data.rows?.[0]?.elements?.[0];
        
        if (element?.status === "OK") {
          const durationSeconds = element.duration.value;
          const durationMinutes = Math.round(durationSeconds / 60);
          
          // Format duration text
          let durationText = "";
          if (durationMinutes >= 60) {
            const hours = Math.floor(durationMinutes / 60);
            const mins = durationMinutes % 60;
            durationText = mins > 0 ? `${hours} hod, ${mins} min` : `${hours} hod`;
          } else {
            durationText = `${durationMinutes} min`;
          }
          
          travelTimes.push({
            from: locations[i],
            to: locations[i + 1],
            durationMinutes,
            durationText
          });
        } else {
          // Element status not OK - fallback
          console.log("[Travel Times] Element not OK, using fallback");
          travelTimes.push({
            from: locations[i],
            to: locations[i + 1],
            durationMinutes: 30,
            durationText: "~30 min"
          });
        }
      } else {
        // API error - fallback for this pair
        console.log("[Travel Times] API error or bad status, using fallback. Error:", data.error_message || data.status);
        travelTimes.push({
          from: locations[i],
          to: locations[i + 1],
          durationMinutes: 30,
          durationText: "~30 min"
        });
      }
    }
    
    return c.json({ travelTimes, estimated: false });

  } catch (error: any) {
    console.error("Travel times error:", error);
    return c.json({ error: error.message, travelTimes: [] }, 500);
  }
});

// Get organizations from Pipedrive for outreach
app.post('/make-server-954b19ad/outreach/organizations', async (c) => {
  try {
    const { searchTerm, filterType, filterPosition } = await c.req.json();
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    
    if (!pipedriveToken) {
      return c.json({ error: 'Pipedrive not configured' }, 400);
    }

    console.log(`[Outreach] Loading organizations: search="${searchTerm}", type=${filterType}, position=${filterPosition}`);

    // Search organizations in Pipedrive
    let url = `https://api.pipedrive.com/v1/organizations?limit=100&api_token=${pipedriveToken}`;
    if (searchTerm) {
      url = `https://api.pipedrive.com/v1/itemSearch?term=${encodeURIComponent(searchTerm)}&item_types=organization&limit=100&api_token=${pipedriveToken}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
      return c.json({ error: 'Failed to fetch organizations' }, 500);
    }

    const rawOrgs = searchTerm 
      ? (data.data?.items || []).map((item: any) => item.item)
      : (data.data || []);

    // Fetch contacts for each organization
    const organizations = await Promise.all(rawOrgs.slice(0, 50).map(async (org: any) => {
      // Get persons for this org
      const personsUrl = `https://api.pipedrive.com/v1/organizations/${org.id}/persons?limit=20&api_token=${pipedriveToken}`;
      const personsRes = await fetch(personsUrl);
      const personsData = await personsRes.json();
      
      // Check if customer (has won deals)
      const dealsUrl = `https://api.pipedrive.com/v1/organizations/${org.id}/deals?status=won&limit=1&api_token=${pipedriveToken}`;
      const dealsRes = await fetch(dealsUrl);
      const dealsData = await dealsRes.json();
      const isCustomer = dealsData.success && dealsData.data?.length > 0;

      const contacts = (personsData.data || []).map((person: any) => ({
        id: person.id,
        name: person.name,
        email: person.primary_email || person.email?.[0]?.value || '',
        phone: person.phone?.[0]?.value || '',
        position: person['5e4b5c5d1a6c5e4b5c5d1a6c'] || '', // Custom field for position
        orgId: org.id,
        orgName: org.name
      }));

      // Filter by position if specified
      const filteredContacts = filterPosition 
        ? contacts.filter((c: any) => c.position?.toLowerCase().includes(filterPosition.toLowerCase()))
        : contacts;

      return {
        id: org.id,
        name: org.name,
        address: org.address || '',
        label: org.label || '',
        isCustomer,
        contacts: filteredContacts
      };
    }));

    // Filter by type
    let filteredOrgs = organizations;
    if (filterType === 'customers') {
      filteredOrgs = organizations.filter(o => o.isCustomer);
    } else if (filterType === 'prospects') {
      filteredOrgs = organizations.filter(o => !o.isCustomer);
    }

    return c.json({ organizations: filteredOrgs });

  } catch (error) {
    console.error('[Outreach] Error loading organizations:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Generate email sequence using AI
app.post('/make-server-954b19ad/outreach/generate-emails', async (c) => {
  try {
    const { goal, organizations } = await c.req.json();
    
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG") || Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return c.json({ error: 'Gemini not configured' }, 400);
    }
    
    console.log(`[Outreach] Generating emails for ${organizations?.length || 0} organizations, goal: ${goal?.substring(0, 50)}...`);

    // Load RAG documents for context
    let ragContext = '';
    try {
      const index = await kv.get("rag_index") || [];
      if (index.length > 0) {
        const docs = await Promise.all(index.map(async (doc: any) => await kv.get(`rag_doc_${doc.id}`)));
        ragContext = docs.filter(Boolean).map((d: any) => `--- ${d.title} ---\n${d.content}`).join('\n\n');
        console.log(`[Outreach] Loaded ${docs.filter(Boolean).length} RAG documents`);
      }
    } catch (e) {
      console.error('[Outreach] Failed to load RAG:', e);
    }

    const emails: any[] = [];
    const processedEmails = new Set<string>();

    for (const org of organizations || []) {
      // Take only first contact per org to avoid duplicates
      const contact = org.contacts?.[0];
      if (!contact || !contact.email || processedEmails.has(contact.email)) continue;
      processedEmails.add(contact.email);

      const prompt = `Jsi Vítek Škop z firmy Vividbooks. Piš krátké, osobní a konkrétní obchodní emaily.

O VIVIDBOOKS (použij tyto informace):
${ragContext || 'Vividbooks vytváří interaktivní digitální učebnice pro základní a střední školy. Nabízíme matematiku, fyziku a další předměty.'}

CÍL EMAILU: ${goal}
ŠKOLA: ${org.name}
ADRESÁT: ${contact.name}${contact.position ? ` (${contact.position})` : ''}

PRAVIDLA:
1. MAX 60 slov v těle emailu
2. Piš jako člověk člověku, ne jako robot
3. Zmiň konkrétní přínos pro jejich školu
4. Žádné fráze typu "Doufám, že se máte dobře", "Rád bych Vám představil"
5. Použij informace z kontextu o Vividbooks

Vrať POUZE JSON:
{"subject": "stručný předmět", "body": "text emailu bez podpisu"}

Podpis přidám automaticky: Vítek Škop, vitek@vividbooks.com, 728 417 279`;

      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7 }
            })
          }
        );

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          
          try {
            const emailData = JSON.parse(text);
            const signature = '\n\nS pozdravem,\nVítek Škop\nvitek@vividbooks.com\n728 417 279';
            
            // Create initial + 2 follow-ups
            ['initial', 'followup1', 'followup2'].forEach((type, idx) => {
              let body = emailData.body;
              if (idx === 1) {
                body = `Dobrý den,\n\nnavazuji na svůj předchozí email. Stále platí nabídka ${goal?.substring(0, 50) || 'spolupráce'}. Máte zájem o krátký hovor?`;
              } else if (idx === 2) {
                body = `Dobrý den,\n\nposílám poslední připomínku. Pokud nemáte zájem, dejte mi prosím vědět a nebudu dále obtěžovat.`;
              }
              
              emails.push({
                id: `${org.id}-${contact.id}-${type}`,
                subject: idx === 0 ? emailData.subject : `Re: ${emailData.subject}`,
                body: body + signature,
                to: contact,
                type,
                approved: false,
                sent: false
              });
            });
          } catch (e) {
            console.log(`[Outreach] Failed to parse email for ${org.name}`);
          }
        }
      } catch (e) {
        console.error(`[Outreach] Error generating email for ${org.name}:`, e);
      }
    }

    return c.json({ emails });

  } catch (error) {
    console.error('[Outreach] Error generating emails:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Scrape schools for contacts
app.post('/make-server-954b19ad/outreach/scrape-schools', async (c) => {
  try {
    const { query, region, schools } = await c.req.json();
    
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG") || Deno.env.get("GEMINI_API_KEY");
    const pipedriveToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    
    if (!geminiKey) {
      return c.json({ error: 'Gemini not configured' }, 400);
    }
    
    console.log(`[Outreach Scraping] Query: "${query}", Region: "${region}", Schools: ${schools?.length || 0}`);
    
    const contacts: any[] = [];
    const processedSchools = new Set<string>();
    
    // Process each school
    for (const school of (schools || []).slice(0, 15)) { // Limit to 15 schools for now
      if (processedSchools.has(school.name)) continue;
      processedSchools.add(school.name);
      
      let foundWebContacts = false;
      
      // If school has website, try to scrape it
      if (school.website && firecrawlKey) {
        try {
          const websiteUrl = school.website.startsWith('http') 
            ? school.website 
            : `https://${school.website}`;
          
          // Scrape main page
          console.log(`[Scraping] Scraping: ${websiteUrl}`);
          const crawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
        headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${firecrawlKey}`,
            },
            body: JSON.stringify({ 
              url: websiteUrl,
              formats: ['markdown']
            })
          });
          
          let markdown = '';
          if (crawlResponse.ok) {
            const crawlData = await crawlResponse.json();
            markdown = crawlData.data?.markdown || '';
            console.log(`[Scraping] Got ${markdown.length} chars from ${websiteUrl}`);
          } else {
            console.log(`[Scraping] Failed to scrape ${websiteUrl}: ${crawlResponse.status}`);
          }
          console.log(`[Scraping] Best markdown length: ${markdown.length} for ${school.name}`);
          
          // Use Gemini to extract contacts from the scraped content
          if (markdown.length > 100) {
              const extractPrompt = `Analyzuj obsah webu školy a najdi VŠECHNY kontaktní informace.

Škola: ${school.name}
Město: ${school.city || region}
Hledám především: ${query}

Obsah webu:
${markdown.substring(0, 8000)}

INSTRUKCE:
1. Najdi VŠECHNY e-mailové adresy na stránce
2. Pro každý email najdi přidružené jméno a pozici (pokud jsou uvedeny)
3. Pokud jméno není uvedeno, použij pozici nebo "Kontakt"
4. Hledej zejména: ředitel, zástupce, učitele, sekretariát

Vrať JSON pole. KAŽDÝ nalezený email musí být v odpovědi:
[{"name": "jméno nebo pozice", "position": "pozice", "email": "email@skola.cz", "phone": "tel pokud je"}]

POUZE JSON, bez komentářů:`;

              const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: extractPrompt }] }],
                    generationConfig: { temperature: 0.1 }
                  })
                }
              );

          if (geminiResponse.ok) {
            const geminiData = await geminiResponse.json();
            let extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
            
            // Clean up JSON
            extractedText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            try {
              const extracted = JSON.parse(extractedText);
              console.log(`[Scraping] Extracted ${extracted.length} contacts from ${school.name}`);
              for (const person of extracted) {
                // Validate email format
                const emailValid = person.email && /^[\w\.\-]+@[\w\.\-]+\.[a-z]{2,}$/i.test(person.email);
                if (person.name && emailValid) {
                  contacts.push({
                    name: person.name,
                    email: person.email || '',
                    phone: person.phone || '',
                    position: person.position || '',
                    subject: person.subject || '',
                    schoolName: school.name,
                    schoolCity: school.city || '',
                    source: 'web',
                    relevance: 90 // Higher relevance for web-scraped contacts
                  });
                  foundWebContacts = true;
                }
              }
            } catch (parseErr) {
              console.log(`[Scraping] Failed to parse contacts for ${school.name}`);
            }
          }
          
          // Fallback: Extract emails with regex if AI didn't find any
          if (!foundWebContacts && markdown.length > 100) {
            const emailRegex = /[\w\.\-]+@[\w\.\-]+\.[a-z]{2,}/gi;
            const emails = [...new Set(markdown.match(emailRegex) || [])];
            console.log(`[Scraping] Regex found ${emails.length} emails for ${school.name}`);
            
            for (const email of emails.slice(0, 3)) { // Max 3 emails per school
              if (!email.includes('example') && !email.includes('test')) {
                contacts.push({
                  name: 'Kontakt',
                  email: email,
                  phone: '',
                  position: 'Obecný kontakt',
                  schoolName: school.name,
                  schoolCity: school.city || '',
                  source: 'web-regex',
                  relevance: 75
                });
                foundWebContacts = true;
              }
            }
          }
          } // end if (markdown.length > 100)
        } catch (err) {
          console.error(`[Scraping] Error scraping ${school.website}:`, err);
        }
      }
      
      // Only add director from registry if we didn't find contacts from web
      if (!foundWebContacts && (school.director || school.email)) {
        contacts.push({
          name: school.director || 'Ředitel/ka školy',
          email: school.email || '',
          phone: school.phone || '',
          position: 'Ředitel',
          schoolName: school.name,
          schoolCity: school.city || '',
          source: 'registry',
          relevance: 70
        });
      }
    }
    
    // Try to match with Pipedrive to identify customers
    if (pipedriveToken && contacts.length > 0) {
      const schoolNames = [...new Set(contacts.map(c => c.schoolName))];
      
      for (const schoolName of schoolNames) {
        try {
          // Search Pipedrive for this school
          const searchUrl = `https://api.pipedrive.com/v1/itemSearch?term=${encodeURIComponent(schoolName)}&item_types=organization&limit=5&api_token=${pipedriveToken}`;
          const searchRes = await fetch(searchUrl);
          const searchData = await searchRes.json();
          
          if (searchData.success && searchData.data?.items?.length > 0) {
            const org = searchData.data.items[0].item;
            
            // Check if customer by looking at deals
            let isCustomer = false;
            if (org.id) {
              const dealsUrl = `https://api.pipedrive.com/v1/organizations/${org.id}/deals?status=won&limit=1&api_token=${pipedriveToken}`;
              const dealsRes = await fetch(dealsUrl);
              const dealsData = await dealsRes.json();
              isCustomer = dealsData.success && dealsData.data?.length > 0;
            }
            
            // Update contacts with Pipedrive match
            for (const contact of contacts) {
              if (contact.schoolName === schoolName) {
                contact.pipedriveMatch = {
                  orgId: org.id,
                  orgName: org.name,
                  isCustomer
                };
              }
            }
          }
        } catch (err) {
          console.error(`[Scraping] Error matching ${schoolName} with Pipedrive:`, err);
        }
      }
    }
    
    // Sort by relevance
    contacts.sort((a, b) => b.relevance - a.relevance);
    
    console.log(`[Outreach Scraping] Found ${contacts.length} contacts`);

    return c.json({
      success: true, 
      contacts,
      schoolsProcessed: processedSchools.size 
    });

  } catch (error) {
    console.error('[Outreach Scraping] Error:', error);
    return c.json({ error: error.message }, 500);
  }
});

Deno.serve(app.fetch);
