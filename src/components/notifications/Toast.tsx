import { useEffect, useRef, useState } from 'react';
import { Notification } from '../../contexts/NotificationContext';
import { useTheme } from '../../contexts/ThemeContext';

// ── Inline SVG icons (no lucide dependency) ────────────────────────────────
const Icons = {
  success: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  warning: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  error: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
  close: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
};

// ── Color tokens per type ──────────────────────────────────────────────────
const TYPE_CFG = {
  success: { accent: '#22C55E', accentDk: '#4ADE80', iconBg: '#DCFCE7', iconBgDk: '#052e16' },
  warning: { accent: '#F97316', accentDk: '#FB923C', iconBg: '#FFF7ED', iconBgDk: '#431407' },
  error:   { accent: '#EF4444', accentDk: '#F87171', iconBg: '#FEF2F2', iconBgDk: '#450A0A' },
  info:    { accent: '#2563EB', accentDk: '#60A5FA', iconBg: '#EFF6FF', iconBgDk: '#1e3a5f' },
};

interface ToastProps {
  toast      : Notification;
  onDismiss  : (id: string) => void;
  stackIndex : number; // 0 = newest / front
}

export const Toast = ({ toast, onDismiss, stackIndex }: ToastProps) => {
  const { theme }                       = useTheme();
  const dark                            = theme === 'dark';
  const [mounted,  setMounted]          = useState(false);
  const [leaving,  setLeaving]          = useState(false);
  const [progress, setProgress]         = useState(100);
  const [paused,   setPaused]           = useState(false);
  const intervalRef                     = useRef<ReturnType<typeof setInterval>>();

  const cfg    = TYPE_CFG[toast.type];
  const accent = dark ? cfg.accentDk : cfg.accent;
  const iconBg = dark ? cfg.iconBgDk : cfg.iconBg;

  // Entrance animation — flip mounted after first paint
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss with draining progress bar
  useEffect(() => {
    const dur = toast.autoHide === false ? 0 : (toast.duration ?? 5000);
    if (dur <= 0) return;
    const step = 100 / (dur / 50);
    intervalRef.current = setInterval(() => {
      if (paused) return;
      setProgress(p => {
        if (p <= 0) { clearInterval(intervalRef.current); handleDismiss(); return 0; }
        return Math.max(0, p - step);
      });
    }, 50);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, toast.duration, toast.autoHide]);

  const handleDismiss = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 260);
  };

  // Parse message string (e.g. "[ABC-123] · Driver: John · Net: 1200 kg") into lines
  const lines = toast.message
    ? toast.message.split(' · ').map(s => s.trim()).filter(Boolean)
    : [];

  // Stack visual: items behind peek slightly
  const cappedIndex   = Math.min(stackIndex, 2);
  const peekScale     = mounted && !leaving ? 1 - cappedIndex * 0.03  : 0.94;
  const peekTranslate = mounted && !leaving ? cappedIndex * -7         : 14;
  const opacity       = mounted && !leaving ? 1 - cappedIndex * 0.14  : 0;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        position       : 'absolute',
        bottom: 0, right: 0,
        width          : '100%',
        opacity,
        transform      : `translateY(${leaving ? 18 : peekTranslate}px) scale(${peekScale})`,
        transformOrigin: 'bottom center',
        transition     : 'opacity 0.26s ease, transform 0.26s ease',
        zIndex         : 100 - stackIndex,
        pointerEvents  : stackIndex === 0 ? 'auto' : 'none',
      }}
    >
      <div style={{
        background  : dark ? '#1C1C1E' : '#FFFFFF',
        borderRadius: 12,
        border      : `1px solid ${dark ? '#2E2E2E' : '#E8E8E8'}`,
        boxShadow   : dark
          ? '0 12px 40px rgba(0,0,0,0.72), 0 1px 0 rgba(255,255,255,0.04) inset'
          : '0 8px 32px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.96) inset',
        overflow    : 'hidden',
        position    : 'relative',
        fontFamily  : "'DM Sans', 'Inter', sans-serif",
      }}>

        {/* Left accent bar */}
        <div style={{
          position    : 'absolute',
          left: 0, top: 0, bottom: 0,
          width       : 3,
          background  : accent,
          borderRadius: '12px 0 0 12px',
        }} />

        {/* Body */}
        <div style={{ padding: '12px 13px 10px 15px' }}>

          {/* Header row — icon · title · close */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: lines.length > 0 ? 7 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7,
                background: iconBg, color: accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {Icons[toast.type]}
              </div>
              <span style={{
                fontSize: 13, fontWeight: 700, lineHeight: 1.3,
                color: dark ? '#F4F4F5' : '#111111',
              }}>
                {/* Strip emoji prefixes from server-side title if present */}
                {toast.title.replace(/^[\u{1F000}-\u{1FFFF}\u2000-\u3300\uFE00-\uFEFF\s]+/u, '').trim() || toast.title}
              </span>
            </div>

            <button className="toast-close-btn" onClick={handleDismiss}>
              {Icons.close}
            </button>
          </div>

          {/* Detail lines */}
          {lines.length > 0 && (
            <div style={{ paddingLeft: 34, marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: '1px 0', alignItems: 'center' }}>
              {lines.map((line, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{
                    fontSize  : 11,
                    fontWeight: 500,
                    color     : dark ? '#71717A' : '#9CA3AF',
                    fontFamily: i === 0 ? "'DM Mono', 'Courier New', monospace" : "'DM Sans', sans-serif",
                  }}>
                    {line}
                  </span>
                  {i < lines.length - 1 && (
                    <span style={{ color: dark ? '#3A3A3A' : '#E0E0E0', margin: '0 5px', fontSize: 11 }}>·</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Footer — timestamp */}
          <div style={{ paddingLeft: 34, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: dark ? '#3F3F46' : '#D1D5DB', fontFamily: "'DM Mono', monospace" }}>
              just now
            </span>
            {toast.clickable && toast.trans_id && (
              <button className="toast-action-btn" style={{ color: accent }}>
                View →
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: dark ? '#252525' : '#F0F0F0' }}>
          <div style={{
            height    : '100%',
            width     : `${progress}%`,
            background: accent,
            transition: paused ? 'none' : 'width 0.05s linear',
          }} />
        </div>
      </div>
    </div>
  );
};
