import type { ReactNode } from 'react';

interface RespondStepProps {
  useVoiceMode: boolean;
  onVoiceModeChange: (voice: boolean) => void;
  voiceChat: ReactNode;
  textMode: ReactNode;
}

export default function RespondStep({
  useVoiceMode,
  onVoiceModeChange,
  voiceChat,
  textMode,
}: RespondStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-0 text-xs sm:text-sm overflow-hidden rounded-lg">
        <button
          type="button"
          onClick={() => onVoiceModeChange(true)}
          className={`flex-1 px-3 sm:px-4 py-2 font-medium transition-colors ${
            useVoiceMode ? 'bg-indigo-600 text-white' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
          }`}
        >
          <span className="truncate">🎙 สนทนาด้วยเสียง</span>
        </button>
        <button
          type="button"
          onClick={() => onVoiceModeChange(false)}
          className={`flex-1 px-3 sm:px-4 py-2 font-medium transition-colors ${
            !useVoiceMode ? 'bg-indigo-600 text-white' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
          }`}
        >
          <span className="truncate">⌨️ พิมพ์คำตอบ</span>
        </button>
      </div>

      {useVoiceMode ? voiceChat : textMode}
    </div>
  );
}