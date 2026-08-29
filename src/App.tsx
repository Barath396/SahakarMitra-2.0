/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { QuickPrompts } from './components/QuickPrompts';
import { RobotAvatar, RobotState } from './components/RobotAvatar';
import { ChatMessageItem } from './components/ChatMessageItem';
import { ActSectionsModal } from './components/ActSectionsModal';
import { HardwareModal } from './components/HardwareModal';
import { ChatMessage, AskApiResponse, VoiceApiResponse, RetrievedSection } from './types';
import { Send, Mic, Square, AlertTriangle, X, Volume2, Sparkles } from 'lucide-react';
import { speechService } from './lib/speech';
import { sendAskQuestion, sendVoiceAudio } from './lib/api_client';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: "Vanakkam! Welcome to SahakarMitra (சககாரமித்ரா).\n\nI am your dedicated AI Legal Assistant for Primary Agricultural Cooperative Societies (PACS) in Tamil Nadu, strictly grounded in the Tamil Nadu Co-operative Societies Act, 1983.\n\nYou can ask questions in Tamil or English regarding AGM timelines, board elections, annual audit 9-month deadline, surcharge investigations, crop loan first charge, or member expulsion. You can also listen to clear spoken answers at a farmer-friendly pace.",
      cited_section: 'TNSC Act 1983',
      translated_answer: "வணக்கம்! சககாரமித்ரா AI சட்ட வழிகாட்டிக்கு வரவேற்கிறோம்.\n\nதமிழ்நாடு தொடக்க வேளாண்மை கூட்டுறவு கடன் சங்கங்களுக்கான (PACS) சட்ட விதிகளை (பொதுக்குழு கூட்டம், தேர்தல், ஆண்டு தணிக்கை, பயிர்க்கடன் மற்றும் சர்சார்ஜ் முறைகேடு மீட்பு) நீங்கள் எளிய தமிழில் கேட்கலாம். விவசாயிகள் தெளிவாக கேட்கும் வகையில் பதில்கள் தமிழில் வாசிக்கப்படும்.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Consulting TNSC Act sections...');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 volume meter
  const [liveTranscript, setLiveTranscript] = useState('');
  const [selectedLang, setSelectedLang] = useState('ta');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isSpeakingAloud, setIsSpeakingAloud] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dark Mode Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sahakar_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply dark mode class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sahakar_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sahakar_theme', 'light');
    }
  }, [isDarkMode]);

  // Modals
  const [isSectionsModalOpen, setIsSectionsModalOpen] = useState(false);
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);

  // Audio & Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Poll speech state
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSpeakingAloud(speechService.isSpeaking());
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const speakResponse = (msg: ChatMessage) => {
    if (!autoSpeak) return;
    const textToSpeak = (selectedLang === 'ta' && msg.translated_answer ? msg.translated_answer : msg.text) || msg.text;
    speechService.speak(textToSpeak, {
      lang: selectedLang,
      onStart: () => setIsSpeakingAloud(true),
      onEnd: () => setIsSpeakingAloud(false),
      onError: () => setIsSpeakingAloud(false),
    });
  };

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      speechService.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  // Handle Text Submission
  const handleSendQuestion = async (queryText?: string) => {
    const question = (queryText || inputQuery).trim();
    if (!question || isLoading) return;

    setInputQuery('');
    setErrorMessage(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setLoadingText('Searching TNSC Act & generating grounded legal answer...');

    try {
      const data: AskApiResponse = await sendAskQuestion(question, selectedLang);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.answer,
        cited_section: data.cited_section,
        translated_answer: data.translated_answer,
        retrieved_sections: data.retrieved_sections,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      speakResponse(aiMsg);
    } catch (err: any) {
      console.error('Error querying legal answer:', err);
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `Unable to retrieve response. (${err.message || 'Please try again'})`,
        cited_section: null,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Start Voice Recording with Audio Signal Monitoring
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      setLiveTranscript('');
      liveTranscriptRef.current = '';

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 1. Setup Web Audio API for visual signal meter / volume level
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const average = sum / dataArray.length;
              // Scale to 0 - 100
              const normalized = Math.min(100, Math.round((average / 128) * 100));
              setAudioLevel(normalized);
              animFrameRef.current = requestAnimationFrame(updateMeter);
            }
          };
          animFrameRef.current = requestAnimationFrame(updateMeter);
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext visualization notice:', audioCtxErr);
      }

      // 2. Setup Web Speech API for real-time live transcription
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = selectedLang === 'ta' ? 'ta-IN' : 'en-IN';

          recognition.onresult = (event: any) => {
            let fullText = '';
            for (let i = 0; i < event.results.length; i++) {
              fullText += event.results[i][0].transcript;
            }
            if (fullText.trim()) {
              setLiveTranscript(fullText);
              liveTranscriptRef.current = fullText;
            }
          };

          recognition.onerror = (e: any) => {
            console.warn('SpeechRecognition notice:', e.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (recogErr) {
          console.warn('Web Speech recognition initialization notice:', recogErr);
        }
      }

      // 3. Negotiate supported audio format
      let mimeType = 'audio/webm';
      const possibleTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav',
      ];
      for (const type of possibleTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());

        // Stop audio analysis
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        setAudioLevel(0);

        // Process audio with Whisper / Gemini
        const capturedTranscript = liveTranscriptRef.current;
        await processAudioSubmission(audioBlob, mimeType, capturedTranscript);
      };

      // Collect data chunks every 100ms
      recorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      setErrorMessage(
        'Microphone access was denied or not supported in this browser. Please grant microphone permissions in your browser settings.'
      );
      setIsRecording(false);
    }
  };

  // Stop Voice Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  };

  // Cancel Voice Recording without sending
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setAudioLevel(0);
    setLiveTranscript('');
    liveTranscriptRef.current = '';
  };

  // Process Audio File to /voice endpoint
  const processAudioSubmission = async (audioBlob: Blob, mimeType: string, clientFallbackTranscript: string) => {
    const userDisplay = clientFallbackTranscript.trim()
      ? `🎙️ "${clientFallbackTranscript}"`
      : '🎙️ [Spoken Legal Question via Microphone]';

    const userMsg: ChatMessage = {
      id: `user-voice-${Date.now()}`,
      sender: 'user',
      text: userDisplay,
      isVoice: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setLoadingText('Transcribing audio with Whisper & analyzing Tamil Nadu Cooperative Societies Act...');

    try {
      const targetLang = selectedLang || 'ta';
      const data: VoiceApiResponse = await sendVoiceAudio(
        audioBlob,
        mimeType,
        targetLang,
        clientFallbackTranscript
      );

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.answer,
        cited_section: data.cited_section,
        translated_answer: data.translated_answer,
        question_text: data.question_text,
        transcription_engine: data.transcription_engine,
        retrieved_sections: data.retrieved_sections,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      speakResponse(aiMsg);
    } catch (err: any) {
      console.error('Error in voice audio processing:', err);
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `Voice processing notice: ${err.message || 'Could not process audio from microphone'}. Please ensure microphone volume is active and speak clearly.`,
        cited_section: null,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      setLiveTranscript('');
      liveTranscriptRef.current = '';
    }
  };

  const handleSelectSection = (sec: RetrievedSection) => {
    handleSendQuestion(
      `Explain the legal provisions and requirements under Section ${sec.section} (${sec.title}) of the Tamil Nadu Cooperative Societies Act.`
    );
  };

  // Derive Current Robot State
  const currentRobotState: RobotState = isRecording
    ? 'listening'
    : isLoading
    ? 'thinking'
    : isSpeakingAloud
    ? 'speaking'
    : 'idle';

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors">
      {/* Top Header */}
      <Header
        onOpenSections={() => setIsSectionsModalOpen(true)}
        onOpenHardware={() => setIsHardwareModalOpen(true)}
        selectedLang={selectedLang}
        onSelectLang={setSelectedLang}
        autoSpeak={autoSpeak}
        onToggleAutoSpeak={() => setAutoSpeak(!autoSpeak)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      {/* Persistent Audio Speaker Playing Banner */}
      {isSpeakingAloud && (
        <div className="bg-[#0C447C] dark:bg-slate-900 text-white px-4 py-2 text-xs flex items-center justify-between shadow-xs z-10 border-b border-blue-800 dark:border-slate-800 animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2 font-medium">
            <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>சககார ரோபோ ஒலிபெருக்கியில் வாசிக்கிறது (Speaking response aloud)...</span>
          </div>
          <button
            onClick={() => speechService.stop()}
            className="px-2.5 py-0.5 rounded bg-blue-700 dark:bg-slate-800 hover:bg-blue-600 dark:hover:bg-slate-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors border border-blue-600 dark:border-slate-700"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop Audio</span>
          </button>
        </div>
      )}

      {/* Quick Prompts Bar */}
      <QuickPrompts
        onSelectPrompt={handleSendQuestion}
        disabled={isLoading || isRecording}
      />

      {/* Error alert if any */}
      {errorMessage && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Recording Overlay / Banner */}
      {isRecording && (
        <div className="bg-slate-900 dark:bg-slate-900 text-white px-4 sm:px-6 py-3 border-b border-slate-700 shadow-md animate-in slide-in-from-top-2 duration-200">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex items-center justify-center">
                <span className="w-4 h-4 rounded-full bg-red-500 animate-ping absolute"></span>
                <span className="w-3.5 h-3.5 rounded-full bg-red-500 relative"></span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Capturing Farmer Voice
                  </span>
                  <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                    {Math.floor(recordingSeconds / 60)}:
                    {(recordingSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  {audioLevel > 5 ? (
                    <span className="text-emerald-400 font-medium">✓ Spoken audio detected ({audioLevel}% level)</span>
                  ) : (
                    <span className="text-amber-400 font-medium">Listening for speech... Please speak into microphone</span>
                  )}
                </div>
              </div>

              {/* Dynamic Waveform / Equalizer bars */}
              <div className="flex items-center gap-1 h-6 px-2 bg-slate-950/80 rounded-md border border-slate-800">
                {[12, 28, 45, 70, 35, 18].map((baseHeight, idx) => {
                  const dynamicHeight = Math.max(
                    4,
                    Math.min(22, Math.round((baseHeight * (audioLevel + 15)) / 75))
                  );
                  return (
                    <div
                      key={idx}
                      className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                      style={{ height: `${dynamicHeight}px` }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Live speech preview if available */}
            {liveTranscript && (
              <div className="w-full sm:w-auto flex-1 max-w-md bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 truncate">
                <span className="text-emerald-400 font-semibold mr-1">Live:</span>
                &quot;{liveTranscript}&quot;
              </div>
            )}

            {/* Stop & Cancel Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={cancelRecording}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1 cursor-pointer border border-slate-700"
                title="Cancel recording"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>

              <button
                type="button"
                onClick={stopRecording}
                className="px-4 py-1.5 text-xs font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Finish and send with Whisper transcription"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Done & Transcribe</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Container */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 max-w-5xl w-full mx-auto">
        {/* Animated AI Robot Avatar Companion Card */}
        <RobotAvatar
          state={currentRobotState}
          audioLevel={audioLevel}
          autoSpeak={autoSpeak}
          onToggleAutoSpeak={() => setAutoSpeak(!autoSpeak)}
          selectedLang={selectedLang}
          onSelectLang={setSelectedLang}
          onTriggerPrompt={handleSendQuestion}
        />

        {/* Message Feed */}
        {messages.map((msg) => (
          <ChatMessageItem key={msg.id} message={msg} />
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 max-w-3xl mr-auto animate-in fade-in duration-200">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 ring-1 ring-emerald-200 dark:ring-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-xs p-4 shadow-xs flex items-center gap-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></div>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{loadingText}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Bottom Input Bar */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 sticky bottom-0 z-10 shadow-xs transition-colors">
        <div className="max-w-5xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuestion();
            }}
            className="flex items-center gap-2"
          >
            {/* Input wrapper */}
            <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-2 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="கேள்விகளை தமிழில் அல்லது ஆங்கிலத்தில் கேட்கவும் (Ask any PACS legal question)..."
                disabled={isLoading || isRecording}
                className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-hidden font-sans"
              />

              {/* Recording Status / Button */}
              {isRecording ? (
                <div className="flex items-center gap-2 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-600"></span>
                  <span>Live ({recordingSeconds}s)</span>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="p-1 text-red-800 dark:text-red-200 hover:text-red-950 cursor-pointer"
                    title="Stop and transcribe"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isLoading}
                  className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1 text-xs font-medium"
                  title="Speak into Microphone (Whisper Transcription)"
                >
                  <Mic className="w-5 h-5 text-[#0C447C] dark:text-emerald-400" />
                </button>
              )}
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || !inputQuery.trim() || isRecording}
              className="bg-[#0C447C] dark:bg-emerald-600 hover:bg-[#1A5F9E] dark:hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2 px-1">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Grounded strictly in <code>Tamil Nadu Co-operative Societies Act, 1983</code>
            </span>
            <span>
              ChromaDB Vector Store & Voice API: <code>POST /voice?lang=ta</code>
            </span>
          </div>
        </div>
      </footer>

      {/* Act Sections Browser Modal */}
      <ActSectionsModal
        isOpen={isSectionsModalOpen}
        onClose={() => setIsSectionsModalOpen(false)}
        onSelectSection={handleSelectSection}
      />

      {/* ESP32 Hardware Modal */}
      <HardwareModal
        isOpen={isHardwareModalOpen}
        onClose={() => setIsHardwareModalOpen(false)}
      />
    </div>
  );
}
