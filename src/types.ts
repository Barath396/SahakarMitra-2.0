export interface RetrievedSection {
  section: string;
  title: string;
  chapter: string;
  text: string;
  score?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  cited_section?: string | null;
  retrieved_sections?: RetrievedSection[];
  translated_answer?: string;
  question_text?: string;
  transcription_engine?: string;
  isVoice?: boolean;
  isError?: boolean;
  timestamp: string;
}

export interface AskApiResponse {
  answer: string;
  cited_section: string | null;
  translated_answer?: string;
  retrieved_sections: RetrievedSection[];
}

export interface VoiceApiResponse {
  question_text: string;
  answer: string;
  cited_section: string | null;
  translated_answer: string;
  transcription_engine?: string;
  retrieved_sections?: RetrievedSection[];
}
