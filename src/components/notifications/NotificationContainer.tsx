import { useState, useEffect } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { Toast } from './Toast';

const PANEL_GAP = 16; // px gap between toast stack and chat panel edge

export const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotifications();
  const [rightOffset, setRightOffset] = useState(24);

  useEffect(() => {
    const handler = (e: Event) => {
      const { open, panelWidth } = (e as CustomEvent<{ open: boolean; panelWidth: number }>).detail;
      setRightOffset(open ? panelWidth + PANEL_GAP : 24);
    };
    window.addEventListener('ai-chat-panel', handler);
    return () => window.removeEventListener('ai-chat-panel', handler);
  }, []);

  // Show max 3, newest (index 0 in state) rendered as stackIndex 0 = front
  const visible = notifications.slice(0, 3);

  if (visible.length === 0) return null;

  const stackHeight = 80 + (Math.min(visible.length, 3) - 1) * 7;

  return (
    <div
      className="notification-responsive"
      style={{
        position  : 'fixed',
        bottom    : 24,
        right     : rightOffset,
        width     : 340,
        zIndex    : 9999,
        transition: 'right 0.3s ease',
      }}
    >
      <div style={{
        position  : 'relative',
        height    : `${stackHeight}px`,
        transition: 'height 0.3s ease',
      }}>
        {visible.map((toast, i) => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={removeNotification}
            stackIndex={i}
          />
        ))}
      </div>
    </div>
  );
};
