/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Square, Play, Sparkles, Mic, HelpCircle, FastForward } from 'lucide-react';
import { speechService, SpeechPace, SPEECH_PACE_RATES } from '../lib/speech';

export type RobotState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface RobotAvatarProps {
  state: RobotState;
  audioLevel?: number; // 0 - 100 for live mic
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  selectedLang: string;
  onSelectLang: (lang: string) => void;
  onTriggerPrompt?: (prompt: string) => void;
}

export const RobotAvatar: React.FC<RobotAvatarProps> = ({
  state,
  audioLevel = 0,
  autoSpeak,
  onToggleAutoSpeak,
  selectedLang,
  onSelectLang,
  onTriggerPrompt,
}) => {
  const [speechPace, setSpeechPace] = useState<SpeechPace>('farmer_clear');
  const [isBlinking, setIsBlinking] = useState(false);
  const [isPlayingIntro, setIsPlayingIntro] = useState(false);

  // Periodic natural eye blink
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    }, 4000);
    return () => clearInterval(blinkInterval);
  }, []);

  const handlePaceChange = (pace: SpeechPace) => {
    setSpeechPace(pace);
    speechService.setPace(pace);
  };

  const handleStopSpeech = () => {
    speechService.stop();
    setIsPlayingIntro(false);
  };

  const handlePlayIntro = async () => {
    if (speechService.isSpeaking() || isPlayingIntro) {
      speechService.stop();
      setIsPlayingIntro(false);
      return;
    }

    setIsPlayingIntro(true);
    await speechService.playSpeakerChime();

    const introTamil =
      "வணக்கம்! நான் சககாரமித்ரா AI ரோபோ. தமிழ்நாடு தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கங்களுக்கான (PACS) சட்ட வழிகாட்டி. பொதுக்குழு கூட்டம், நிர்வாகக்குழு தேர்தல், பயிர்க்கடன் மற்றும் தணிக்கை தொடர்பான சட்ட விதிகளை நீங்கள் தமிழில் கேட்கலாம்.";

    speechService.speak(introTamil, {
      lang: 'ta',
      rate: SPEECH_PACE_RATES[speechPace],
      onEnd: () => setIsPlayingIntro(false),
      onError: () => setIsPlayingIntro(false),
    });
  };

  const getStateBadge = () => {
    switch (state) {
      case 'listening':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>குரலைக் கேட்கிறது... (Listening)</span>
          </div>
        );
      case 'thinking':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold animate-pulse">
            <Sparkles className="w-3 h-3 text-amber-500 animate-spin" />
            <span>சட்டப்பிரிவு ஆய்வு... (Searching Act)</span>
          </div>
        );
      case 'speaking':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-semibold">
            <Volume2 className="w-3.5 h-3.5 text-blue-500 animate-bounce" />
            <span>தமிழில் பேசுகிறது (Speaking Aloud)</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>தயாராக உள்ளது (SahakarBot Ready)</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors">
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        {/* Animated Visual Robot */}
        <div className="relative shrink-0 flex flex-col items-center">
          {/* Antenna & Signal Light */}
          <div className="relative flex flex-col items-center">
            <div
              className={`w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-xs transition-all ${
                state === 'listening'
                  ? 'bg-emerald-500 ring-4 ring-emerald-400/40 animate-ping'
                  : state === 'speaking'
                  ? 'bg-blue-500 ring-4 ring-blue-400/40 animate-pulse'
                  : state === 'thinking'
                  ? 'bg-amber-400 ring-4 ring-amber-300/40 animate-pulse'
                  : 'bg-emerald-400'
              }`}
            />
            <div className="w-1 h-3 bg-slate-300 dark:bg-slate-600 -mt-0.5 rounded-t-full" />
          </div>

          {/* Robot Head Outer Box */}
          <div
            className={`w-24 h-22 rounded-2xl p-2 flex flex-col justify-between border-2 transition-all relative shadow-md ${
              state === 'listening'
                ? 'bg-linear-to-b from-slate-900 to-emerald-950 border-emerald-400 ring-4 ring-emerald-500/20'
                : state === 'speaking'
                ? 'bg-linear-to-b from-slate-900 to-blue-950 border-blue-400 ring-4 ring-blue-500/20'
                : state === 'thinking'
                ? 'bg-linear-to-b from-slate-900 to-amber-950 border-amber-400 ring-4 ring-amber-500/20'
                : 'bg-linear-to-b from-slate-900 to-slate-800 border-slate-700 dark:border-slate-600'
            }`}
          >
            {/* Robot Ear Sensors */}
            <div
              className={`absolute -left-2 top-6 w-2 h-7 rounded-l-md transition-colors ${
                state === 'listening' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'
              }`}
            />
            <div
              className={`absolute -right-2 top-6 w-2 h-7 rounded-r-md transition-colors ${
                state === 'listening' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'
              }`}
            />

            {/* LED Visor Screen */}
            <div className="w-full h-10 rounded-lg bg-black/90 p-1.5 flex items-center justify-around border border-slate-700/60 relative overflow-hidden">
              {/* Thinking Scan Beam */}
              {state === 'thinking' && (
                <div className="absolute inset-y-0 w-6 bg-linear-to-r from-transparent via-amber-400/50 to-transparent animate-shimmer" />
              )}

              {/* Eyes */}
              <div
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  isBlinking
                    ? 'h-0.5 bg-emerald-300'
                    : state === 'listening'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]'
                    : state === 'speaking'
                    ? 'bg-blue-400 shadow-[0_0_8px_#60A5FA]'
                    : state === 'thinking'
                    ? 'bg-amber-300 shadow-[0_0_8px_#FCD34D]'
                    : 'bg-emerald-300 shadow-[0_0_6px_#34D399]'
                }`}
              />
              <div
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  isBlinking
                    ? 'h-0.5 bg-emerald-300'
                    : state === 'listening'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]'
                    : state === 'speaking'
                    ? 'bg-blue-400 shadow-[0_0_8px_#60A5FA]'
                    : state === 'thinking'
                    ? 'bg-amber-300 shadow-[0_0_8px_#FCD34D]'
                    : 'bg-emerald-300 shadow-[0_0_6px_#34D399]'
                }`}
              />
            </div>

            {/* Mouth / Equalizer Waveform */}
            <div className="w-full h-4 flex items-center justify-center gap-1 px-2">
              {state === 'speaking' ? (
                <>
                  <div className="w-1 bg-blue-400 rounded-full animate-[bounce_0.6s_infinite_0.1s] h-3" />
                  <div className="w-1 bg-blue-400 rounded-full animate-[bounce_0.6s_infinite_0.2s] h-4" />
                  <div className="w-1 bg-blue-400 rounded-full animate-[bounce_0.6s_infinite_0.3s] h-2" />
                  <div className="w-1 bg-blue-400 rounded-full animate-[bounce_0.6s_infinite_0.4s] h-4" />
                  <div className="w-1 bg-blue-400 rounded-full animate-[bounce_0.6s_infinite_0.2s] h-3" />
                </>
              ) : state === 'listening' ? (
                <div className="w-full flex items-center justify-center gap-1">
                  <div
                    className="w-1.5 bg-emerald-400 rounded-full transition-all"
                    style={{ height: `${Math.max(4, (audioLevel / 100) * 16)}px` }}
                  />
                  <div
                    className="w-1.5 bg-emerald-400 rounded-full transition-all"
                    style={{ height: `${Math.max(6, (audioLevel / 100) * 18)}px` }}
                  />
                  <div
                    className="w-1.5 bg-emerald-400 rounded-full transition-all"
                    style={{ height: `${Math.max(4, (audioLevel / 100) * 16)}px` }}
                  />
                </div>
              ) : (
                <div className="w-10 h-1 bg-emerald-500/60 dark:bg-emerald-400/60 rounded-full" />
              )}
            </div>
          </div>
        </div>

        {/* Info & Farmer-Friendly Controls */}
        <div className="flex-1 w-full space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <span>SahakarBot</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                  சககார ரோபோ
                </span>
              </h2>
            </div>
            {getStateBadge()}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
            விவசாயிகள் மற்றும் சங்க உறுப்பினர்கள் எளிதாக கேட்கும் வகையில் பொறுமையாகவும் தெளிவாகவும் பேசும் AI குரல் வழிகாட்டி.
          </p>

          {/* Farmer Speech Pace Selector */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold">
              <FastForward className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>பேசும் வேகம் (Farmer Voice Pace):</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePaceChange('slow')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  speechPace === 'slow'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                }`}
                title="Extra patient pace (0.75x) for elderly farmers"
              >
                0.75x மெதுவாக
              </button>

              <button
                onClick={() => handlePaceChange('farmer_clear')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  speechPace === 'farmer_clear'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                }`}
                title="Clear pace (0.85x) tailored for clear listening"
              >
                0.85x தெளிவான நடை ★
              </button>

              <button
                onClick={() => handlePaceChange('normal')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  speechPace === 'normal'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                }`}
                title="Normal speed (1.0x)"
              >
                1.0x இயல்பு
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2">
              {/* Play / Stop Intro Voice */}
              <button
                onClick={handlePlayIntro}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isPlayingIntro || state === 'speaking'
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-xs'
                    : 'bg-[#0C447C] dark:bg-blue-600 hover:bg-blue-800 text-white shadow-xs'
                }`}
              >
                {isPlayingIntro || state === 'speaking' ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>குரலை நிறுத்து (Stop Audio)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>அறிமுகம் கேள் (Hear Intro in Tamil)</span>
                  </>
                )}
              </button>
            </div>

            {/* Status indicator */}
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>தமிழ்நாடு கூட்டுறவு சங்கங்கள் சட்டம் 1983</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
