import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { Buffer } from "node:buffer";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: [
      'https://new.vividbooks.com',
      'https://project-e4jce.vercel.app',
      'https://vividbooks.com',
      'https://www.vividbooks.com',
      'http://localhost:3000',
      'https://localhost:3000',
      'http://127.0.0.1:3000',
      'https://127.0.0.1:3000',
      'http://localhost:5173',
      'https://localhost:5173',
      'http://127.0.0.1:5173',
      'https://127.0.0.1:5173',
      'http://localhost',
      'https://localhost',
      'http://127.0.0.1',
      'https://127.0.0.1',
    ],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-954b19ad/health", (c) => {
  return c.json({ status: "ok" });
});

// Storage Endpoints
app.get("/make-server-954b19ad/storage/:key", async (c) => {
  const key = c.req.param("key");
  try {
    const value = await kv.get(key);
    return c.json({ value });
  } catch (error) {
    console.error(`Error fetching key ${key}:`, error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
});

app.post("/make-server-954b19ad/storage", async (c) => {
  try {
    const body = await c.req.json();
    const { key, value } = body;
    
    if (!key) {
      return c.json({ error: "Key is required" }, 400);
    }

    await kv.set(key, value);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error saving data:", error);
    return c.json({ error: "Failed to save data" }, 500);
  }
});

// 1. TRANSCRIPTION (Google Cloud Speech-to-Text)
app.post("/make-server-954b19ad/transcribe", async (c) => {
  try {
    const googleApiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    
    if (!googleApiKey) {
        console.error("GEMINI_API_KEY_RAG not found.");
        return c.json({ error: "API Key not found." }, 500);
    }

    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No audio file provided" }, 400);
    }

    console.log(`Processing with Google Cloud STT. File: ${file.name}, size: ${file.size}, type: ${file.type}`);

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    
    let encoding = "LINEAR16";
    let sampleRateHertz = undefined;

    if (file.type.includes("webm")) {
      encoding = "WEBM_OPUS";
      sampleRateHertz = 48000; // Explicitly set for Opus
    } else if (file.type.includes("wav") || file.type.includes("wave")) {
      encoding = "LINEAR16";
    } else if (file.type.includes("ogg")) {
      encoding = "OGG_OPUS";
      sampleRateHertz = 48000;
    }

    console.log(`Using encoding: ${encoding} for mime: ${file.type}`);

    const config: any = {
      languageCode: "cs-CZ",
      model: "latest_short",
      encoding: encoding,
      enableAutomaticPunctuation: true,
      useEnhanced: true,
    };

    if (sampleRateHertz) {
      config.sampleRateHertz = sampleRateHertz;
    }

    const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: config,
        audio: {
          content: base64Audio
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Cloud STT Error:", errText);
      throw new Error(`Google STT API failed: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    
    const results = data.results || [];
    const text = results
      .map((result: any) => result.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(" ");

    return c.json({ text: text ? text.trim() : "" });

  } catch (error) {
    console.error("Transcription error:", error);
    return c.json({ error: error.message || "Failed to transcribe audio" }, 500);
  }
});

// 2. SMART EDIT (Updated to GEMINI 3 FLASH PREVIEW)
app.post("/make-server-954b19ad/smart-edit", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    if (!geminiKey) return c.json({ error: "Missing API Key" }, 500);

    const { currentText, newVoiceText, context } = await c.req.json();

    if (!newVoiceText) return c.json({ text: currentText || "", detectedTask: null });

    const systemPrompt = `You are a helpful voice assistant editor acting on behalf of Vítek Škop (Vividbooks s.r.o.).

1. IDENTITY: If asked to sign or provide contact info, use "Vítek Škop" or "Vividbooks".

2. TASK DETECTION (CRITICAL):
   - Analyze ONLY the "New Voice Input".
   - If the user explicitly commands to create a task, appointment, meeting, or reminder (e.g., "naplánuj", "vytvoř schůzku", "připomeň mi", "zapiš úkol", "musím udělat"), you MUST extract this as a "detectedTask".
   - Example: "Vytvoř schůzku příští pátek v ZŠ Hrasice" -> detectedTask: "Schůzka ZŠ Hrasice, příští pátek"
   - Return it in the "detectedTask" field.

3. EDITING vs. INSTRUCTION vs. APPENDING:
   You are provided with "Current Text". This text might be:
     a) A draft the user is writing.
     b) "Context/Background" material the user pasted.
   
   Analyze the "New Voice Input":
   - **Is it an INSTRUCTION?** (e.g., "Odpověz, že nemám čas", "Přepiš to formálně", "Shrň to").
     -> If yes, execute the instruction on the "Current Text". Replace the "Current Text" with the result.
   - **Is it DICTATION?** (e.g., "Ahoj Karle, posílám soubory...").
     -> If yes, APPEND it to the "Current Text" (or insert at cursor if implied). Fix grammar/spelling.
   
   **IMPORTANT:** If the "Current Text" looks like an incoming email and voice input says "Reply...", generate the reply and REPLACE the original text.

OUTPUT JSON FORMAT ONLY:
{
  "text": "The full updated text",
  "detectedTask": "The extracted task string or null"
}`;

    // GEMINI 3 FLASH PREVIEW Implementation
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          parts: [{ text: `Current Text: "${currentText || ""}"\n\nNew Voice Input: "${newVoiceText}"` }]
        }],
        generationConfig: {
          response_mime_type: "application/json",
          // New 2026 Parameter from spec
          thinkingConfig: {
             thinkingLevel: "LOW" 
          }
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini Smart Edit failed: ${response.status}`, errText);
      throw new Error(`Gemini Smart Edit failed: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) throw new Error("No content from Gemini");
    
    // Handle potential "THOUGHT:" output if thinking leaked into text (though LOW shouldn't generally)
    // We assume JSON response based on mime_type config
    const result = JSON.parse(resultText);
    return c.json(result);

  } catch (error) {
    console.error("Smart Edit error:", error);
    return c.json({ error: error.message || "Failed to process text" }, 500);
  }
});

// 3. PARSE TASK (Updated to GEMINI 3 FLASH PREVIEW)
app.post("/make-server-954b19ad/parse-task", async (c) => {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    if (!geminiKey) return c.json({ error: "Missing API Key" }, 500);

    const { text } = await c.req.json();
    if (!text) return c.json({ error: "Text is required" }, 400);

    const systemPrompt = `You are a scheduler helper. Today is Sunday, 2026-01-19.
          
    LOCATION DATABASE:
    - "ZŠ Karlín" -> "Pernerova 26, 186 00 Praha 8"
    - "ZŠ Vinohrady" -> "Makarenka 1, 120 00 Praha 2"
    - "ZŠ Rosice" -> "Pod Zahrádkami 120, 665 01 Rosice"
    - "kancelář" -> "Vividbooks, Křižíkova 148/34, Praha 8"
    
    INSTRUCTIONS:
    1. Extract title, date, time, and location from the user input.
    2. Convert relative terms ("tomorrow", "next friday", "afternoon") to precise ISO dates/times.
    3. Default duration is 1 hour if not specified.
    4. Map locations using the database. If unknown, use the raw location text.
    5. Return valid JSON ONLY.
    
    JSON SCHEMA:
    {
      "title": string,
      "startDate": string (YYYY-MM-DD),
      "startTime": string (HH:MM) or null,
      "endDate": string (YYYY-MM-DD),
      "endTime": string (HH:MM) or null,
      "location": string or null,
      "error": string or null (if no date found)
    }`;

    // GEMINI 3 FLASH PREVIEW Implementation
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          parts: [{ text }]
        }],
        generationConfig: {
          response_mime_type: "application/json",
          // New 2026 Parameter from spec
          thinkingConfig: {
             thinkingLevel: "LOW" 
          }
        }
      })
    });

    if (!response.ok) {
       const errText = await response.text();
       console.error(`Gemini Parse Task failed: ${response.status}`, errText);
       throw new Error(`Gemini Parse Task failed: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) throw new Error("No content from Gemini");

    const result = JSON.parse(resultText);
    return c.json(result);

  } catch (error) {
    console.error("Parse Task error:", error);
    return c.json({ error: error.message || "Failed to parse task" }, 500);
  }
});

// 4. GOOGLE CALENDAR EVENT
app.post("/make-server-954b19ad/calendar/create-event", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Verify User
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
        return c.json({ error: "Invalid user token" }, 401);
    }

    // 2. Get Google Access Token from request body (sent by frontend)
    const { taskText, googleAccessToken } = await c.req.json();

    if (!googleAccessToken) {
        return c.json({ 
            error: "google_auth_required", 
            message: "Prosím, připojte Google Kalendář v nastavení." 
        }, 403);
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY_RAG");

    // 3. Parse Task with Gemini
    const systemPrompt = `Current Time: ${new Date().toISOString()}.
    Extract event details from text: "${taskText}".
    Return JSON: { "summary": string, "location": string, "description": string, "start": { "dateTime": string (ISO) }, "end": { "dateTime": string (ISO) } }.
    Default duration 1h. If no date specified, schedule for tomorrow 10:00.`;

    const geminiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: taskText }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });
    
    const geminiData = await geminiResp.json();
    const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const eventDetails = JSON.parse(resultText || "{}");

    // 4. Create Event in Google Calendar
    const calResp = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(eventDetails)
    });

    if (!calResp.ok) {
        const err = await calResp.text();
        console.error("Google Calendar API Error:", err);
        // Handle token expiration loosely - we rely on frontend to re-auth if needed or refresh logic (which is complex here without refresh token access easily)
        if (calResp.status === 401) {
             return c.json({ error: "token_expired", message: "Platnost připojení vypršela. Připojte kalendář znovu." }, 401);
        }
        return c.json({ error: "Failed to create event", details: err }, 500);
    }

    const event = await calResp.json();
    return c.json({ success: true, link: event.htmlLink });

  } catch (error) {
    console.error("Calendar Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

Deno.serve(app.fetch);
