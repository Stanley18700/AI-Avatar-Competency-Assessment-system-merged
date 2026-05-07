import { useEffect, useState } from 'react';

export type AvatarState = 'idle' | 'speaking' | 'listening' | 'thinking';

interface AIAvatarProps {
  state: AvatarState;
  size?: number;
  className?: string;
}

export default function AIAvatar({ state, size = 200, className = '' }: AIAvatarProps) {
  const [blinkCycle, setBlinkCycle] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  // Which thinking dot (0/1/2) is bright — replaces SMIL <animate> to avoid removeChild crashes
  const [thinkDot, setThinkDot] = useState(0);

  // Blink animation
  useEffect(() => {
    const interval = setInterval(() => {
      setBlinkCycle(true);
      setTimeout(() => setBlinkCycle(false), 150);
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  // Mouth animation when speaking
  useEffect(() => {
    if (state !== 'speaking') { setMouthOpen(false); return; }
    const interval = setInterval(() => setMouthOpen(o => !o), 180);
    return () => clearInterval(interval);
  }, [state]);

  // Thinking dot animation — React state instead of SMIL to avoid DOM reconciliation errors
  useEffect(() => {
    if (state !== 'thinking') { setThinkDot(0); return; }
    const interval = setInterval(() => setThinkDot(d => (d + 1) % 3), 300);
    return () => clearInterval(interval);
  }, [state]);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;

  const stateColors: Record<AvatarState, { ring: string; pulse: string; bg: string }> = {
    idle: { ring: '#0ea5e9', pulse: 'rgba(14, 165, 233, 0.25)', bg: '#f0f9ff' }, // Sky/Medical Blue
    speaking: { ring: '#0ea5e9', pulse: 'rgba(14, 165, 233, 0.25)', bg: '#f0f9ff' }, // Sky
    listening: { ring: '#ef4444', pulse: 'rgba(239, 68, 68, 0.25)', bg: '#fef2f2' }, // Red
    thinking: { ring: '#8b5cf6', pulse: 'rgba(139, 92, 246, 0.25)', bg: '#f5f3ff' }, // Violet
  };

  const colors = stateColors[state];

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Pulse rings */}
      {(state === 'speaking' || state === 'listening') && (
        <>
          <div
            className="absolute rounded-full animate-ping"
            style={{
              width: size * 1.1,
              height: size * 1.1,
              backgroundColor: colors.pulse,
              animationDuration: '1.5s',
            }}
          />
          <div
            className="absolute rounded-full animate-pulse"
            style={{
              width: size * 1.25,
              height: size * 1.25,
              backgroundColor: colors.pulse,
              opacity: 0.4,
              animationDuration: '2s',
            }}
          />
        </>
      )}
      {state === 'thinking' && (
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            width: size * 1.1,
            height: size * 1.1,
            backgroundColor: colors.pulse,
            animationDuration: '1s',
          }}
        />
      )}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative z-10"
      >
        {/* Background circle */}
        <circle cx={cx} cy={cy} r={r + 8} fill={colors.bg} stroke={colors.ring} strokeWidth={3} />

        {/* Head */}
        <circle cx={cx} cy={cy - r * 0.05} r={r * 0.55} fill="#FBBF88" />

        {/* Hair */}
        <ellipse cx={cx} cy={cy - r * 0.35} rx={r * 0.58} ry={r * 0.38} fill="#2d1b15" />
        <ellipse cx={cx - r * 0.48} cy={cy - r * 0.1} rx={r * 0.12} ry={r * 0.25} fill="#2d1b15" />
        <ellipse cx={cx + r * 0.48} cy={cy - r * 0.1} rx={r * 0.12} ry={r * 0.25} fill="#2d1b15" />

        {/* Nurse cap */}
        <rect
          x={cx - r * 0.3}
          y={cy - r * 0.58}
          width={r * 0.6}
          height={r * 0.18}
          rx={3}
          fill="white"
          stroke="#ddd"
          strokeWidth={1}
        />
        <line
          x1={cx - r * 0.15}
          y1={cy - r * 0.52}
          x2={cx + r * 0.15}
          y2={cy - r * 0.52}
          stroke="#dc2626"
          strokeWidth={2}
        />
        <line
          x1={cx}
          y1={cy - r * 0.56}
          x2={cx}
          y2={cy - r * 0.44}
          stroke="#dc2626"
          strokeWidth={2}
        />

        {/* Eyes */}
        {blinkCycle ? (
          <>
            <line x1={cx - r * 0.18} y1={cy - r * 0.08} x2={cx - r * 0.08} y2={cy - r * 0.08} stroke="#333" strokeWidth={2} strokeLinecap="round" />
            <line x1={cx + r * 0.08} y1={cy - r * 0.08} x2={cx + r * 0.18} y2={cy - r * 0.08} stroke="#333" strokeWidth={2} strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx={cx - r * 0.15} cy={cy - r * 0.08} rx={r * 0.06} ry={r * 0.07} fill="#333" />
            <ellipse cx={cx + r * 0.15} cy={cy - r * 0.08} rx={r * 0.06} ry={r * 0.07} fill="#333" />
            {/* Eye shine */}
            <circle cx={cx - r * 0.13} cy={cy - r * 0.1} r={r * 0.02} fill="white" />
            <circle cx={cx + r * 0.17} cy={cy - r * 0.1} r={r * 0.02} fill="white" />
          </>
        )}

        {/* Eyebrows */}
        <path
          d={`M${cx - r * 0.22} ${cy - r * 0.17} Q${cx - r * 0.15} ${cy - r * 0.22} ${cx - r * 0.08} ${cy - r * 0.17}`}
          stroke="#4a3520" strokeWidth={1.5} fill="none" strokeLinecap="round"
        />
        <path
          d={`M${cx + r * 0.08} ${cy - r * 0.17} Q${cx + r * 0.15} ${cy - r * 0.22} ${cx + r * 0.22} ${cy - r * 0.17}`}
          stroke="#4a3520" strokeWidth={1.5} fill="none" strokeLinecap="round"
        />

        {/* Nose */}
        <path
          d={`M${cx} ${cy - r * 0.02} L${cx - r * 0.04} ${cy + r * 0.06} L${cx + r * 0.04} ${cy + r * 0.06}`}
          stroke="#d4956c" strokeWidth={1} fill="none" strokeLinecap="round" strokeLinejoin="round"
        />

        {/* Mouth */}
        {state === 'speaking' && mouthOpen ? (
          <ellipse cx={cx} cy={cy + r * 0.16} rx={r * 0.1} ry={r * 0.07} fill="#c0392b" />
        ) : state === 'listening' ? (
          <circle cx={cx} cy={cy + r * 0.16} r={r * 0.04} fill="#c0392b" />
        ) : (
          <path
            d={`M${cx - r * 0.1} ${cy + r * 0.14} Q${cx} ${cy + r * 0.22} ${cx + r * 0.1} ${cy + r * 0.14}`}
            stroke="#c0392b" strokeWidth={1.5} fill="none" strokeLinecap="round"
          />
        )}

        {/* Body / Uniform */}
        <path
          d={`M${cx - r * 0.45} ${cy + r * 0.8}
              Q${cx - r * 0.45} ${cy + r * 0.4} ${cx - r * 0.2} ${cy + r * 0.35}
              Q${cx} ${cy + r * 0.28} ${cx + r * 0.2} ${cy + r * 0.35}
              Q${cx + r * 0.45} ${cy + r * 0.4} ${cx + r * 0.45} ${cy + r * 0.8}`}
          fill="white" stroke="#ddd" strokeWidth={1}
        />
        {/* Scrub collar */}
        <path
          d={`M${cx - r * 0.12} ${cy + r * 0.3}
              L${cx} ${cy + r * 0.42}
              L${cx + r * 0.12} ${cy + r * 0.3}`}
          fill="#e0f2fe" stroke="#bae6fd" strokeWidth={1}
        />

        {/* Stethoscope */}
        <path
          d={`M${cx - r * 0.1} ${cy + r * 0.35}
              Q${cx - r * 0.15} ${cy + r * 0.55} ${cx - r * 0.05} ${cy + r * 0.65}`}
          stroke="#6b7280" strokeWidth={2} fill="none" strokeLinecap="round"
        />
        <circle cx={cx - r * 0.05} cy={cy + r * 0.67} r={r * 0.04} fill="#9ca3af" stroke="#6b7280" strokeWidth={1} />

        {/* State indicator icon */}
        {state === 'listening' && (
          <g transform={`translate(${cx + r * 0.55}, ${cy + r * 0.3})`}>
            <circle r={r * 0.12} fill="#dc2626" opacity={0.9} />
            <rect x={-r * 0.025} y={-r * 0.06} width={r * 0.05} height={r * 0.08} rx={r * 0.02} fill="white" />
            <path d={`M${-r * 0.05} ${r * 0.01} Q${-r * 0.05} ${r * 0.06} 0 ${r * 0.06} Q${r * 0.05} ${r * 0.06} ${r * 0.05} ${r * 0.01}`} fill="none" stroke="white" strokeWidth={1.5} />
            <line x1={0} y1={r * 0.06} x2={0} y2={r * 0.09} stroke="white" strokeWidth={1.5} />
          </g>
        )}

        {state === 'thinking' && (
          <g transform={`translate(${cx + r * 0.55}, ${cy + r * 0.3})`}>
            <circle r={r * 0.12} fill="#d97706" opacity={0.9} />
            <circle cx={-r * 0.04} cy={0} r={r * 0.02} fill="white" opacity={thinkDot === 0 ? 1 : 0.3} />
            <circle cx={0}         cy={0} r={r * 0.02} fill="white" opacity={thinkDot === 1 ? 1 : 0.3} />
            <circle cx={r * 0.04}  cy={0} r={r * 0.02} fill="white" opacity={thinkDot === 2 ? 1 : 0.3} />
          </g>
        )}
      </svg>

      {/* State label */}
      <div
        className="absolute -bottom-1 z-20 text-xs font-medium px-3 py-1 rounded-full"
        style={{
          backgroundColor: colors.ring,
          color: 'white',
        }}
      >
        <span>
          {state === 'idle' ? 'พร้อม'
            : state === 'speaking' ? 'กำลังพูด...'
              : state === 'listening' ? '🎙 กำลังฟัง...'
                : 'กำลังคิด...'}
        </span>
      </div>
    </div>
  );
}
