import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioConfig,
  CancellationReason,
  ResultReason,
  SpeechConfig,
  SpeechRecognizer,
} from 'microsoft-cognitiveservices-speech-sdk';
import api from '../lib/api';

export type AzureRecognizerStatus = 'idle' | 'connecting' | 'listening' | 'error' | 'browser-stt';

interface UseAzureSpeechRecognizerOptions {
  /** BCP-47 language tag. Defaults to 'th-TH'. */
  lang?: string;
  /** Milliseconds of silence before the accumulated text is emitted. Defaults to 1500. */
  debounceMs?: number;
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (msg: string) => void;
}

export interface UseAzureSpeechRecognizerReturn {
  status: AzureRecognizerStatus;
  interimText: string;
  isListening: boolean;
  consumePendingText: () => string;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

export function useAzureSpeechRecognizer(
  options: UseAzureSpeechRecognizerOptions
): UseAzureSpeechRecognizerReturn {
  const { lang = 'th-TH', debounceMs = 1500, onTranscript, onInterim, onError } = options;

  const [status, setStatus] = useState<AzureRecognizerStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);

  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const browserRecognizerRef = useRef<any>(null);
  const pendingTextRef = useRef('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep callbacks in refs so we never need to rebuild the recognizer on callback changes.
  const onTranscriptRef = useRef(onTranscript);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const consumePendingText = useCallback((): string => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const full = pendingTextRef.current.trim();
    pendingTextRef.current = '';
    setInterimText('');
    return full;
  }, []);

  const stopListening = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingTextRef.current = '';
    setInterimText('');
    setIsListening(false);
    setStatus('idle');

    const recognizer = recognizerRef.current;
    recognizerRef.current = null;
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync(
        () => { try { recognizer.close(); } catch { /* ignore */ } },
        () => { try { recognizer.close(); } catch { /* ignore */ } }
      );
    }
  }, []);

  const startListening = useCallback(async () => {
    if (recognizerRef.current) return; // already running

    setStatus('connecting');
    setInterimText('');
    pendingTextRef.current = '';

    try {
      const { data } = await api.get<{
        success: boolean;
        token?: string;
        region?: string;
        message?: string;
      }>('/azure/speech-token');

      if (!data.success || !data.token || !data.region) {
        throw new Error(data.message || 'ไม่สามารถดึง speech token ได้');
      }

      const speechConfig = SpeechConfig.fromAuthorizationToken(data.token, data.region);
      speechConfig.speechRecognitionLanguage = lang;

      const audioConfig = AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      // Interim results — show live transcription
      recognizer.recognizing = (_, e) => {
        if (e.result.reason === ResultReason.RecognizingSpeech) {
          const interim = (pendingTextRef.current + ' ' + e.result.text).trim();
          setInterimText(interim);
          onInterimRef.current?.(interim);
        }
      };

      // Finalized segments — accumulate and debounce before emitting
      recognizer.recognized = (_, e) => {
        if (e.result.reason === ResultReason.RecognizedSpeech && e.result.text.trim()) {
          pendingTextRef.current = (pendingTextRef.current + ' ' + e.result.text.trim()).trim();
          setInterimText(pendingTextRef.current);

          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            const full = pendingTextRef.current.trim();
            pendingTextRef.current = '';
            setInterimText('');
            if (full) onTranscriptRef.current(full);
          }, debounceMs);
        }
      };

      recognizer.canceled = (_, e) => {
        // Ignore End-of-stream cancellation (happens on normal stop)
        if (e.reason === CancellationReason.Error && e.errorDetails) {
          onErrorRef.current?.(e.errorDetails);
          setStatus('error');
        } else {
          setStatus('idle');
        }
        setIsListening(false);
        if (recognizerRef.current === recognizer) recognizerRef.current = null;
      };

      recognizer.sessionStopped = () => {
        if (recognizerRef.current === recognizer) {
          recognizerRef.current = null;
        }
        setIsListening(false);
        setStatus('idle');
      };

      recognizer.startContinuousRecognitionAsync(
        () => {
          setIsListening(true);
          setStatus('listening');
        },
        (err) => {
          setStatus('error');
          setIsListening(false);
          recognizerRef.current = null;
          onErrorRef.current?.(String(err));
        }
      );
    } catch (err) {
  // Try browser STT fallback
  const BrowserSTT = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (BrowserSTT) {
    const browserRec = new BrowserSTT();
    browserRec.lang = lang;
    browserRec.continuous = true;
    browserRec.interimResults = true;
    browserRecognizerRef.current = browserRec;

    browserRec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (interim) { setInterimText(interim); onInterimRef.current?.(interim); }
      if (final.trim()) onTranscriptRef.current(final.trim());
    };
    browserRec.onerror = (e: any) => {
      setStatus('error');
      setIsListening(false);
      onErrorRef.current?.(e.error);
    };
    browserRec.onend = () => {
      setIsListening(false);
      setStatus('idle');
    };
    browserRec.start();
    setStatus('browser-stt');
    setIsListening(true);
  } else {
    setStatus('error');
    setIsListening(false);
    onErrorRef.current?.(err instanceof Error ? err.message : String(err));
  }
}
  }, [lang, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      const recognizer = recognizerRef.current;
      recognizerRef.current = null;
      if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(
          () => { try { recognizer.close(); } catch { /* ignore */ } },
          () => { try { recognizer.close(); } catch { /* ignore */ } }
        );
      }
    };
  }, []);

  return { status, interimText, isListening, consumePendingText, startListening, stopListening };
}
