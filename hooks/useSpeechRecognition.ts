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

  const createRecognition = useCallback((Ctor: SpeechConstructor) => {
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      // Rebuild from full results list every time — avoids duplication caused
      // by browsers that incorrectly send resultIndex=0 on every event.
      let fullFinal = "";
      let currentInterim = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (!text) continue;
        if (result.isFinal) {
          fullFinal += `${text} `;
        } else {
          currentInterim += text;
        }
      }
      finalTranscriptRef.current = fullFinal.trim();
      setFinalTranscript(finalTranscriptRef.current);
      setInterimTranscript(currentInterim.trim());
    };
    recognition.onerror = (event) => {
      setError(toErrorMessage(event.error));
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      onStopRef.current?.(finalTranscriptRef.current);
    };
    return recognition;
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechConstructor();
    if (!Ctor) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    // Lazy-create instance once; reuse to avoid re-triggering mic permission.
    if (!recognitionRef.current) {
      recognitionRef.current = createRecognition(Ctor);
    }

    // Reset transcript state for the new session.
    finalTranscriptRef.current = "";
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);

    const recognition = recognitionRef.current;
    recognition.lang = lang;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      // Some mobile browsers refuse to restart a stopped instance.
      // Recreate once and retry — this still reuses across most sessions.
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

