/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Cpu, Check, Copy, Terminal, Radio } from 'lucide-react';

interface HardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HardwareModal: React.FC<HardwareModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const curlExample = `curl -X POST "http://<backend-ip>:3000/voice?lang=ta" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@sample_recording.wav;type=audio/wav"`;

  const esp32Snippet = `// ESP32 Arduino HTTP Client Example
#include <WiFi.h>
#include <HTTPClient.h>

void sendAudioToSahakarMitra(uint8_t* wavBuffer, size_t wavSize) {
  HTTPClient http;
  http.begin("http://192.168.1.100:3000/voice?lang=ta");
  
  String boundary = "----ESP32Boundary" + String(millis());
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  
  // Construct and send multipart buffer
  // POST payload to /voice endpoint
  // Receive JSON { "translated_answer": "...", "cited_section": "..." }
  int httpResponseCode = http.POST(wavBuffer, wavSize);
  http.end();
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(curlExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-[#0C447C] dark:text-blue-400 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                ESP32 Hardware Integration Contract
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Specification for physical microphone voice device integration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2">
            <div className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              REST API Endpoint Contract for ESP32 Microphone Units
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-200/90 leading-relaxed">
              The backend exposes <code>POST /voice</code> (and <code>POST /api/voice</code>) which directly receives multipart WAV, WebM, or PCM audio recorded from an ESP32 I2S microphone (e.g. INMP441) and responds with grounded JSON answers.
            </p>
          </div>

          {/* cURL Example */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                cURL Test Command (Multipart Audio Upload)
              </span>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0C447C] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy cURL'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800">
              {curlExample}
            </pre>
          </div>

          {/* ESP32 Arduino C++ Snippet */}
          <div className="space-y-2">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              ESP32 Arduino C++ Client Snippet
            </span>
            <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800">
              {esp32Snippet}
            </pre>
          </div>

          {/* Response Payload Schema */}
          <div className="space-y-2">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              JSON Response Format
            </span>
            <pre className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-mono text-xs border border-slate-200 dark:border-slate-700">
{`{
  "question_text": "சங்கத்தில் தணிக்கை செய்ய வேண்டிய காலக்கெடு என்ன?",
  "answer": "According to Section 80 of TNSC Act 1983, audit must be completed within 9 months from the close of the financial year.",
  "cited_section": "Section 80",
  "translated_answer": "சட்டப்பிரிவு 80-ன் படி, நிதியாண்டு முடிந்த 9 மாதங்களுக்குள் தணிக்கை அறிக்கை சமர்ப்பிக்கப்பட வேண்டும்.",
  "retrieved_sections": [
    { "section": "80", "title": "Statutory Annual Audit", "score": 95 }
  ]
}`}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Spec
          </button>
        </div>
      </div>
    </div>
  );
};
