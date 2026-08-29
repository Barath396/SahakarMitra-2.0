/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SpeechOptions {
  lang?: 'ta' | 'en' | string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export type SpeechPace = 'slow' | 'farmer_clear' | 'normal';

export const SPEECH_PACE_RATES: Record<SpeechPace, number> = {
  slow: 0.75,         // Extra patient for elderly farmers
  farmer_clear: 0.85, // Ideal clear pace for rural understanding (Default)
  normal: 1.0,        // Standard conversational
};

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private speechRate: number = 0.85; // Default slow and clear for farmers
  private speechPace: SpeechPace = 'farmer_clear';
  private autoSpeakEnabled: boolean = true;
  private isCurrentlySpeaking: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (this.synth) {
      this.voices = this.synth.getVoices();
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && this.synth) {
      this.voices = this.synth.getVoices();
    }
    return this.voices;
  }

  public getTamilVoice(): SpeechSynthesisVoice | undefined {
    const voices = this.getVoices();
    return (
      voices.find(v => v.lang === 'ta-IN' || v.lang === 'ta_IN') ||
      voices.find(v => v.lang.startsWith('ta')) ||
      voices.find(v => v.name.toLowerCase().includes('tamil')) ||
      voices.find(v => v.name.toLowerCase().includes('valluvar') || v.name.toLowerCase().includes('latha'))
    );
  }

  public setSpeechRate(rate: number) {
    this.speechRate = Math.max(0.65, Math.min(1.4, rate));
  }

  public setPace(pace: SpeechPace) {
    this.speechPace = pace;
    this.speechRate = SPEECH_PACE_RATES[pace] || 0.85;
  }

  public getPace(): SpeechPace {
    return this.speechPace;
  }

  public getSpeechRate(): number {
    return this.speechRate;
  }

  public setAutoSpeak(enabled: boolean) {
    this.autoSpeakEnabled = enabled;
  }

  public isAutoSpeak(): boolean {
    return this.autoSpeakEnabled;
  }

  public isSpeaking(): boolean {
    const isSynthSpeaking = !!this.synth && (this.synth.speaking || this.isCurrentlySpeaking);
    const isAudioPlaying = !!this.currentAudio && !this.currentAudio.paused;
    return isSynthSpeaking || isAudioPlaying;
  }

  public stop() {
    this.isCurrentlySpeaking = false;
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  public pause() {
    if (this.synth && this.synth.speaking) {
      this.synth.pause();
    }
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
    }
  }

  public resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().catch(() => {});
    }
  }

  /**
   * Convert legal statutory numbers, abbreviations and English phrases into fluent spoken Tamil
   */
  public cleanTextForSpeech(text: string, isTamil: boolean = false): string {
    let cleaned = text
      .replace(/[*#_`~>\[\]]/g, ' ') // remove markdown
      .replace(/https?:\/\/\S+/g, '') // remove URLs
      .replace(/\bTNSC\s*Act(?:\s*1983)?\b/gi, 'தமிழ்நாடு கூட்டுறவு சங்கங்கள் சட்டம் 1983')
      .replace(/\bPACS\b/gi, 'தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கம்')
      .replace(/\bAGM\b/gi, 'ஆண்டு பொதுக்குழு கூட்டம்')
      .replace(/\bSGM\b/gi, 'சிறப்பு பொதுக்குழு கூட்டம்')
      .replace(/\bSection\s+(\d+)\s*\(([\d\w]+)\)/gi, isTamil ? 'சட்டப்பிரிவு $1 உட்பிரிவு $2' : 'Section $1 subsection $2')
      .replace(/\b(?:Section|Sec|பிரிவு)\s*(\d+)\b/gi, isTamil ? 'சட்டப்பிரிவு $1' : 'Section $1')
      .replace(/\b1\/3\b/g, 'மூன்றில் ஒரு பங்கு')
      .replace(/\b2\/3\b/g, 'மூன்றில் இரண்டு பங்கு')
      .replace(/\b1\/5\b/g, 'ஐந்தில் ஒரு பங்கு')
      .replace(/\b3\/4\b/g, 'நான்கில் மூன்று பங்கு')
      .replace(/(\d+)\s*%/g, '$1 சதவீதம்')
      .replace(/(\d+)\s*மாதம்/g, '$1 மாதங்கள்')
      .replace(/(\d+)\s*ஆண்டு/g, '$1 ஆண்டுகள்')
      .replace(/ரூ\.\s*(\d+)/g, '$1 ரூபாய்')
      .replace(/Rs\.\s*(\d+)/gi, '$1 ரூபாய்')
      .replace(/[\n\r]+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  /**
   * Splits long text into natural breath clauses (80-140 chars)
   * This is critical for Tamil: browser speech engines hang or drop audio if given 300+ Tamil characters in a single utterance!
   */
  private splitIntoClauses(text: string): string[] {
    const sentences = text.split(/(?<=[.!?;:\n])\s+/);
    const clauses: string[] = [];

    for (const sentence of sentences) {
      if (sentence.length <= 150) {
        if (sentence.trim()) clauses.push(sentence.trim());
      } else {
        // Sub-split by comma, hyphen or conjunctions
        const subParts = sentence.split(/(?<=[,])\s+|\s+(?=மற்றும்|ஆனால்|எனவே|அல்லது|ஆகவே)\s*/);
        let buffer = '';

        for (const part of subParts) {
          if ((buffer + ' ' + part).length > 130 && buffer.length > 0) {
            clauses.push(buffer.trim());
            buffer = part;
          } else {
            buffer = buffer ? `${buffer} ${part}` : part;
          }
        }
        if (buffer.trim()) clauses.push(buffer.trim());
      }
    }

    return clauses.filter(c => c.length > 0);
  }

  /**
   * Speaks text through laptop speakers using enhanced Tamil TTS with farmer pacing
   */
  public async speak(text: string, options: SpeechOptions = {}) {
    this.stop();

    const isTamil = (options.lang || 'ta').startsWith('ta') || /[\u0B80-\u0BFF]/.test(text);
    const cleanedText = this.cleanTextForSpeech(text, isTamil);
    if (!cleanedText) {
      options.onEnd?.();
      return;
    }

    if (!this.synth) {
      console.warn('Speech synthesis not supported in this browser environment');
      options.onError?.('Speech synthesis not supported');
      return;
    }

    const clauses = this.splitIntoClauses(cleanedText);
    if (clauses.length === 0) {
      options.onEnd?.();
      return;
    }

    this.isCurrentlySpeaking = true;
    options.onStart?.();

    const tamilVoice = isTamil ? this.getTamilVoice() : undefined;
    const voices = this.getVoices();
    const rate = options.rate ?? this.speechRate;

    let currentIdx = 0;

    const speakNextClause = () => {
      if (!this.isCurrentlySpeaking || currentIdx >= clauses.length) {
        this.isCurrentlySpeaking = false;
        this.currentUtterance = null;
        options.onEnd?.();
        return;
      }

      const clauseText = clauses[currentIdx];
      currentIdx++;

      const utterance = new SpeechSynthesisUtterance(clauseText);

      if (isTamil) {
        utterance.lang = 'ta-IN';
        if (tamilVoice) {
          utterance.voice = tamilVoice;
        }
      } else {
        const engVoice = voices.find(v => v.lang === 'en-IN' || v.name.toLowerCase().includes('india') || v.lang === 'en-US' || v.lang.startsWith('en'));
        utterance.lang = engVoice?.lang || 'en-IN';
        if (engVoice) utterance.voice = engVoice;
      }

      // Slightly slower, clear pace for farmers
      utterance.rate = rate;
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;

      utterance.onend = () => {
        // Small pause between sentences for natural listening
        setTimeout(speakNextClause, 120);
      };

      utterance.onerror = (e) => {
        console.warn('Speech clause error:', e);
        if (currentIdx < clauses.length) {
          // Try next clause rather than quitting
          setTimeout(speakNextClause, 100);
        } else {
          this.isCurrentlySpeaking = false;
          this.currentUtterance = null;
          options.onError?.(e);
        }
      };

      this.currentUtterance = utterance;

      try {
        this.synth?.speak(utterance);
      } catch (err) {
        console.error('Failed to trigger speech synthesis:', err);
        this.isCurrentlySpeaking = false;
        options.onError?.(err);
      }
    };

    speakNextClause();
  }

  /**
   * Play pleasant farmer-friendly speaker chime
   */
  public playSpeakerChime(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) {
          resolve();
          return;
        }
        const ctx = new AudioCtx();

        // Harmonious bell tone (C5 + G5)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc1.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
        osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.25); // C6

        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.45);
        osc2.stop(ctx.currentTime + 0.45);

        setTimeout(() => {
          ctx.close().catch(() => {});
          resolve();
        }, 500);
      } catch {
        resolve();
      }
    });
  }
}

export const speechService = new SpeechService();
