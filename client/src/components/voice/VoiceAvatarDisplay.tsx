import type { RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import AIAvatar from '../AIAvatar';
import type { AvatarState } from '../AIAvatar';

interface VoiceAvatarDisplayProps {
  status: 'idle' | 'connecting' | 'connected' | 'error';
  /** Set when WebRTC has actually decoded a video frame (avoids silent "black box"). */
  videoFrameReady: boolean;
  /** Optional ICE/WebRTC warning surfaced from the hook. */
  webrtcMediaHint: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  avatarVisualState: AvatarState;
}

export default function VoiceAvatarDisplay({
  status,
  videoFrameReady,
  webrtcMediaHint,
  videoRef,
  audioRef,
  avatarVisualState,
}: VoiceAvatarDisplayProps) {
  const showVideoSurface = status === 'connecting' || status === 'connected';
  const showWaitingOverlay = showVideoSurface && !videoFrameReady;

  return (
    <div className="flex flex-col items-center py-2 sm:py-3 w-full gap-2">
      {webrtcMediaHint && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 max-w-xl w-full">
          {webrtcMediaHint}
        </p>
      )}

      <div className="flex justify-center w-full">
        {/* WebRTC audio: hidden; speech from avatar stream */}
        <audio ref={audioRef} className="hidden" playsInline autoPlay />
        {showVideoSurface ? (
          <div className="relative w-full max-w-xl sm:max-w-2xl aspect-video rounded-2xl overflow-hidden ring-2 sm:ring-4 ring-primary-200/80 shadow-glow bg-surface-900">
            <video
              ref={videoRef}
              className="w-full h-full object-contain object-center bg-black"
              playsInline
              muted
              autoPlay
            />
            {showWaitingOverlay && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white text-sm px-4 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-300" aria-hidden />
                <span>กำลังรอภาพจาก Azure…</span>
                <span className="text-xs text-white/70 max-w-sm">
                  หากค้างนาน: ลอง Chrome/Edge ล่าสุด ปิด VPN หรือตรวจว่าเครือข่ายอนุญาต WebRTC (UDP 3478 / TCP 443)
                </span>
              </div>
            )}
          </div>
        ) : (
          <AIAvatar state={avatarVisualState} size={120} className="sm:w-40 sm:h-40" />
        )}
      </div>
    </div>
  );
}
