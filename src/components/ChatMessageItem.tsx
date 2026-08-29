/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Bot, User, CheckCircle2, AlertCircle, Volume2, Square, ChevronDown, ChevronUp, Mic, Sparkles } from 'lucide-react';
import { speechService } from '../lib/speech';

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const [showRetrieved, setShowRetrieved] = useState(false);
  const [playingType, setPlayingType] = useState<'tamil' | 'english' | null>(null);

  const isUser = message.sender === 'user';

  // Check speech state
  useEffect(() => {
    const interval = setInterval(() => {
      if (playingType && !speechService.isSpeaking()) {
        setPlayingType(null);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [playingType]);

  const handlePlayTamil = () => {
    if (playingType === 'tamil') {
      speechService.stop();
      setPlayingType(null);
      return;
    }

    const textToSpeak = message.translated_answer || message.text;
    speechService.speak(textToSpeak, {
      lang: 'ta',
      onStart: () => setPlayingType('tamil'),
      onEnd: () => setPlayingType(null),
      onError: () => setPlayingType(null),
    });
  };

  const handlePlayEnglish = () => {
    if (playingType === 'english') {
      speechService.stop();
      setPlayingType(null);
      return;
    }

    speechService.speak(message.text, {
      lang: 'en',
      onStart: () => setPlayingType('english'),
      onEnd: () => setPlayingType(null),
      onError: () => setPlayingType(null),
    });
  };

  if (isUser) {
    return (
      <div className="flex justify-end items-end gap-2.5 max-w-2xl ml-auto">
        <div className="bg-[#0C447C] dark:bg-emerald-600 text-white px-4 py-3 rounded-2xl rounded-br-xs shadow-xs text-sm leading-relaxed">
          {message.isVoice && (
            <div className="flex items-center gap-1.5 text-xs text-blue-200 dark:text-emerald-100 mb-1 font-semibold">
              <Mic className="w-3.5 h-3.5 text-emerald-300 dark:text-amber-300" />
              <span>குரல் வழி கேள்வி (Spoken Voice Query)</span>
            </div>
          )}
          <p className="whitespace-pre-wrap font-sans text-[15px]">{message.text}</p>
          <span className="text-[10px] text-blue-200 dark:text-emerald-200 block text-right mt-1.5 opacity-80">
            {message.timestamp}
          </span>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#0C447C] dark:bg-emerald-600 text-white flex items-center justify-center shrink-0 mb-0.5 shadow-2xs">
          <User className="w-4 h-4" />
        </div>
      </div>
    );
  }

  // AI Message Bubble
  return (
    <div className="flex items-start gap-3 max-w-3xl mr-auto">
      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-slate-800 text-[#0C447C] dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 ring-1 ring-blue-200 dark:ring-slate-700 shadow-2xs">
        <Bot className="w-4 h-4" />
      </div>

      <div className="flex-1 space-y-2.5">
        {/* Main Bubble */}
        <div
          className={`p-4 sm:p-5 rounded-2xl rounded-tl-xs text-sm leading-relaxed border transition-all ${
            message.isError
              ? 'bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-300 border-red-200 dark:border-red-800'
              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200/90 dark:border-slate-800 shadow-xs'
          }`}
        >
          {message.question_text && (
            <div className="mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-1.5 font-medium">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">கேட்கப்பட்ட கேள்வி:</span> &quot;{message.question_text}&quot;
              </div>
              {message.transcription_engine && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                  {message.transcription_engine === 'whisper-1' ? 'Whisper Speech AI' : message.transcription_engine === 'web-speech' ? 'Live Web Speech' : 'Multimodal Whisper AI'}
                </span>
              )}
            </div>
          )}

          {/* Tamil Translation Block - Placed Prominently on Top if Available */}
          {message.translated_answer && (
            <div className="mb-3.5 pb-3.5 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20 -mx-4 -mt-4 sm:-mx-5 sm:-mt-5 p-4 sm:p-5 rounded-t-2xl border-l-4 border-l-emerald-600 dark:border-l-emerald-500">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                  <span>தமிழ் சட்ட விளக்கம் (Tamil Explanation)</span>
                </span>

                {/* Speaker Button for Tamil */}
                <button
                  onClick={handlePlayTamil}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    playingType === 'tamil'
                      ? 'bg-emerald-600 text-white shadow-xs animate-pulse'
                      : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800 border border-emerald-300 dark:border-emerald-700'
                  }`}
                  title="Play Tamil audio via laptop speaker"
                >
                  {playingType === 'tamil' ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      <span>நிறுத்து (Stop)</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>தமிழில் கேள் (Hear Tamil)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-slate-900 dark:text-slate-100 text-[15px] font-sans leading-relaxed">
                <p className="whitespace-pre-wrap font-medium">{message.translated_answer}</p>
              </div>
            </div>
          )}

          {/* English Grounded Text */}
          <div className="text-slate-800 dark:text-slate-200 text-[14px] leading-relaxed font-sans">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Statutory Rule (English):
              </span>
              <button
                onClick={handlePlayEnglish}
                className={`text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  playingType === 'english'
                    ? 'bg-blue-600 text-white animate-pulse'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                }`}
                title="Play English audio"
              >
                {playingType === 'english' ? <Square className="w-3 h-3 fill-current" /> : <Volume2 className="w-3 h-3" />}
                <span>{playingType === 'english' ? 'Stop' : 'Hear English'}</span>
              </button>
            </div>
            <p className="whitespace-pre-wrap">{message.text}</p>
          </div>

          {/* Citations & Metadata Bar */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {message.cited_section && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#0C447C] dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0C447C] dark:text-blue-400" />
                  {message.cited_section}
                </span>
              )}

              {message.isError && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  Uncovered in Act
                </span>
              )}

              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Grounded in TNSC Act, 1983
              </span>
            </div>

            <span className="text-[10px] text-slate-500 dark:text-slate-400">{message.timestamp}</span>
          </div>
        </div>

        {/* Retrieved Sections Accordion */}
        {message.retrieved_sections && message.retrieved_sections.length > 0 && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
            <button
              onClick={() => setShowRetrieved(!showRetrieved)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-semibold transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span>Retrieved Grounding Chunks ({message.retrieved_sections.length})</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-[#0C447C] dark:text-blue-300">
                  ChromaDB Hybrid
                </span>
              </span>
              {showRetrieved ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showRetrieved && (
              <div className="p-3 space-y-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                {message.retrieved_sections.map((sec, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                      <span>Section {sec.section}: {sec.title}</span>
                      {sec.score !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Relevance: {sec.score}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">{sec.chapter}</p>
                    <p className="text-slate-700 dark:text-slate-300 text-[11.5px] leading-relaxed line-clamp-3 font-mono bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                      {sec.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
