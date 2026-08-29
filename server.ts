import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality } from '@google/genai';
import OpenAI, { toFile } from 'openai';
import dotenv from 'dotenv';
import multer from 'multer';
import { chromaStore, expandTamilQuery, ChromaQueryResult, ChromaMetadata } from './src/lib/chroma_store';

dotenv.config();

const app = express();
const PORT = 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB max audio for long farmer voice input
});

// Middleware
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Enable CORS for all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// ----------------------------------------------------
// TNSC ACT DATASET & CHROMADB INITIALIZATION
// ----------------------------------------------------

export interface ActChunk {
  id: string;
  section: string;
  subSection: string;
  title: string;
  chapter: string;
  topics: string[];
  text: string;
  summary_en: string;
  summary_ta: string;
  embedding?: number[];
  score?: number;
}

export interface RetrievedSection {
  section: string;
  title: string;
  chapter: string;
  text: string;
  score?: number;
}

let actChunks: ActChunk[] = [];
let actSections: any[] = [];

// Load dataset and populate ChromaDB collection
try {
  const chunksPath = path.join(process.cwd(), 'tnsc_chunks.json');
  if (fs.existsSync(chunksPath)) {
    actChunks = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));
    console.log(`[SahakarMitra] Loaded ${actChunks.length} semantic chunks from tnsc_chunks.json`);
    chromaStore.populateFromActChunks(actChunks);
  }

  const sectionsPath = path.join(process.cwd(), 'tnsc_act_sections.json');
  if (fs.existsSync(sectionsPath)) {
    actSections = JSON.parse(fs.readFileSync(sectionsPath, 'utf-8'));
    console.log(`[SahakarMitra] Loaded ${actSections.length} sections from tnsc_act_sections.json`);
  }
} catch (err) {
  console.error('[SahakarMitra] Error loading datasets:', err);
}

// In-Memory Query Cache (Zero-token instant responses)
const queryResponseCache = new Map<string, { answer: string; cited_section: string | null; translated_answer: string; retrieved_sections: RetrievedSection[] }>();

// Async Warmup for Multi-language Cross-Lingual Embeddings with text-embedding-004
setTimeout(() => {
  chromaStore.computeCrossLingualEmbeddings(process.env.GEMINI_API_KEY).catch((e) => {
    console.warn('[SahakarMitra] Chroma embeddings warmup background notice:', e);
  });
}, 1000);

// ----------------------------------------------------
// CHROMADB MULTI-LANGUAGE RETRIEVAL LOGIC
// ----------------------------------------------------

async function retrieveWithChromaMultiLanguage(query: string, nResults: number = 2): Promise<{
  chunks: ActChunk[];
  queryResult: ChromaQueryResult;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  let queryEmbedding: number[] | null = null;

  if (apiKey) {
    queryEmbedding = await chromaStore.getQueryEmbedding(query, apiKey);
  }

  const chromaRes = chromaStore.collection.query({
    query_texts: [query],
    query_embeddings: queryEmbedding ? [queryEmbedding] : undefined,
    n_results: nResults,
  });

  const chunks: ActChunk[] = [];
  for (let i = 0; i < chromaRes.ids.length; i++) {
    const meta = chromaRes.metadatas[i];
    const doc = chromaRes.documents[i];
    const score = chromaRes.scores[i];

    chunks.push({
      id: chromaRes.ids[i],
      section: meta.section,
      subSection: meta.subSection || '1',
      title: meta.title,
      chapter: meta.chapter,
      topics: meta.topics ? meta.topics.split(', ') : [],
      text: doc,
      summary_en: meta.summary_en,
      summary_ta: meta.summary_ta,
      score,
    });
  }

  return {
    chunks,
    queryResult: chromaRes,
  };
}

function chunksToRetrievedSections(chunks: ActChunk[]): RetrievedSection[] {
  return chunks.map(c => ({
    section: c.section,
    title: c.title,
    chapter: c.chapter,
    text: c.text,
    score: c.score,
  }));
}

// ----------------------------------------------------
// GROUNDED GEMINI GENERATION ENGINE WITH FLUENT TAMIL
// ----------------------------------------------------

async function executeGroundedGeminiOptimized(
  question: string,
  retrievedChunks: ActChunk[],
  targetLang: string = 'ta'
): Promise<{ answer: string; cited_section: string | null; translated_answer: string }> {
  // 1. Check in-memory cache for zero-token instant response
  const cacheKey = `${question.toLowerCase().trim()}_${targetLang}`;
  if (queryResponseCache.has(cacheKey)) {
    console.log(`[SahakarMitra] Cache hit for "${question}" (0 tokens consumed)`);
    const cached = queryResponseCache.get(cacheKey)!;
    return {
      answer: cached.answer,
      cited_section: cached.cited_section,
      translated_answer: cached.translated_answer,
    };
  }

  // If no grounded chunks found
  if (retrievedChunks.length === 0) {
    return {
      answer: "This isn't covered in the Tamil Nadu Cooperative Societies Act.",
      cited_section: null,
      translated_answer: "இது தமிழ்நாடு கூட்டுறவு சங்கங்கள் சட்டம் 1983-ல் குறிப்பிடப்படவில்லை.",
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const top = retrievedChunks[0];

  // Concise context from top matched chunks
  const contextSnippet = retrievedChunks.map(c => 
    `[Section ${c.section} - ${c.title}]: ${c.text}`
  ).join('\n');

  if (apiKey) {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const prompt = `You are SahakarMitra (சககாரமித்ரா), an AI legal assistant for Primary Agricultural Cooperative Societies (PACS) in Tamil Nadu.
STRICT INSTRUCTIONS:
1. Base your answer EXCLUSIVELY on the provided ACT CHUNKS below. Never invent or hallucinate rules.
2. If the question is not covered in the chunks, return answer: "This isn't covered in the Tamil Nadu Cooperative Societies Act."
3. Tamil Fluency Guidelines:
   - Make the "translated_answer" in fluent, natural, polite Tamil that rural farmers and PACS members can easily understand (எளிய மற்றும் தெளிவான தமிழ் நடை).
   - Use standard cooperative terms (e.g. பொதுக்குழு, தேர்தல், தணிக்கை, பயிர்க்கடன், சர்சார்ஜ், தனி அலுவலர்).
   - Clearly state the relevant Section number (சட்டப்பிரிவு).
4. Keep the explanation direct, crisp, and informative (2-3 concise sentences).

ACT CHUNKS:
${contextSnippet}

USER QUESTION (May be in Tamil or English):
${question}

Return ONLY a JSON object with this exact schema:
{
  "answer": "Concise English legal answer referencing exact statutory rule",
  "cited_section": "Section ${top.section}",
  "translated_answer": "சட்டப்பிரிவு ${top.section}-ன் படியான எளிய, தெளிவான, விவசாயிகளுக்கு புரியும் நேரடி தமிழ் விளக்கம்"
}`;

    // Try primary model (gemini-3.7-flash), then fast fallback model (gemini-3.1-flash-lite)
    const modelsToTry = ['gemini-3.7-flash', 'gemini-3.1-flash-lite'];

    for (const modelName of modelsToTry) {
      try {
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500));
        const generatePromise = ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 1000,
            responseMimeType: 'application/json',
          },
        });

        const response: any = await Promise.race([generatePromise, timeoutPromise]);

        if (response && response.text) {
          let text = response.text.trim();
          if (text.startsWith('```')) {
            text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
          }

          try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object' && parsed.answer) {
              const result = {
                answer: parsed.answer,
                cited_section: parsed.cited_section || `Section ${top.section}`,
                translated_answer: parsed.translated_answer || parsed.answer,
              };

              // Cache result
              queryResponseCache.set(cacheKey, {
                ...result,
                retrieved_sections: chunksToRetrievedSections(retrievedChunks),
              });

              return result;
            }
          } catch {
            // continue to fallback
          }
        }
      } catch (err: any) {
        const isQuota = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Quota');
        if (isQuota) {
          console.warn(`[SahakarMitra] ${modelName} quota limit reached, attempting fallback...`);
        } else {
          console.warn(`[SahakarMitra] ${modelName} notice, attempting fallback...`);
        }
      }
    }
  }

  // Deterministic Local Fallback
  const result = {
    answer: `According to Section ${top.section} (${top.title}) of the Tamil Nadu Co-operative Societies Act, 1983: ${top.text}`,
    cited_section: `Section ${top.section}`,
    translated_answer: `சட்டப்பிரிவு ${top.section} (${top.title})-ன் படி: ${top.summary_ta || top.text}`,
  };

  queryResponseCache.set(cacheKey, {
    ...result,
    retrieved_sections: chunksToRetrievedSections(retrievedChunks),
  });

  return result;
}

// ----------------------------------------------------
// AUDIO TRANSCRIPTION (Whisper / Gemini Multimodal)
// ----------------------------------------------------

function normalizeAudioMimeType(mime?: string, filename?: string): string {
  const m = (mime || '').toLowerCase();
  const f = (filename || '').toLowerCase();

  if (m.includes('webm')) return 'audio/webm';
  if (m.includes('wav') || m.includes('wave')) return 'audio/wav';
  if (m.includes('ogg')) return 'audio/ogg';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'audio/mp4';
  if (m.includes('mpeg') || m.includes('mp3')) return 'audio/mp3';
  if (m.includes('flac')) return 'audio/flac';

  if (f.endsWith('.webm')) return 'audio/webm';
  if (f.endsWith('.wav')) return 'audio/wav';
  if (f.endsWith('.ogg')) return 'audio/ogg';
  if (f.endsWith('.mp3')) return 'audio/mp3';
  if (f.endsWith('.m4a') || f.endsWith('.mp4')) return 'audio/mp4';

  return 'audio/webm';
}

async function transcribeSpeechAudio(
  buffer: Buffer,
  rawMime?: string,
  filename?: string,
  targetLang?: string
): Promise<{ text: string; engine: string }> {
  const normMime = normalizeAudioMimeType(rawMime, filename);

  // 1. Try OpenAI Whisper if OPENAI_API_KEY is configured
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const fileExt = normMime.split('/')[1] || 'webm';
      const fileObj = await toFile(buffer, filename || `audio_input.${fileExt}`, {
        type: normMime,
      });

      const whisperResponse = await openai.audio.transcriptions.create({
        file: fileObj,
        model: 'whisper-1',
        language: targetLang === 'ta' ? 'ta' : undefined,
        prompt: 'தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம் (PACS), தமிழ்நாடு கூட்டுறவு சங்கங்கள் சட்டம் 1983, பொதுக்குழு, தேர்தல், தணிக்கை, சர்சார்ஜ், பயிர்க்கடன், முதன்மை உரிமை, நிலம், தள்ளுபடி, உறுப்பினர் நீக்கம், தனி அலுவலர்.',
      });

      const text = whisperResponse.text?.trim() || '';
      if (text) {
        console.log(`[SahakarMitra] OpenAI Whisper transcription: "${text}"`);
        return { text, engine: 'whisper-1' };
      }
    } catch (whisperErr) {
      console.warn('[SahakarMitra] OpenAI Whisper attempt notice:', whisperErr);
    }
  }

  // 2. Gemini Multimodal Audio Transcription
  if (process.env.GEMINI_API_KEY) {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const base64Data = buffer.toString('base64');
    const transcriptionPrompt = `You are a speech-to-text transcriber for farmers and cooperative members in Tamil Nadu.
Listen to this audio recording of a user asking a legal question about Primary Agricultural Cooperative Societies (PACS).
IMPORTANT INSTRUCTIONS FOR LONG SENTENCES:
1. Transcribe the spoken words completely and accurately in Tamil (தமிழ்) or English without omitting any clauses.
2. Even if the speaker uses long compound sentences, multiple clauses, or conversational phrasing, capture the entire question.
3. If no voice or speech is detected, return: "[NO_SPEECH]".
4. Output ONLY the clean transcription text with no markdown tags or conversational filler.`;

    const transcribeModels = ['gemini-3.5-transcribe', 'gemini-3.7-flash', 'gemini-3.1-flash-lite'];

    for (const modelName of transcribeModels) {
      try {
        const transResponse = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: normMime,
                  data: base64Data,
                },
              },
              {
                text: transcriptionPrompt,
              },
            ],
          },
          config: {
            maxOutputTokens: 800,
            temperature: 0.1,
          },
        });

        const text = transResponse.text?.trim() || '';
        if (text && text !== '[NO_SPEECH]') {
          console.log(`[SahakarMitra] Gemini (${modelName}) Audio transcription: "${text}"`);
          return { text, engine: `gemini-${modelName}` };
        }
      } catch (geminiAudioErr: any) {
        const isQuota = geminiAudioErr?.status === 429 || geminiAudioErr?.message?.includes('429');
        if (isQuota) {
          console.warn(`[SahakarMitra] ${modelName} audio quota limit, trying fallback transcription...`);
        } else {
          console.warn(`[SahakarMitra] ${modelName} transcription notice, trying fallback...`);
        }
      }
    }
  }

  return { text: '', engine: 'none' };
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health Check
const handleHealth = (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'SahakarMitra',
    vector_store: 'ChromaDB',
    chroma_collection: chromaStore.collection.name,
    records_indexed: chromaStore.collection.count(),
    cached_queries: queryResponseCache.size,
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', handleHealth);
app.get('/api/health', handleHealth);

// 2. Sections Directory
const handleSections = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    count: actSections.length,
    sections: actSections.map(s => ({
      section: s.section,
      title: s.title,
      chapter: s.chapter,
      text: s.text,
      preview: s.text.substring(0, 140) + '...',
    })),
  });
};

app.get('/sections', handleSections);
app.get('/api/sections', handleSections);

// Static JSON datasets endpoints
app.get('/tnsc_act_sections.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(actSections);
});

app.get('/tnsc_chunks.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(actChunks);
});

// 3. ChromaDB Stats & Query Exploration
const handleChromaStats = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    collection_name: chromaStore.collection.name,
    distance_metric: chromaStore.collection.metadata['hnsw:space'],
    description: chromaStore.collection.metadata.description,
    total_records: chromaStore.collection.count(),
    embedding_model: 'text-embedding-004',
    features: ['cross_lingual_embeddings', 'tamil_morphological_stemmer', 'rrf_hybrid_fusion'],
  });
};

app.get('/chroma/stats', handleChromaStats);
app.get('/api/chroma/stats', handleChromaStats);

const handleChromaQuery = async (req: Request, res: Response) => {
  try {
    const { query, n_results } = req.body;
    if (!query) {
      res.status(400).json({ detail: 'Query is required.' });
      return;
    }

    const { chunks, queryResult } = await retrieveWithChromaMultiLanguage(query, n_results || 3);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      query,
      expanded_query: queryResult.expanded_query,
      retrieval_mode: queryResult.retrieval_mode,
      top_sections: chunksToRetrievedSections(chunks),
      distances: queryResult.distances,
      scores: queryResult.scores,
    });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || String(err) });
  }
};

app.post('/chroma/query', handleChromaQuery);
app.post('/api/chroma/query', handleChromaQuery);

// 4. Ask Question Endpoint (POST /ask & POST /api/ask) - Powered by ChromaDB
const handleAsk = async (req: Request, res: Response) => {
  try {
    const { question, lang } = req.body;
    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ detail: 'Question cannot be empty.' });
      return;
    }

    const trimmedQuestion = question.trim();
    const targetLang = lang || 'ta';

    // Multi-Language Semantic Retrieval with ChromaDB + Stemmed Long Tamil Sentence Matching
    const { chunks: retrievedChunks } = await retrieveWithChromaMultiLanguage(trimmedQuestion, 2);
    const retrievedSections = chunksToRetrievedSections(retrievedChunks);

    const result = await executeGroundedGeminiOptimized(trimmedQuestion, retrievedChunks, targetLang);

    res.json({
      answer: result.answer,
      cited_section: result.cited_section,
      translated_answer: result.translated_answer,
      retrieved_sections: retrievedSections,
    });
  } catch (err: any) {
    console.error('[SahakarMitra] Error in /ask:', err);
    res.status(500).json({ detail: `An error occurred: ${err.message || String(err)}` });
  }
};

app.post('/ask', handleAsk);
app.post('/api/ask', handleAsk);

// 5. Dedicated Audio Transcription Endpoint (POST /transcribe & POST /api/transcribe)
const handleTranscribe = async (req: Request, res: Response) => {
  try {
    let buffer: Buffer | null = null;
    let mimeType = 'audio/webm';
    let filename = 'recording.webm';

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype || 'audio/webm';
      filename = req.file.originalname || 'recording.webm';
    } else if (req.body && req.body.audioBase64) {
      buffer = Buffer.from(req.body.audioBase64, 'base64');
      mimeType = req.body.mimeType || 'audio/webm';
      filename = req.body.filename || 'recording.webm';
    }

    if (!buffer || buffer.length === 0) {
      res.status(400).json({ detail: 'No audio data received.' });
      return;
    }

    const lang = (req.query.lang as string) || req.body?.lang || 'ta';
    const { text, engine } = await transcribeSpeechAudio(buffer, mimeType, filename, lang);

    if (!text) {
      res.status(422).json({
        detail: 'No clear speech detected in the audio. Please speak clearly into your microphone.',
      });
      return;
    }

    res.json({
      transcription: text,
      engine,
    });
  } catch (err: any) {
    console.error('[SahakarMitra] Error in /transcribe:', err);
    res.status(500).json({ detail: `Transcription error: ${err.message || String(err)}` });
  }
};

app.post('/transcribe', upload.single('file'), handleTranscribe);
app.post('/api/transcribe', upload.single('file'), handleTranscribe);

// 6. Voice Q&A Endpoint (POST /voice & POST /api/voice)
const handleVoice = async (req: Request, res: Response) => {
  try {
    const targetLang = (req.query.lang as string) || (req.body && req.body.lang) || 'ta';
    let buffer: Buffer | null = null;
    let mimeType = 'audio/webm';
    let filename = 'recording.webm';

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype || 'audio/webm';
      filename = req.file.originalname || 'recording.webm';
    } else if (req.body && req.body.audioBase64) {
      buffer = Buffer.from(req.body.audioBase64, 'base64');
      mimeType = req.body.mimeType || 'audio/webm';
      filename = req.body.filename || 'recording.webm';
    }

    if (!buffer || buffer.length === 0) {
      res.status(400).json({ detail: 'No audio file provided or audio file is empty.' });
      return;
    }

    console.log(`[SahakarMitra] Processing incoming voice recording (${buffer.length} bytes, ${mimeType})...`);

    // Transcribe with Whisper / Gemini
    const { text: transcribedQuestion, engine } = await transcribeSpeechAudio(buffer, mimeType, filename, targetLang);

    if (!transcribedQuestion) {
      res.status(422).json({
        detail: 'Could not detect clear speech signals in the recording. Please speak clearly into your microphone.',
      });
      return;
    }

    console.log(`[SahakarMitra] Transcribed [${engine}]: "${transcribedQuestion}"`);

    // Retrieve relevant semantic chunks using ChromaDB
    const { chunks: retrievedChunks } = await retrieveWithChromaMultiLanguage(transcribedQuestion, 2);
    const retrievedSections = chunksToRetrievedSections(retrievedChunks);

    const result = await executeGroundedGeminiOptimized(transcribedQuestion, retrievedChunks, targetLang);

    res.json({
      question_text: transcribedQuestion,
      answer: result.answer,
      cited_section: result.cited_section,
      translated_answer: result.translated_answer,
      transcription_engine: engine,
      retrieved_sections: retrievedSections,
    });
  } catch (err: any) {
    console.error('[SahakarMitra] Error in /voice:', err);
    res.status(500).json({ detail: `An error occurred: ${err.message || String(err)}` });
  }
};

app.post('/voice', upload.single('file'), handleVoice);
app.post('/api/voice', upload.single('file'), handleVoice);

// 7. Tamil / English Text-to-Speech Endpoint (POST /api/tts)
const handleTts = async (req: Request, res: Response) => {
  try {
    const { text, lang } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ detail: 'Text is required for TTS.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const promptText = lang === 'ta' ? `பேசவும்: ${text}` : `Say clearly: ${text}`;
        const ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: [{ parts: [{ text: promptText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          res.json({
            audioBase64: base64Audio,
            mimeType: 'audio/pcm;rate=24000',
            text,
          });
          return;
        }
      } catch (ttsErr) {
        console.warn('[SahakarMitra] Gemini TTS notice, client will use browser synthesis:', ttsErr);
      }
    }

    res.json({
      useClientSynthesis: true,
      text,
      lang: lang || 'ta',
    });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || String(err) });
  }
};

app.post('/tts', handleTts);
app.post('/api/tts', handleTts);

// 8. Catch-all for API endpoints to prevent Vite from returning HTML on unmatched /api routes
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).setHeader('Content-Type', 'application/json; charset=utf-8').json({
    detail: `API endpoint ${req.method} ${req.path} not found.`,
  });
});

// Global API error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  if (req.path.startsWith('/api') || req.path === '/ask' || req.path === '/voice') {
    res.status(500).setHeader('Content-Type', 'application/json; charset=utf-8').json({
      detail: `Internal Server Error: ${err?.message || String(err)}`,
    });
    return;
  }
  next(err);
});

// ----------------------------------------------------
// SERVER & VITE INTEGRATION
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SahakarMitra] Full-stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
