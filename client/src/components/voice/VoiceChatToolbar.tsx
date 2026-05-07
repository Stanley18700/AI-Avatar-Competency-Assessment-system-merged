import { Mic, MicOff, Send, SkipForward } from 'lucide-react';

interface VoiceChatToolbarProps {
  isListening: boolean;
  connectingSTT: boolean;
  isAISpeaking: boolean;
  isLoading: boolean;
  micMuted: boolean;
  manualText: string;
  onManualTextChange: (value: string) => void;
  onManualSubmit: () => void;
  onSkipSpeech: () => void;
  onToggleMicMute: () => void;
  onCompleteAndAssess: () => void;
  nurseTurnCount: number;
}

export default function VoiceChatToolbar({
  isListening,
  connectingSTT,
  isAISpeaking,
  isLoading,
  micMuted,
  manualText,
  onManualTextChange,
  onManualSubmit,
  onSkipSpeech,
  onToggleMicMute,
  onCompleteAndAssess,
  nurseTurnCount,
}: VoiceChatToolbarProps) {
  return (
    <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">

      {/* Status row */}
      <div className="flex items-center justify-between gap-3">
        {/* Listening / speaking / waiting indicator */}
        <div className="flex items-center gap-2 min-w-0">
          {isLoading ? (
            <span className="text-xs sm:text-sm text-surface-400 italic">กำลังประมวลผล...</span>
          ) : isAISpeaking ? (
            <span className="flex items-center gap-1.5 text-xs sm:text-sm text-primary-600 font-medium animate-pulse">
              <span className="w-2 h-2 rounded-full bg-primary-500 inline-block" />
              AI กำลังพูด...
            </span>
          ) : connectingSTT ? (
            <span className="text-xs sm:text-sm text-surface-400 italic">กำลังเชื่อมต่อไมค์...</span>
          ) : micMuted ? (
            <span className="flex items-center gap-1.5 text-xs sm:text-sm text-surface-500">
              <MicOff className="w-3.5 h-3.5" />
              ปิดไมค์อยู่
            </span>
          ) : isListening ? (
            <span className="flex items-center gap-1.5 text-xs sm:text-sm text-emerald-600 font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              กำลังฟัง — พูดได้เลย
            </span>
          ) : (
            <span className="text-xs sm:text-sm text-surface-400">รอการตอบกลับจาก AI...</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Skip AI speech */}
          {isAISpeaking && (
            <button
              type="button"
              onClick={onSkipSpeech}
              title="ข้ามเสียงพูด"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-100 hover:bg-surface-200 text-surface-600 transition-all"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ข้ามเสียง</span>
            </button>
          )}

          {/* Mute / unmute mic */}
          <button
            type="button"
            onClick={onToggleMicMute}
            title={micMuted ? 'เปิดไมค์' : 'ปิดไมค์'}
            className={`p-2 rounded-xl transition-all ${
              micMuted
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Manual text input */}
      <div className="flex gap-2">
        <input
          type="text"
          className="input-field flex-1 text-xs sm:text-sm !rounded-xl"
          placeholder="หรือพิมพ์คำตอบที่นี่..."
          value={manualText}
          onChange={(e) => onManualTextChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onManualSubmit()}
          disabled={isLoading || isAISpeaking}
        />
        <button
          type="button"
          onClick={onManualSubmit}
          disabled={!manualText.trim() || isLoading || isAISpeaking}
          className="btn-primary !px-3 sm:!px-4 !rounded-xl"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Complete button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onCompleteAndAssess}
          disabled={isLoading || nurseTurnCount === 0}
          className="btn-secondary text-xs sm:text-sm"
        >
          จบการสนทนาและประเมินผล
        </button>
      </div>
    </div>
  );
}
