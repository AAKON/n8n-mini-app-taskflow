"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Web Speech API types ────────────────────────────────────────────────────

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionErrorLike = {
  error?: string;
};

type SpeechConstructor = new () => SpeechRecognitionLike;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSpeechConstructor(): SpeechConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function isTelegramWebView(): boolean {
  if (typeof window === "undefined") return false;
  // Telegram injects window.Telegram.WebApp
  const tg = (window as Window & { Telegram?: { WebApp?: unknown } }).Telegram;
  if (tg?.WebApp) return true;
  // Fallback: user-agent sniff
  return /Telegram/i.test(navigator.userAgent);
}

function toErrorMessage(code?: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was denied.";
    case "audio-capture":
      return "No microphone was detected.";
    case "network":
      return "Speech recognition failed due to a network issue.";
    case "no-speech":
      return "No speech was detected. Try again.";
    default:
      return "Speech recognition failed.";
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSpeechRecognition(lang = "en-US", onStop?: (transcript: string) => void) {
  // Web Speech API
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // MediaRecorder (Telegram fallback)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const finalTranscriptRef = useRef("");
  const lastInterimRef = useRef("");
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return isTelegramWebView()
      ? !!(navigator.mediaDevices?.getUserMedia)
      : !!getSpeechConstructor();
  });
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    finalTranscriptRef.current = "";
    lastInterimRef.current = "";
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  // ── Web Speech API path ───────────────────────────────────────────────────

  const createRecognition = useCallback((Ctor: SpeechConstructor) => {
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const result = event.results[0];
      if (!result) return;
      const text = result[0]?.transcript ?? "";
      if (result.isFinal) {
        finalTranscriptRef.current = text.trim();
        lastInterimRef.current = "";
        setFinalTranscript(finalTranscriptRef.current);
        setInterimTranscript("");
      } else {
        lastInterimRef.current = text.trim();
        setInterimTranscript(text.trim());
      }
    };
    recognition.onerror = (event) => {
      setError(toErrorMessage(event.error));
    };
    recognition.onend = () => {
      const best = finalTranscriptRef.current || lastInterimRef.current;
      if (!finalTranscriptRef.current && lastInterimRef.current) {
        finalTranscriptRef.current = lastInterimRef.current;
        setFinalTranscript(finalTranscriptRef.current);
      }
      setIsListening(false);
      setInterimTranscript("");
      recognitionRef.current = null;
      onStopRef.current?.(best);
    };
    return recognition;
  }, []);

  const startWebSpeech = useCallback(() => {
    const Ctor = getSpeechConstructor();
    if (!Ctor) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    if (!recognitionRef.current) {
      recognitionRef.current = createRecognition(Ctor);
    }
    finalTranscriptRef.current = "";
    lastInterimRef.current = "";
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);

    const recognition = recognitionRef.current;
    recognition.lang = lang;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      try {
        recognitionRef.current = createRecognition(Ctor);
        recognitionRef.current.lang = lang;
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setError("Could not start voice input.");
        setIsListening(false);
      }
    }
  }, [lang, createRecognition]);

  const stopWebSpeech = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } finally {
      setIsListening(false);
    }
  }, []);

  // ── MediaRecorder + Groq Whisper path (Telegram) ─────────────────────────

  const startMediaRecorder = useCallback(async () => {
    setError(null);
    finalTranscriptRef.current = "";
    lastInterimRef.current = "";
    setFinalTranscript("");
    setInterimTranscript("");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone permission was denied.");
      return;
    }

    audioChunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Stop all tracks to release mic indicator.
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      audioChunksRef.current = [];
      setInterimTranscript("Transcribing…");

      try {
        const form = new FormData();
        form.append("audio", blob);
        form.append("lang", lang);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json();
        const text: string = (data.transcript ?? "").trim();
        finalTranscriptRef.current = text;
        setFinalTranscript(text);
        setInterimTranscript("");
        onStopRef.current?.(text);
      } catch {
        setInterimTranscript("");
        setError("Transcription failed. Try again.");
        onStopRef.current?.("");
      }

      setIsListening(false);
      mediaRecorderRef.current = null;
    };

    recorder.start();
    setIsListening(true);
  }, [lang]);

  const stopMediaRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    // isListening set to false inside onstop after transcription completes
  }, []);

  // ── Unified start / stop ──────────────────────────────────────────────────

  const start = useCallback(() => {
    if (isTelegramWebView()) {
      startMediaRecorder();
    } else {
      startWebSpeech();
    }
  }, [startMediaRecorder, startWebSpeech]);

  const stop = useCallback(() => {
    if (isTelegramWebView()) {
      stopMediaRecorder();
    } else {
      stopWebSpeech();
    }
  }, [stopMediaRecorder, stopWebSpeech]);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
        recognitionRef.current = null;
      }
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  }, []);

  return useMemo(
    () => ({
      isSupported,
      isListening,
      finalTranscript,
      interimTranscript,
      error,
      start,
      stop,
      reset,
    }),
    [isSupported, isListening, finalTranscript, interimTranscript, error, start, stop, reset],
  );
}