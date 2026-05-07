import { useState, useCallback, useRef, useEffect } from 'react';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { useAzureTalkingAvatar } from '../hooks/useAzureTalkingAvatar';
import { useAzureSpeechRecognizer } from '../hooks/useAzureSpeechRecognizer';
import { Volume2, VolumeX, Mic, Sparkles, MessagesSquare, ChevronsDownUp } from 'lucide-react';
import api from '../lib/api';
import { AZURE_AVATAR_PRESETS } from './voice/azureAvatarPresets';
import AzureAvatarConnectPanel from './voice/AzureAvatarConnectPanel';
import VoiceAvatarDisplay from './voice/VoiceAvatarDisplay';
import VoiceChatMessages, { type ConversationMessage } from './voice/VoiceChatMessages';
import VoiceChatToolbar from './voice/VoiceChatToolbar';

export type { ConversationMessage };

interface VoiceChatPanelProps {
  sessionId: string;
  onConversationComplete: (history: ConversationMessage[]) => void;
  disabled?: boolean;
}

export default function VoiceChatPanel({ sessionId, onConversationComplete, disabled }: VoiceChatPanelProps) {
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [showConversationPanel, setShowConversationPanel] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isProcessing = useRef(false);
  const turnTokenRef = useRef(0);
  const lastSubmittedRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const handleNurseResponseRef = useRef<(text: string) => void>(() => { });

  // ── TTS fallback (browser / server / Google) ─────────────────────────────
  const { speak, cancelSpeech } = useVoiceChat({
    lang: 'th-TH',
    rate: 0.95,
    onError: (message: string) => {
      setError(message);
      isProcessing.current = false;
    },
  });

  // ── Azure Talking Avatar ──────────────────────────────────────────────────
  const [azurePresetId, setAzurePresetId] = useState<string>(AZURE_AVATAR_PRESETS[0].id);
  const [azureVoiceGender, setAzureVoiceGender] = useState<'female' | 'male'>('female');
  const azurePreset = AZURE_AVATAR_PRESETS.find((p) => p.id === azurePresetId) ?? AZURE_AVATAR_PRESETS[0];

  const azure = useAzureTalkingAvatar({
    character: azurePreset.character,
    style: azurePreset.style,
    voiceGender: azureVoiceGender,
    onError: (message: string) => setError(message),
  });

  // ── Azure continuous STT ──────────────────────────────────────────────────
  const azureSTT = useAzureSpeechRecognizer({
    lang: 'th-TH',
    debounceMs: 600,
    onTranscript: (text: string) => {
      if (text.trim() && !isProcessing.current) {
        handleNurseResponseRef.current(text.trim());
      }
    },
    onError: (msg: string) => {
      // Non-fatal: show as soft error, don't block conversation
      console.warn('[AzureSTT]', msg);
      setError('ไมโครโฟน: ' + msg);
    },
  });

  // Keep a stable ref so callbacks can call the latest start/stop without stale closure
  const sttStartRef = useRef(azureSTT.startListening);
  const sttStopRef = useRef(azureSTT.stopListening);
  useEffect(() => { sttStartRef.current = azureSTT.startListening; }, [azureSTT.startListening]);
  useEffect(() => { sttStopRef.current = azureSTT.stopListening; }, [azureSTT.stopListening]);

  // ── Derived visual states ─────────────────────────────────────────────────
  const effectiveSpeaking = azure.isSpeaking;
  const isListening = azureSTT.isListening && !micMuted;

  const avatarVisualState = isLoading
    ? 'thinking'
    : effectiveSpeaking
      ? 'speaking'
      : isListening
        ? 'listening'
        : 'idle';

  // ── Voice state for VoiceChatMessages (keeps existing component working) ──
  const voiceState = isListening ? 'listening' : effectiveSpeaking ? 'speaking' : 'idle';

  useEffect(() => {
    if (!showConversationPanel) return;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, azureSTT.interimText, showConversationPanel]);

  useEffect(() => {
    setShowConversationPanel(false);
    setShowFullHistory(false);
  }, [sessionId]);

  // ── TTS: prefers avatar, falls back to browser TTS ───────────────────────
  const speakAssistant = useCallback(
    async (text: string) => {
      if (isMuted) return;
      if (azure.status === 'connecting') {
        return;
      }
      // If Azure is not configured, skip avatar entirely and go straight to browser TTS
      if (azure.status === 'not-configured') {
        await speak(text);
        return;
      }
      if (azure.isConnected) {
        try {
          await azure.speak(text);
          return;
        } catch (err) {
          console.warn('[VoiceChat] Avatar TTS failed, using fallback', err);
        }
      }
      await speak(text);
    },
    [azure, speak, isMuted]
  );

  // ── Main conversation loop ────────────────────────────────────────────────
  const getAIResponse = useCallback(
    async (currentHistory: ConversationMessage[]) => {
      // Stop mic before AI speaks to prevent echo
      sttStopRef.current();

      setIsLoading(true);
      setError('');
      isProcessing.current = true;
      const currentTurnToken = Date.now();
      turnTokenRef.current = currentTurnToken;

      try {
        const res = await api.post(`/assessments/${sessionId}/chat`, {
          history: currentHistory,
        });

        const { message, isComplete: done } = res.data;
        const safeMessage =
          typeof message === 'string' && message.trim()
            ? message.trim()
            : 'ขออภัยค่ะ ระบบตอบกลับไม่สมบูรณ์ กรุณาลองพูดอีกครั้ง';
        const safeDone = typeof done === 'boolean' ? done : false;

        const newHistory: ConversationMessage[] = [
          ...currentHistory,
          { role: 'ai' as const, text: safeMessage },
        ];
        setHistory(newHistory);

        // Speak AI reply
        await speakAssistant(safeMessage);

        if (safeDone) {
          setIsComplete(true);
          onConversationComplete(newHistory);
        } else {
          // Only restart listening if this turn is still the active one
          if (turnTokenRef.current === currentTurnToken && !micMuted) {
            isProcessing.current = false;
            void sttStartRef.current();
          } else {
            isProcessing.current = false;
          }
        }
      } catch (err: unknown) {
        console.error('AI chat error:', err);
        const axiosErr = err as { response?: { data?: { error?: string; fallback?: string } } };
        const errCode = axiosErr.response?.data?.error;
        const fallbackText = axiosErr.response?.data?.fallback;

        if (errCode === 'TTS_UNAVAILABLE' && fallbackText) {
          // TTS failed but we have the text — show it as a message and continue
          const newHistory: ConversationMessage[] = [
            ...currentHistory,
            { role: 'ai' as const, text: fallbackText },
          ];
          setHistory(newHistory);
          setError('ระบบเสียงไม่พร้อมใช้งาน แสดงข้อความแทน');
        } else {
          setError(axiosErr.response?.data?.error || 'เกิดข้อผิดพลาดในการสนทนา');
        }

        isProcessing.current = false;
        if (!micMuted) void sttStartRef.current();
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, speakAssistant, micMuted, onConversationComplete]
  );

  // ── Nurse response handler ────────────────────────────────────────────────
  const handleNurseResponse = useCallback(
    async (text: string) => {
      const cleaned = text.trim();
      if (!cleaned || isComplete || isProcessing.current) return;
      const now = Date.now();
      if (
        lastSubmittedRef.current.text === cleaned &&
        now - lastSubmittedRef.current.at < 1200
      ) {
        return;
      }
      lastSubmittedRef.current = { text: cleaned, at: now };
      isProcessing.current = true;
      sttStopRef.current();

      const newHistory: ConversationMessage[] = [...history, { role: 'nurse' as const, text: cleaned }];
      setHistory(newHistory);

      await getAIResponse(newHistory);
    },
    [history, isComplete, getAIResponse]
  );

  useEffect(() => {
    handleNurseResponseRef.current = handleNurseResponse;
  }, [handleNurseResponse]);

  // ── Start conversation ────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setShowConversationPanel(false);
    setShowFullHistory(false);
    setStarted(true);
    await getAIResponse([]);
  }, [getAIResponse]);

  // ── Skip AI speech and start listening immediately ────────────────────────
  const handleSkipSpeech = useCallback(() => {
    cancelSpeech();
    void azure.stopSpeaking();
    if (!isComplete && !micMuted) {
      isProcessing.current = false;
      void sttStartRef.current();
    }
  }, [cancelSpeech, azure, isComplete, micMuted]);

  // ── Mute speaker ─────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      if (!m) {
        cancelSpeech();
        void azure.stopSpeaking();
      }
      return !m;
    });
  }, [cancelSpeech, azure]);

  // ── Mute/unmute microphone ────────────────────────────────────────────────
  const toggleMicMute = useCallback(() => {
    setMicMuted((m) => {
      if (!m) {
        // Muting: stop recognition
        sttStopRef.current();
      } else {
        // Unmuting: restart if conversation is in progress and not processing
        if (started && !isComplete && !isProcessing.current) {
          void sttStartRef.current();
        }
      }
      return !m;
    });
  }, [started, isComplete]);

  // ── Manual text input ─────────────────────────────────────────────────────
  const [manualText, setManualText] = useState('');
  const handleManualSubmit = useCallback(() => {
    if (!manualText.trim() || isComplete || isProcessing.current) return;
    handleNurseResponse(manualText.trim());
    setManualText('');
  }, [manualText, isComplete, handleNurseResponse]);

  // ── End conversation early ────────────────────────────────────────────────
  const handleCompleteAndAssess = useCallback(async () => {
    if (isComplete || isLoading) return;
    const pendingText = azureSTT.consumePendingText();
    const finalHistory: ConversationMessage[] = pendingText
      ? [...history, { role: 'nurse' as const, text: pendingText }]
      : history;
    if (pendingText) {
      setHistory(finalHistory);
    }
    sttStopRef.current();
    cancelSpeech();
    void azure.stopSpeaking();
    const nurseTurns = finalHistory.filter((item) => item.role === 'nurse' && item.text.trim()).length;
    if (nurseTurns === 0) {
      setError('กรุณาตอบอย่างน้อย 1 ครั้งก่อนจบการสนทนา');
      return;
    }
    isProcessing.current = true;
    setIsComplete(true);
    await onConversationComplete(finalHistory);
  }, [history, isComplete, isLoading, azureSTT, cancelSpeech, azure, onConversationComplete]);

  const nurseTurnCount = history.filter((item) => item.role === 'nurse' && item.text.trim()).length;

  return (
    <div className="card overflow-hidden !p-0" translate="no">
      {/* Header */}
      <div className="relative overflow-hidden px-3 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative flex items-center justify-between">
          <h3 className="text-white font-bold flex items-center gap-2 text-sm sm:text-base">
            <Sparkles className="w-4 sm:w-5 h-4 sm:h-5 text-accent-200" />
            <span className="hidden sm:inline">AI Avatar — สนทนาประเมินสมรรถนะ</span>
            <span className="sm:hidden">AI Avatar</span>
          </h3>
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm"
            title={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <AzureAvatarConnectPanel
          azure={azure}
          azurePresetId={azurePresetId}
          onPresetIdChange={setAzurePresetId}
          azureVoiceGender={azureVoiceGender}
          onVoiceGenderChange={setAzureVoiceGender}
          disabled={disabled}
        />

        <VoiceAvatarDisplay
          status={azure.status}
          videoFrameReady={azure.videoFrameReady}
          webrtcMediaHint={azure.webrtcMediaHint}
          videoRef={azure.videoRef}
          audioRef={azure.audioRef}
          avatarVisualState={avatarVisualState}
        />

        {/* Pre-start screen */}
        {!started && (
          <div className="text-center py-4 sm:py-6 animate-fade-in-up">
            <p className="text-surface-600 mb-2 font-medium text-sm sm:text-base px-2">
              AI Avatar จะสนทนากับคุณเพื่อประเมินสมรรถนะทางการพยาบาล
            </p>
            <p className="text-xs sm:text-sm text-surface-400 mb-4 sm:mb-5 px-2">
              ระบบจะถาม 3-4 คำถามเกี่ยวกับกรณีศึกษา แล้วประเมินจากคำตอบของคุณ
            </p>

            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-primary-50 text-primary-700 text-xs sm:text-sm rounded-2xl text-left mx-auto max-w-md border border-primary-100">
              <p className="font-semibold mb-1.5 sm:mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 sm:w-4 h-3 sm:h-4 text-primary-500" />
                คำแนะนำ
              </p>
              <ul className="space-y-1 sm:space-y-1.5 text-primary-600/80">
                <li className="flex items-start gap-1.5 sm:gap-2">
                  <span className="mt-0.5 sm:mt-1 w-1 h-1 rounded-full bg-primary-400 flex-shrink-0" />
                  <span className="leading-snug">
                    ใช้ <strong>Google Chrome</strong> หรือ <strong>Microsoft Edge</strong> เวอร์ชันล่าสุด
                  </span>
                </li>
                <li className="flex items-start gap-1.5 sm:gap-2">
                  <span className="mt-0.5 sm:mt-1 w-1 h-1 rounded-full bg-primary-400 flex-shrink-0" />
                  <span className="leading-snug">
                    ใช้ <strong>ไมโครโฟน/หูฟัง</strong> ในสภาพแวดล้อมที่เงียบ เพื่อป้องกัน echo
                  </span>
                </li>
                <li className="flex items-start gap-1.5 sm:gap-2">
                  <span className="mt-0.5 sm:mt-1 w-1 h-1 rounded-full bg-primary-400 flex-shrink-0" />
                  <span className="leading-snug">
                    ไมโครโฟนจะเปิดอัตโนมัติหลัง AI พูดจบ — <strong>ไม่ต้องกดปุ่ม</strong>
                  </span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={disabled}
              className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-3.5 shadow-glow hover:shadow-glow-lg transition-all"
            >
              <span className="flex items-center gap-2">
                <Mic className="w-4 sm:w-5 h-4 sm:h-5" />
                <span className="hidden sm:inline">เริ่มสนทนากับ AI Avatar</span>
                <span className="sm:hidden">เริ่มสนทนา</span>
              </span>
            </button>
          </div>
        )}

        {/* Active conversation */}
        {started && (
          <>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConversationPanel((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors"
              >
                <MessagesSquare className="w-3.5 h-3.5" />
                {showConversationPanel ? 'ซ่อนบทสนทนา' : 'ดูบทสนทนา'}
                <ChevronsDownUp className="w-3.5 h-3.5" />
              </button>
              {showConversationPanel && (
                <button
                  type="button"
                  onClick={() => setShowFullHistory((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors"
                >
                  <MessagesSquare className="w-3.5 h-3.5" />
                  {showFullHistory ? 'แสดงเฉพาะข้อความล่าสุด' : 'แสดงประวัติทั้งหมด'}
                </button>
              )}
            </div>

            {showConversationPanel && (
              <VoiceChatMessages
                history={history}
                voiceState={voiceState}
                interimText={azureSTT.interimText}
                isLoading={isLoading}
                displayMode={showFullHistory ? 'fullHistory' : 'latestOnly'}
                chatEndRef={chatEndRef}
              />
            )}

            {!isComplete && (
              <VoiceChatToolbar
                isListening={isListening}
                connectingSTT={azureSTT.status === 'connecting'}
                isAISpeaking={effectiveSpeaking}
                isLoading={isLoading}
                micMuted={micMuted}
                manualText={manualText}
                onManualTextChange={setManualText}
                onManualSubmit={handleManualSubmit}
                onSkipSpeech={handleSkipSpeech}
                onToggleMicMute={toggleMicMute}
                onCompleteAndAssess={handleCompleteAndAssess}
                nurseTurnCount={nurseTurnCount}
              />
            )}

            {isComplete && (
              <div className="mt-5 text-center py-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 animate-scale-in">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <p className="font-semibold text-sky-700">สนทนาเสร็จสิ้น</p>
                <p className="text-sm text-sky-600 mt-1">กำลังประมวลผลคะแนนจากบทสนทนา...</p>
              </div>
            )}

            {error && (
              <div className="mt-3 p-4 bg-red-50 border border-red-100 rounded-2xl animate-scale-in">
                <p className="text-sm text-red-700 font-medium">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    isProcessing.current = false;
                    if (!isComplete && !micMuted) void sttStartRef.current();
                  }}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold mt-2 transition-colors"
                >
                  ลองอีกครั้ง
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
