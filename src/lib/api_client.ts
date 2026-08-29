/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AskApiResponse, VoiceApiResponse, RetrievedSection } from '../types';
import { STATIC_ACT_CHUNKS, STATIC_ACT_SECTIONS } from '../data/actData';
import { chromaStore } from './chroma_store';

export interface SafeFetchResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  isHtml: boolean;
}

/**
 * Safely fetches an endpoint and guarantees no SyntaxError 'Unexpected token <' will ever be thrown.
 */
export async function safeFetchJson<T>(
  url: string,
  options: RequestInit = {}
): Promise<SafeFetchResult<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    // Check if the response is HTML (starts with '<' or has HTML content-type)
    const trimmed = rawText.trim();
    const isHtml = contentType.includes('text/html') || trimmed.startsWith('<');

    if (isHtml) {
      console.warn(`[ApiClient] Received HTML response from ${url} (status: ${response.status})`);
      return {
        ok: false,
        status: response.status,
        data: null,
        error: `Server responded with HTML page instead of JSON (Status ${response.status}).`,
        isHtml: true,
      };
    }

    if (!response.ok) {
      let errorDetail = `Server returned status ${response.status}`;
      try {
        const errorJson = JSON.parse(rawText);
        if (errorJson && (errorJson.detail || errorJson.error || errorJson.message)) {
          errorDetail = errorJson.detail || errorJson.error || errorJson.message;
        }
      } catch {
        if (trimmed) errorDetail = trimmed;
      }
      return {
        ok: false,
        status: response.status,
        data: null,
        error: errorDetail,
        isHtml: false,
      };
    }

    try {
      const data = JSON.parse(rawText) as T;
      return {
        ok: true,
        status: response.status,
        data,
        error: null,
        isHtml: false,
      };
    } catch (parseErr: any) {
      console.error(`[ApiClient] JSON parse failure from ${url}:`, parseErr, rawText.substring(0, 100));
      return {
        ok: false,
        status: response.status,
        data: null,
        error: `Invalid JSON format received from server.`,
        isHtml: false,
      };
    }
  } catch (netErr: any) {
    console.warn(`[ApiClient] Network request failed for ${url}:`, netErr);
    return {
      ok: false,
      status: 0,
      data: null,
      error: netErr.message || 'Network connection failed.',
      isHtml: false,
    };
  }
}

/**
 * Local client-side fallback query engine using bundled ChromaStore and TNSC Act chunks
 */
export function queryLocalActChunks(question: string, lang: string = 'ta'): AskApiResponse {
  // Ensure store is populated
  if (chromaStore.collection.count() === 0) {
    chromaStore.populateFromActChunks(STATIC_ACT_CHUNKS);
  }

  const queryRes = chromaStore.collection.query({
    query_texts: [question],
    n_results: 2,
  });

  if (queryRes.ids.length === 0) {
    return {
      answer: "This isn't covered in the Tamil Nadu Cooperative Societies Act.",
      cited_section: null,
      translated_answer: "இது தமிழ்நாடு கூட்டுறவு சங்கங்கள் சட்டம் 1983-ல் குறிப்பிடப்படவில்லை.",
      retrieved_sections: [],
    };
  }

  const topMeta = queryRes.metadatas[0];
  const topDoc = queryRes.documents[0];
  const topScore = queryRes.scores[0];

  const retrieved_sections: RetrievedSection[] = queryRes.ids.map((id, idx) => ({
    section: queryRes.metadatas[idx].section,
    title: queryRes.metadatas[idx].title,
    chapter: queryRes.metadatas[idx].chapter,
    text: queryRes.documents[idx],
    score: queryRes.scores[idx],
  }));

  const answer = `According to Section ${topMeta.section} (${topMeta.title}) of the Tamil Nadu Co-operative Societies Act, 1983: ${topDoc}`;
  const translated_answer = `சட்டப்பிரிவு ${topMeta.section} (${topMeta.title})-ன் படி: ${topMeta.summary_ta || topDoc}`;

  return {
    answer,
    cited_section: `Section ${topMeta.section}`,
    translated_answer,
    retrieved_sections,
  };
}

/**
 * Sends a legal question to backend /api/ask with automatic /ask fallback and client ChromaDB fallback
 */
export async function sendAskQuestion(
  question: string,
  lang: string = 'ta'
): Promise<AskApiResponse> {
  const payload = JSON.stringify({ question, lang });

  // 1. Try /api/ask
  const res1 = await safeFetchJson<AskApiResponse>('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });

  if (res1.ok && res1.data) {
    return res1.data;
  }

  // 2. Try fallback /ask
  const res2 = await safeFetchJson<AskApiResponse>('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });

  if (res2.ok && res2.data) {
    return res2.data;
  }

  // 3. Graceful Client-side ChromaDB Fallback
  console.log('[ApiClient] Backend currently unavailable, providing client-side grounded retrieval fallback.');
  return queryLocalActChunks(question, lang);
}

/**
 * Sends audio recording to /api/voice or /voice with safe fallback
 */
export async function sendVoiceAudio(
  audioBlob: Blob,
  mimeType: string,
  lang: string = 'ta',
  fallbackTranscript?: string
): Promise<VoiceApiResponse> {
  const ext = mimeType.includes('webm')
    ? 'webm'
    : mimeType.includes('mp4')
    ? 'mp4'
    : mimeType.includes('ogg')
    ? 'ogg'
    : 'wav';

  const formData = new FormData();
  formData.append('file', audioBlob, `recording.${ext}`);

  // 1. Try /api/voice
  const res1 = await safeFetchJson<VoiceApiResponse>(`/api/voice?lang=${lang}`, {
    method: 'POST',
    body: formData,
  });

  if (res1.ok && res1.data) {
    return res1.data;
  }

  // 2. Try fallback /voice
  const res2 = await safeFetchJson<VoiceApiResponse>(`/voice?lang=${lang}`, {
    method: 'POST',
    body: formData,
  });

  if (res2.ok && res2.data) {
    return res2.data;
  }

  // 3. If client had live speech recognition, fallback to /ask or client ChromaDB
  if (fallbackTranscript && fallbackTranscript.trim()) {
    console.log('[ApiClient] Voice endpoint unavailable, answering using speech transcript:', fallbackTranscript);
    const askData = await sendAskQuestion(fallbackTranscript, lang);
    return {
      answer: askData.answer,
      cited_section: askData.cited_section,
      translated_answer: askData.translated_answer || askData.answer,
      retrieved_sections: askData.retrieved_sections,
      question_text: fallbackTranscript,
      transcription_engine: 'web-speech',
    };
  }

  const errorMsg = res1.error || res2.error || 'Could not process audio recording on server.';
  throw new Error(errorMsg);
}

/**
 * Fetches statutory sections list safely with fallback to bundled STATIC_ACT_SECTIONS
 */
export async function fetchActSections(): Promise<RetrievedSection[]> {
  const res = await safeFetchJson<{ count: number; sections: RetrievedSection[] }>('/api/sections');
  if (res.ok && res.data && res.data.sections && res.data.sections.length > 0) {
    return res.data.sections;
  }

  return STATIC_ACT_SECTIONS.map((s) => ({
    section: s.section,
    title: s.title,
    chapter: s.chapter,
    text: s.text,
  }));
}
