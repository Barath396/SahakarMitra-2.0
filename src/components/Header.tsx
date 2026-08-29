/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, Cpu, Globe, Volume2, VolumeX, Sun, Moon, Sparkles, Sprout } from 'lucide-react';
import { speechService } from '../lib/speech';

interface HeaderProps {
  onOpenSections: () => void;
  onOpenHardware: () => void;
  selectedLang: string;
  onSelectLang: (lang: string) => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSections,
  onOpenHardware,
  selectedLang,
  onSelectLang,
  autoSpeak,
  onToggleAutoSpeak,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);

  const handleTestSpeaker = async () => {
    if (isTestingSpeaker) return;
    setIsTestingSpeaker(true);
    await speechService.playSpeakerChime();
    speechService.speak(
      'வணக்கம்! லேப்டாப் ஸ்பீக்கர் தெளிவாக கேட்கிறது. விவசாயிகளுக்கான சட்ட விளக்கங்களை சககாரமித்ரா தமிழில் வாசிக்கும்.',
      {
        lang: 'ta',
        onEnd: () => setIsTestingSpeaker(false),
        onError: () => setIsTestingSpeaker(false),
      }
    );
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 sticky top-0 z-20 shadow-xs transition-colors">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand with Agricultural Co-op Shield Icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-600 to-[#0C447C] dark:from-emerald-500 dark:to-blue-600 flex items-center justify-center text-white shadow-xs ring-2 ring-emerald-500/20 shrink-0">
            {/* Custom SVG Icon combining Co-op Leaf + Balance Scales */}
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22V8" />
              <path d="M12 8C9.5 3 4 5 4 9c0 5 8 13 8 13s8-8 8-13c0-4-5.5-6-8-1" />
              <path d="M7 13h10" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#0C447C] dark:text-emerald-400">
                SahakarMitra
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                சககாரமித்ரா
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              AI Legal Assistant for Tamil Nadu Cooperative Societies (PACS)
            </p>
          </div>
        </div>

        {/* Action Controls & Badges */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Dark / Light Theme Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Laptop Speaker Auto-Read Aloud Toggle */}
          <button
            onClick={onToggleAutoSpeak}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              autoSpeak
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
            title={autoSpeak ? 'Auto-speaker is ON (answers will read aloud)' : 'Auto-speaker is OFF (click to enable auto-reading)'}
          >
            {autoSpeak ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                <span>Auto Speaker: ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span>Auto Speaker: OFF</span>
              </>
            )}
          </button>

          {/* Test Speaker Button */}
          <button
            onClick={handleTestSpeaker}
            disabled={isTestingSpeaker}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              isTestingSpeaker
                ? 'bg-blue-600 text-white border-blue-600 animate-pulse'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-[#0C447C] dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
            }`}
            title="Click to test laptop speaker output with a Tamil voice sample"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#0C447C] dark:text-emerald-400" />
            <span className="hidden md:inline">Test Speaker</span>
          </button>

          {/* Language Toggle for Voice */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300">
            <Globe className="w-3.5 h-3.5 text-[#0C447C] dark:text-emerald-400" />
            <select
              value={selectedLang}
              onChange={(e) => onSelectLang(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 outline-hidden cursor-pointer"
              title="Target voice translation language"
            >
              <option value="ta" className="dark:bg-slate-900">தமிழ் (Tamil)</option>
              <option value="en" className="dark:bg-slate-900">English</option>
            </select>
          </div>

          {/* Act Reference Button */}
          <button
            onClick={onOpenSections}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#0C447C] dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
            title="View all 36 TNSC Act sections in database"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#0C447C] dark:text-emerald-400" />
            <span className="hidden sm:inline">Act Sections</span>
          </button>

          {/* ESP32 Hardware Contract Button */}
          <button
            onClick={onOpenHardware}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0C447C] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 rounded-lg transition-colors border border-blue-200 dark:border-blue-800 cursor-pointer"
            title="ESP32 Hardware Integration Contract & API Docs"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ESP32 Spec</span>
          </button>
        </div>
      </div>
    </header>
  );
};
