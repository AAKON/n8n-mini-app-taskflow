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

export function useSpeechRecognition(lang = "en-US") {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(() => !!getSpeechConstructor());
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
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

    if (!recognitionRef.current) {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
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
          setFinalTranscript((prev) => `${prev}${nextFinal}`.trim());
        }
        setInterimTranscript(nextInterim.trim());
      };
      recognition.onerror = (event) => {
        setError(toErrorMessage(event.error));
      };
      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
      };
      recognitionRef.current = recognition;
    }

    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.lang = lang;
    setError(null);
    setInterimTranscript("");
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

