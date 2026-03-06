import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Bot, Loader2, Box, Trash2, AlignJustify,
  ArrowUp, Plus, Clock, ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  savedAt: number;
}

// ── Constants ──────────────────────────────────────────────────────────────
const API_BASE     = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const STORAGE_KEY  = 'metpower-chat-history';
const MAX_CHATS    = 20;   // max saved conversations

const WELCOME: Message = {
  role: 'assistant',
  content: "Hi! I'm Cube AI Assistant, your METpower operations guide. Ask me anything about navigating tabs, understanding data, filtering transactions, reading charts, and more!",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^- /gm, '')
    .trim();
}

function parseChoices(content: string): { prose: string; choices: string[]; source: string } {
  content = cleanMarkdown(content);
  const lines = content.split('\n');
  const choices: string[] = [];
  const proseLines: string[] = [];
  let source = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('• '))        choices.push(trimmed.slice(2).trim());
    else if (/^source:/i.test(trimmed))  source = trimmed.replace(/^source:\s*/i, '').trim();
    else                                  proseLines.push(line);
  }
  return { prose: proseLines.join('\n').trim(), choices, source };
}

function loadHistory(): Conversation[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveHistory(list: Conversation[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_CHATS))); } catch {}
}
function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function chatTitle(msgs: Message[]) {
  const first = msgs.find(m => m.role === 'user');
  return first ? first.content.slice(0, 50) + (first.content.length > 50 ? '…' : '') : 'New chat';
}
function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AIChat() {
  const { user } = useAuth();

  const [open, setOpen]             = useState(false);
  const [messages, setMessages]     = useState<Message[]>([WELCOME]);
  const [convId, setConvId]         = useState(() => makeId());
  const [history, setHistory]       = useState<Conversation[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [showTips, setShowTips]     = useState(false);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const pendingMsg = useRef<string | null>(null);

  // Focus input when panel opens
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 80); }, [open]);

  // Auto-brief on fresh login (once per browser session)
  useEffect(() => {
    const BRIEF_KEY = 'cube-ai-session-briefed';
    if (sessionStorage.getItem(BRIEF_KEY)) return;
    sessionStorage.setItem(BRIEF_KEY, '1');
    const name = user?.username ?? 'there';
    const _d = new Date();
    const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;

    setTimeout(async () => {
      setOpen(true);
      setLoading(true);
      try {
        // ── 1. Fetch real DB stats in parallel ──────────────────────────
        const [weightRes, statusRes] = await Promise.all([
          fetch(`${API_BASE}/api/analytics/weight-summary`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : {}) as Promise<Record<string, any>>,
          fetch(`${API_BASE}/api/analytics/status-breakdown?startDate=${today}&endDate=${today}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : []) as Promise<{ status: string; count: number }[]>,
        ]);

        const todayTrips: number  = weightRes.todayTrips  ?? 0;
        const weekTrips: number   = weightRes.weekTrips   ?? 0;
        const totalRecords: number = weightRes.totalRecords ?? 0;
        const statuses: { status: string; count: number }[] = Array.isArray(statusRes) ? statusRes : [];

        const weeklyAvg = weekTrips > 0 ? (weekTrips / 7).toFixed(1) : '0';
        const statusLines = statuses.length > 0
          ? statuses.map(s => `${s.status}: ${s.count}`).join(', ')
          : 'no status data';
        const inbound  = weightRes.todayInbound  ?? 'N/A';
        const outbound = weightRes.todayOutbound ?? 'N/A';

        const dataContext = [
          `Total all-time records: ${totalRecords}`,
          `Today (${today}): ${todayTrips} trips${inbound !== 'N/A' ? ` (${inbound} inbound, ${outbound} outbound)` : ''}`,
          `This week total trips: ${weekTrips} (daily avg: ${weeklyAvg})`,
          `Today status breakdown: ${statusLines}`,
          `Avg net payload pct: ${weightRes.avgNetPayloadPct != null ? weightRes.avgNetPayloadPct.toFixed(1) + '%' : 'N/A'}`,
        ].join('\n');

        // ── 2. Send real data to AI for a human-readable brief ──────────
        const res = await fetch(`${API_BASE}/api/ai-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `You are the Cube AI Assistant for METpower Truck Accession System. The user "${name}" just logged in. Using ONLY the real database stats below, write a concise welcome brief. Do NOT invent or estimate any numbers — use exactly what is provided. Flag any status anomalies (high Void/Rejected counts). Keep it under 100 words. Start with "Welcome back, ${name}! Here's your latest update:"\n\nREAL DATA:\n${dataContext}`,
            }],
          }),
        });
        const data = res.ok ? await res.json() : null;
        if (data?.reply) setMessages([{ role: 'assistant', content: data.reply }]);
      } catch {
        /* silently keep default welcome */
      } finally {
        setLoading(false);
      }
    }, 1400);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  // Listen for chart explain events
  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent<{ message: string }>).detail?.message;
      if (!message) return;
      pendingMsg.current = message;
      setOpen(true);
    };
    window.addEventListener('explain-chart', handler);
    return () => window.removeEventListener('explain-chart', handler);
  }, []);

  // Auto-send pending chart explain
  useEffect(() => {
    if (open && pendingMsg.current) {
      const msg = pendingMsg.current;
      pendingMsg.current = null;
      setTimeout(() => sendText(msg), 200);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Persist current chat to history (only if it has at least one user message) */
  const persistCurrent = useCallback((msgs: Message[], id: string) => {
    if (!msgs.some(m => m.role === 'user')) return;
    const updated: Conversation = {
      id, title: chatTitle(msgs),
      messages: msgs,
      savedAt: Date.now(),
    };
    setHistory(prev => {
      const filtered = prev.filter(c => c.id !== id);
      const next = [updated, ...filtered];
      saveHistory(next);
      return next;
    });
  }, []);

  const startNewChat = () => {
    persistCurrent(messages, convId);
    const newId = makeId();
    setConvId(newId);
    setMessages([WELCOME]);
    setInput('');
    setShowHistory(false);
    setError('');
  };

  const restoreChat = (conv: Conversation) => {
    persistCurrent(messages, convId);
    setConvId(conv.id);
    setMessages(conv.messages);
    setShowHistory(false);
    setError('');
  };

  const deleteConv = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => { const n = prev.filter(c => c.id !== id); saveHistory(n); return n; });
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    setError('');

    const apiMessages = updated.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API_BASE}/api/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: apiMessages }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setError('Could not reach AI. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(input); }
  };

  const clearChat = () => {
    persistCurrent(messages, convId);
    setMessages([WELCOME]);
    setConvId(makeId());
  };

  const canSend = input.trim() && !loading;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-xl flex items-center justify-center transition-all duration-300"
        style={{
          width: 52, height: 52,
          background: open ? '#2a2a2a' : '#1a73e8',
        }}
        title="Cube AI Assistant"
      >
        {open
          ? <X className="w-5 h-5 text-white" />
          : <Box className="w-5 h-5 text-white" />
        }
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => { persistCurrent(messages, convId); setOpen(false); }}
        />
      )}

      {/* Main sidebar panel */}
      <div
        className={`fixed top-0 right-0 z-40 h-full flex flex-col transition-all duration-300 ease-in-out overflow-hidden
          ${open ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}
        style={{ width: 380, background: '#1e1e1e' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #2e2e2e' }}>
          <button
            onClick={() => setShowHistory(h => !h)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Chat history"
          >
            <AlignJustify className="w-4 h-4 text-gray-300" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Bot className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-sm font-semibold text-white truncate">Cube AI Assistant</span>
          </div>
          <button
            onClick={startNewChat}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="New chat"
          >
            <Plus className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={() => { persistCurrent(messages, convId); setOpen(false); }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* ── History overlay ── */}
        <div
          className={`absolute inset-0 top-[49px] flex flex-col z-20 transition-all duration-300 ease-in-out
            ${showHistory ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}
          style={{ background: '#1a1a1a' }}
        >
          {/* History header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #2e2e2e' }}>
            <button onClick={() => setShowHistory(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-300" />
            </button>
            <span className="text-sm font-semibold text-white flex-1">Chat History</span>
            <button
              onClick={startNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
              style={{ background: '#1a73e8' }}
            >
              <Plus className="w-3.5 h-3.5" /> New Chat
            </button>
          </div>

          {/* History list */}
          <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3a3a3a transparent' }}>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2" style={{ color: '#555' }}>
                <Clock className="w-6 h-6" />
                <p className="text-xs">No saved chats yet</p>
              </div>
            ) : history.map(conv => (
              <div
                key={conv.id}
                onClick={() => restoreChat(conv)}
                className="group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid #252525' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#252525')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#555' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: '#d4d4d4' }}>{conv.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#555' }}>{fmtDate(conv.savedAt)}</p>
                </div>
                <button
                  onClick={e => deleteConv(conv.id, e)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  style={{ color: '#666' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Messages ── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-5 space-y-3"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#3a3a3a transparent' }}
        >
          {messages.map((msg, i) => {
            if (msg.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[86%] space-y-1.5">
                    {msg.content && (
                      <div
                        className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                        style={{ background: '#2d2d2d', color: '#e8e8e8', border: '1px solid #3a3a3a' }}
                      >
                        {msg.content}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const { prose, choices, source } = parseChoices(msg.content);
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[92%] space-y-2">
                  {prose && (
                    <div
                      className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                      style={{ background: '#2a2a2a', color: '#d4d4d4', border: '1px solid #333' }}
                    >
                      {prose}
                    </div>
                  )}
                  {choices.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {choices.map((choice, ci) => (
                        <button
                          key={ci}
                          onClick={() => sendText(choice)}
                          disabled={loading}
                          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: '#2e3a4e', color: '#7ab4f5', border: '1px solid #3a5070' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#35455c')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#2e3a4e')}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}
                  {source && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: '#1a3a2a', color: '#4ade80', border: '1px solid #2a5a3a' }}
                      >
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                        Verified
                      </span>
                      <span className="text-[10px]" style={{ color: '#666' }}>{source}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl" style={{ background: '#2a2a2a', border: '1px solid #333' }}>
                <div className="flex gap-1.5 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-center px-2" style={{ color: '#f87171' }}>{error}</p>}
          <div ref={bottomRef} />
        </div>

        {/* ── Input area ── */}
        <div className="shrink-0 px-4 pb-2 pt-2" style={{ borderTop: '1px solid #2e2e2e' }}>

          <div
            className="rounded-2xl px-4 py-3 flex flex-col gap-3"
            style={{ background: '#2a2a2a', border: '1px solid #3a3a3a' }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={handleKey}
              placeholder="Ask Cube AI Assistant"
              disabled={loading}
              className="w-full text-sm leading-relaxed resize-none focus:outline-none disabled:opacity-50"
              style={{ background: 'transparent', color: '#e0e0e0', overflowY: 'hidden', minHeight: 24 }}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Clear chat */}
                <button
                  onClick={clearChat}
                  title="Save & clear conversation"
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: '#888' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#888')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => sendText(input)}
                disabled={!canSend}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: canSend ? '#1a73e8' : '#3a3a3a' }}
              >
                {loading
                  ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                  : <ArrowUp className="w-4 h-4 text-white" />
                }
              </button>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-2 mb-1">
            {showTips && (
              <div
                className="mb-2 rounded-xl px-4 py-3 text-[11px] leading-relaxed space-y-1.5"
                style={{ background: '#252525', border: '1px solid #333', color: '#aaa' }}
              >
                <p className="font-semibold" style={{ color: '#d4d4d4' }}>Tips for reviewing AI data:</p>
                <p>• Cross-check totals using the <strong style={{ color: '#7ab4f5' }}>Export CSV</strong> feature on any chart.</p>
                <p>• AI explanations describe patterns — always confirm figures in the Transactions tab.</p>
                <p>• Chat history is stored in your browser only — not on the server.</p>
                <p>• For critical decisions, refer to physical weigh-bridge records.</p>
              </div>
            )}
            <p className="text-center text-[10px]" style={{ color: '#555' }}>
              Cube AI Assistant can make mistakes.{' '}
              <button
                onClick={() => setShowTips(t => !t)}
                className="underline transition-colors focus:outline-none"
                style={{ color: showTips ? '#7ab4f5' : '#777' }}
              >
                {showTips ? 'Hide tips ↑' : 'Review important data ↓'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
