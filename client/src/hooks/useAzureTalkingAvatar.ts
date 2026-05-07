import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  AvatarConfig,
  AvatarSynthesizer,
  AvatarVideoFormat,
  ResultReason,
  SpeechConfig,
} from 'microsoft-cognitiveservices-speech-sdk';
import api from '../lib/api';

function escapeSsmlText(text: string): string {
  return text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
}

export type AzureAvatarVoiceGender = 'female' | 'male';

/** Thai neural TTS — natural phrasing for long nursing dialogue when paired with prosodic SSML. */
function voiceNameForGender(gender: AzureAvatarVoiceGender): string {
  return gender === 'female' ? 'th-TH-PremwadeeNeural' : 'th-TH-NiwatNeural';
}

/** Insert SSML breaks after sentence-like boundaries for clearer pauses (text is plain; escaped before tags). */
function buildProsodicSsmlBody(text: string): string {
  const t = text.trim();
  if (!t) return '';
  let e = escapeSsmlText(t);
  e = e.replace(/\r\n/g, '\n');
  e = e.replace(/\n{2,}/g, '<break time="400ms"/>');
  e = e.replace(/\n/g, '<break time="320ms"/>');
  e = e.replace(/([。！？.!?])(\s*)/gu, '$1$2<break time="300ms"/>');
  return e;
}

interface IceServerPayload {
  Urls?: string | string[];
  urls?: string | string[];
  Username?: string;
  username?: string;
  Password?: string;
  password?: string;
}

/** Azure relay token returns Urls / Username / Password; prefer TURN URLs per Microsoft guidance. */
function normalizeIceServers(icePayload: unknown): RTCIceServer[] {
  if (!icePayload || typeof icePayload !== 'object') {
    return [];
  }
  const raw = icePayload as Record<string, unknown>;

  if (Array.isArray(raw.iceServers)) {
    return (raw.iceServers as RTCIceServer[]).map((s) => {
      const u = s.urls ?? (s as IceServerPayload).Urls ?? (s as IceServerPayload).urls;
      const list = Array.isArray(u) ? u : u ? [u] : [];
      const turnOnly = list.filter((x) => String(x).startsWith('turn:'));
      return { ...s, urls: turnOnly.length ? turnOnly : list };
    });
  }

  const single = icePayload as IceServerPayload;
  const urls = single.Urls ?? single.urls;
  const username = single.Username ?? single.username;
  const credential = single.Password ?? single.password;
  if (urls) {
    const list = Array.isArray(urls) ? urls : [urls];
    const turnOnly = list.filter((u) => String(u).startsWith('turn:'));
    const useList = turnOnly.length ? turnOnly : list;
    return [
      {
        urls: useList,
        username: username ?? undefined,
        credential: credential ?? undefined,
      },
    ];
  }
  return [];
}

/** Add TCP :443 TURN candidate (Azure sample) when UDP 3478 is blocked. */
function expandIceServersWithTcpFallback(servers: RTCIceServer[]): RTCIceServer[] {
  return servers.map((s) => {
    const urls = s.urls;
    const list = Array.isArray(urls) ? urls : urls ? [urls] : [];
    const extra: string[] = [];
    for (const u of list) {
      const ustr = String(u);
      if (ustr.startsWith('turn:') && ustr.includes(':3478') && !ustr.includes('transport=tcp')) {
        extra.push(ustr.replace(':3478', ':443?transport=tcp'));
      }
    }
    if (extra.length === 0) return s;
    return { ...s, urls: [...list, ...extra] };
  });
}

export interface UseAzureTalkingAvatarOptions {
  character?: string;
  style?: string;
  voiceGender?: AzureAvatarVoiceGender;
  onError?: (message: string) => void;
}

export interface UseAzureTalkingAvatarReturn {
  videoRef: RefObject<HTMLVideoElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  status: 'idle' | 'connecting' | 'connected' | 'error' | 'not-configured';
  connectError: string | null;
  isConnected: boolean;
  isSpeaking: boolean;
  voiceGender: AzureAvatarVoiceGender;
  setVoiceGender: (g: AzureAvatarVoiceGender) => void;
  character: string;
  style: string;
  setCharacter: (c: string) => void;
  setStyle: (s: string) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  /** True after first decoded video frame (otherwise area may look black while connected). */
  videoFrameReady: boolean;
  /** ICE / WebRTC hint for UI when the panel is connected but media is missing or unstable. */
  webrtcMediaHint: string | null;
}

const RECONNECT_COOLDOWN_MS = 1000;
const FAILED_CONNECT_COOLDOWN_MS = 30000;
const NO_VIDEO_FRAME_HINT_MS = 10000;

export function useAzureTalkingAvatar(
  options: UseAzureTalkingAvatarOptions = {}
): UseAzureTalkingAvatarReturn {
  const {
    character: initialCharacter = 'lisa',
    style: initialStyle = 'casual-sitting',
    voiceGender: initialVoiceGender = 'female',
    onError,
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'not-configured'>('idle');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [character, setCharacter] = useState(initialCharacter);
  const [style, setStyle] = useState(initialStyle);
  const [voiceGender, setVoiceGender] = useState<AzureAvatarVoiceGender>(initialVoiceGender);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const avatarSynthesizerRef = useRef<AvatarSynthesizer | null>(null);
  const speechConfigRef = useRef<SpeechConfig | null>(null);
  const lastDisconnectRef = useRef<number>(0);
  const lastFailedConnectRef = useRef<number>(0);
  const connectingRef = useRef(false);
  const connectedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const pendingVideoStreamRef = useRef<MediaStream | null>(null);
  const pendingAudioStreamRef = useRef<MediaStream | null>(null);
  const noFrameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const [videoFrameReady, setVideoFrameReady] = useState(false);
  const [webrtcMediaHint, setWebrtcMediaHint] = useState<string | null>(null);
  const statusRef = useRef<'idle' | 'connecting' | 'connected' | 'error' | 'not-configured'>('idle');
  const videoFrameReadyRef = useRef(false);

  useEffect(() => {
    if (connectedRef.current) return;
    setCharacter(initialCharacter);
    setStyle(initialStyle);
  }, [initialCharacter, initialStyle]);

  useEffect(() => {
    if (connectedRef.current) return;
    setVoiceGender(initialVoiceGender);
  }, [initialVoiceGender]);

  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    videoFrameReadyRef.current = videoFrameReady;
  }, [videoFrameReady]);

  const refreshSpeechAuth = useCallback(async (): Promise<void> => {
    const { data } = await api.get<{ success: boolean; token?: string; message?: string }>(
      '/azure/speech-token'
    );
    if (!data.success || !data.token) {
      throw new Error(data.message || 'speech-token failed');
    }
    const sc = speechConfigRef.current;
    if (sc) {
      sc.authorizationToken = data.token;
    }
  }, []);

  const clearMedia = useCallback(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (v) v.srcObject = null;
    if (a) a.srcObject = null;
  }, []);

  const clearNoFrameTimer = useCallback(() => {
    if (noFrameTimerRef.current) {
      clearTimeout(noFrameTimerRef.current);
      noFrameTimerRef.current = null;
    }
  }, []);

  const armNoFrameTimer = useCallback(() => {
    clearNoFrameTimer();
    noFrameTimerRef.current = setTimeout(() => {
      if (videoFrameReadyRef.current) return;
      const current = statusRef.current;
      if (current === 'connecting' || current === 'connected') {
        setWebrtcMediaHint(
          'เชื่อมต่อแล้วแต่ยังไม่เห็นภาพจาก Avatar — ตรวจเครือข่าย (UDP 3478 / TCP 443), ปิด VPN หรือทดลองเครือข่ายอื่น'
        );
      }
    }, NO_VIDEO_FRAME_HINT_MS);
  }, [clearNoFrameTimer]);

  const attachVideoStream = useCallback(
    (stream: MediaStream): boolean => {
      pendingVideoStreamRef.current = stream;
      const v = videoRef.current;
      if (!v) return false;
      v.srcObject = stream;
      void v.play().catch(() => {});
      const markReady = () => {
        setVideoFrameReady(true);
        setWebrtcMediaHint(null);
        clearNoFrameTimer();
      };
      v.addEventListener('loadeddata', markReady, { once: true });
      const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?(cb: () => void): number })
        .requestVideoFrameCallback;
      rvfc?.call(v, markReady);
      return true;
    },
    [clearNoFrameTimer]
  );

  const attachAudioStream = useCallback((stream: MediaStream): boolean => {
    pendingAudioStreamRef.current = stream;
    const a = audioRef.current;
    if (!a) return false;
    a.srcObject = stream;
    void a.play().catch(() => {});
    return true;
  }, []);

  const tryAttachPendingMedia = useCallback(() => {
    if (pendingVideoStreamRef.current) {
      attachVideoStream(pendingVideoStreamRef.current);
    }
    if (pendingAudioStreamRef.current) {
      attachAudioStream(pendingAudioStreamRef.current);
    }
  }, [attachAudioStream, attachVideoStream]);

  const disconnect = useCallback(async () => {
    connectingRef.current = false;
    lastDisconnectRef.current = Date.now();
    clearNoFrameTimer();

    const pc = peerConnectionRef.current;
    peerConnectionRef.current = null;
    if (pc) {
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    }

    const synth = avatarSynthesizerRef.current;
    avatarSynthesizerRef.current = null;
    speechConfigRef.current = null;
    connectedRef.current = false;
    isSpeakingRef.current = false;

    if (synth) {
      try {
        await synth.stopAvatarAsync();
      } catch {
        try {
          await synth.close();
        } catch {
          /* ignore */
        }
      }
    }

    clearMedia();
    pendingVideoStreamRef.current = null;
    pendingAudioStreamRef.current = null;
    setVideoFrameReady(false);
    setWebrtcMediaHint(null);
    setStatus('idle');
    setIsSpeaking(false);
    isSpeakingRef.current = false;
  }, [clearMedia, clearNoFrameTimer]);

  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;

  useEffect(() => {
    return () => {
      void disconnectRef.current();
    };
  }, []);

  useEffect(() => {
    if (status !== 'connecting' && status !== 'connected') return;
    tryAttachPendingMedia();
  }, [status, tryAttachPendingMedia]);

  const connect = useCallback(async () => {
    if (connectingRef.current || avatarSynthesizerRef.current) {
      return;
    }

    const sinceFailed = Date.now() - lastFailedConnectRef.current;
    if (lastFailedConnectRef.current && sinceFailed < FAILED_CONNECT_COOLDOWN_MS) {
      const remaining = Math.ceil((FAILED_CONNECT_COOLDOWN_MS - sinceFailed) / 1000);
      const msg = `Azure Avatar เพิ่งเชื่อมต่อล้มเหลว กรุณารอประมาณ ${remaining} วินาทีก่อนลองใหม่`;
      setConnectError(msg);
      onErrorRef.current?.(msg);
      return;
    }

    const since = Date.now() - lastDisconnectRef.current;
    if (since < RECONNECT_COOLDOWN_MS) {
      await new Promise((r) => setTimeout(r, RECONNECT_COOLDOWN_MS - since));
    }

    connectingRef.current = true;
    setConnectError(null);
    setVideoFrameReady(false);
    setWebrtcMediaHint(null);
    setStatus('connecting');
    armNoFrameTimer();

    try {
      const [tokenRes, iceRes] = await Promise.all([
      api.get<{ success: boolean; token?: string; region?: string; configured?: boolean; message?: string }>('/azure/speech-token'),
      api.get<{ success: boolean; iceServers?: unknown; configured?: boolean; message?: string }>('/azure/ice-token'),
    ]);
      // Check if Azure is not configured — silently skip instead of throwing
      if ((tokenRes.data as any).configured === false || (iceRes.data as any).configured === false) {
        setStatus('not-configured');
        connectingRef.current = false;
        clearNoFrameTimer();
        return;
      }

      if (!tokenRes.data.success || !tokenRes.data.token || !tokenRes.data.region) {
        throw new Error(tokenRes.data.message || 'ไม่สามารถเชื่อมต่อ Azure Speech ได้');
      }
      if (!iceRes.data.success || !iceRes.data.iceServers) {
        throw new Error(iceRes.data.message || 'ไม่สามารถดึง ICE สำหรับ avatar ได้');
      }

      // Body from GET relay/token — Microsoft sample also sets AvatarConfig.remoteIceServers
      const iceServers = expandIceServersWithTcpFallback(
        normalizeIceServers(iceRes.data.iceServers)
      );
      if (iceServers.length === 0) {
        throw new Error('รูปแบบ ICE credentials ไม่รองรับ');
      }

      const speechConfig = SpeechConfig.fromAuthorizationToken(
        tokenRes.data.token,
        tokenRes.data.region
      );
      speechConfig.speechSynthesisVoiceName = voiceNameForGender(voiceGender);

      const avatarConfig = new AvatarConfig(character, style, new AvatarVideoFormat());
      avatarConfig.customized = false;
      avatarConfig.remoteIceServers = iceServers;

      const peerConnection = new RTCPeerConnection({ iceServers });

      peerConnection.oniceconnectionstatechange = () => {
        const s = peerConnection.iceConnectionState;
        if (s === 'failed' || s === 'disconnected') {
          setWebrtcMediaHint(
            'สัญญาณวิดีโอไม่เสถียร — ลองเครือข่ายอื่น ปิด VPN หรือให้ไฟร์วอลล์อนุญาต UDP 3478 / TCP 443 ไปยัง relay ของ Azure'
          );
        } else if ((s === 'checking' || s === 'new') && !videoFrameReadyRef.current) {
          setWebrtcMediaHint('กำลังเจรจาเส้นทางสื่อ (WebRTC ICE) กรุณารอสักครู่…');
        }
        if (s === 'connected' || s === 'completed') {
          setWebrtcMediaHint(null);
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const s = peerConnection.connectionState;
        if (s === 'failed') {
          setWebrtcMediaHint(
            'การเชื่อมต่อสื่อขัดข้อง กรุณาตรวจเครือข่าย/ไฟร์วอลล์ แล้วลองเชื่อมต่อ Avatar ใหม่'
          );
        }
      };

      peerConnection.ontrack = (event: RTCTrackEvent) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);

        if (event.track.kind === 'video') {
          const attached = attachVideoStream(stream);
          if (!attached) {
            console.info('[AzureAvatar] Video track received before <video> mount. Buffering stream.');
          }
        }

        if (event.track.kind === 'audio') {
          const attached = attachAudioStream(stream);
          if (!attached) {
            console.info('[AzureAvatar] Audio track received before <audio> mount. Buffering stream.');
          }
        }
      };

      // Receive-only: avatar sends video/audio, client only receives (matches spare-parts reference)
      peerConnection.addTransceiver('video', { direction: 'recvonly' });
      peerConnection.addTransceiver('audio', { direction: 'recvonly' });

      const avatarSynthesizer = new AvatarSynthesizer(speechConfig, avatarConfig);

      peerConnectionRef.current = peerConnection;
      avatarSynthesizerRef.current = avatarSynthesizer;
      speechConfigRef.current = speechConfig;

      const result = await avatarSynthesizer.startAvatarAsync(peerConnection);

      if (result.reason !== ResultReason.SynthesizingAudioCompleted) {
        throw new Error(result.errorDetails || 'การเชื่อมต่อ avatar ล้มเหลว');
      }

      connectedRef.current = true;
      lastFailedConnectRef.current = 0;
      setStatus('connected');
      setConnectError(null);
      tryAttachPendingMedia();
    } catch (err: unknown) {
      console.error('[AzureAvatar] connect error:', err);
      const axiosMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      const msg =
        axiosMsg ||
        (err instanceof Error ? err.message : 'เชื่อมต่อ avatar ไม่สำเร็จ');
      const friendlyMsg =
        msg.includes('not found or not supported') || msg.includes('websocket error code: 1007')
          ? 'Azure ไม่รองรับตัวละคร/ท่าทางนี้ใน real-time avatar กรุณาเลือก Lisa — สบายๆ, Harry หรือ Lori แล้วลองใหม่หลัง cooldown'
          : msg.includes('concurrent request limit') || msg.includes('4429')
            ? 'Azure จำกัดจำนวนการเชื่อมต่อ avatar พร้อมกันชั่วคราว กรุณารอ 30-60 วินาทีแล้วลองใหม่'
            : msg;
      lastFailedConnectRef.current = Date.now();
      setConnectError(friendlyMsg);
      setStatus('error');
      onErrorRef.current?.(friendlyMsg);
      await disconnect();
    } finally {
      connectingRef.current = false;
    }
  }, [character, style, voiceGender, disconnect, armNoFrameTimer, attachVideoStream, attachAudioStream, tryAttachPendingMedia]);

  const speak = useCallback(
    async (text: string) => {
      const synth = avatarSynthesizerRef.current;
      const sc = speechConfigRef.current;
      if (!synth || !sc || !connectedRef.current) {
        throw new Error('Avatar ยังไม่เชื่อมต่อ');
      }

      isSpeakingRef.current = true;
      setIsSpeaking(true);
      try {
        await refreshSpeechAuth();
        sc.speechSynthesisVoiceName = voiceNameForGender(voiceGender);
        const voice = sc.speechSynthesisVoiceName;
        const body = buildProsodicSsmlBody(text);
        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="th-TH">
  <voice name="${voice}">${body}</voice>
</speak>`;

        const result = await synth.speakSsmlAsync(ssml);
        if (result.reason !== ResultReason.SynthesizingAudioCompleted) {
          console.warn('[AzureAvatar] speak:', result.errorDetails);
        }
      } finally {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      }
    },
    [refreshSpeechAuth, voiceGender]
  );

  const stopSpeaking = useCallback(async () => {
    const synth = avatarSynthesizerRef.current;
    if (!synth) {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      return;
    }
    try {
      await synth.stopSpeakingAsync();
    } catch (e) {
      console.warn('[AzureAvatar] stopSpeaking:', e);
    } finally {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, []);

  return {
    videoRef,
    audioRef,
    status,
    connectError,
    isConnected: status === 'connected',
    isSpeaking,
    voiceGender,
    setVoiceGender,
    character,
    style,
    setCharacter,
    setStyle,
    connect,
    disconnect,
    speak,
    stopSpeaking,
    videoFrameReady,
    webrtcMediaHint,
  };
}
