"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

function getSpeechConstructor(): SpeechConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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

export function useSpeechRecognition(lang = "en-US", onStop?: (transcript: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(() => !!getSpeechConstructor());
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    finalTranscriptRef.current = "";
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechConstructor();
    if (!Ctor) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    // Abort and discard previous instance so we get a clean start each time.
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    // Reset transcript for the new session.
    finalTranscriptRef.current = "";
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.onresult = (event) => {
      let nextFinal = "";
      let nextInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (!text) continue;
        if (result.isFinal) {
          nextFinal += `${text} `;
        } else {
          nextInterim += text;
        }
      }
      if (nextFinal) {
        finalTranscriptRef.current = `${finalTranscriptRef.current}${nextFinal}`.trim();
        setFinalTranscript(finalTranscriptRef.current);
      }
      setInterimTranscript(nextInterim.trim());
    };
    recognition.onerror = (event) => {
      setError(toErrorMessage(event.error));
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      onStopRef.current?.(finalTranscriptRef.current);
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setError("Could not start voice input.");
      setIsListening(false);
    }
  }, [lang]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } finally {
      setIsListening(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
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
    [
      isSupported,
      isListening,
      finalTranscript,
      interimTranscript,
      error,
      start,
      stop,
      reset,
    ],
  );
}

