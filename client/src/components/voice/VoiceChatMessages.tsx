import type { RefObject } from 'react';
import { Loader2 } from 'lucide-react';

type VoiceState = 'idle' | 'listening' | 'speaking' | 'thinking';

export interface ConversationMessage {
  role: 'ai' | 'nurse';
  text: string;
}

interface VoiceChatMessagesProps {
  history: ConversationMessage[];
  voiceState: VoiceState;
  interimText: string;
  isLoading: boolean;
  displayMode: 'latestOnly' | 'fullHistory';
  chatEndRef: RefObject<HTMLDivElement | null>;
}

export default function VoiceChatMessages({
  history,
  voiceState,
  interimText,
  isLoading,
  displayMode,
  chatEndRef,
}: VoiceChatMessagesProps) {
  const visibleHistory = displayMode === 'latestOnly' ? history.slice(-1) : history;

  return (
    <div className="h-64 sm:h-80 overflow-y-auto px-1 py-2 space-y-2 sm:space-y-3 mt-2">
      {visibleHistory.map((msg, idx) => (
        <div
          key={`${msg.role}-${idx}-${msg.text.slice(0, 24)}`}
          className={`flex ${msg.role === 'nurse' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
          style={{ animationDelay: '50ms' }}
        >
          <div
            className={`max-w-[85%] sm:max-w-[80%] min-w-0 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm leading-relaxed shadow-sm ${
              msg.role === 'ai'
                ? 'bg-surface-50 border border-surface-100 text-surface-800 rounded-bl-md'
                : 'bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-br-md shadow-glow-sm'
            }`}
          >
            <p className="text-[9px] sm:text-[10px] font-semibold mb-1 opacity-50 uppercase tracking-wider">
              {msg.role === 'ai' ? '🤖 AI Avatar' : '👩‍⚕️ คุณ'}
            </p>
            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
          </div>
        </div>
      ))}

      {voiceState === 'listening' && interimText && (
        <div className="flex justify-end animate-fade-in">
          <div className="max-w-[80%] min-w-0 rounded-2xl px-4 py-3 text-sm bg-primary-50 text-primary-700 rounded-br-md italic border border-primary-100 whitespace-pre-wrap break-words">
            {interimText}...
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-start animate-fade-in">
          <div className="bg-surface-50 border border-surface-100 rounded-2xl px-4 py-3 rounded-bl-md">
            <div className="flex items-center gap-2 text-sm text-surface-400">
              <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
              <span>กำลังคิด...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}
