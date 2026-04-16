'use client';

import * as React from 'react';
import { 
  Send, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Wrench,
  Calendar,
  MoreVertical
} from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';
import { useRealtime } from '@/components/providers/RealtimeProvider';

interface Message {
  id: string;
  content: string;
  type: 'USER' | 'SYSTEM';
  createdAt: string;
  senderId?: string;
  sender?: { name: string };
}

interface MaintenanceChatProps {
  workspaceId: string;
  requestId: string;
  isPropertyManager?: boolean;
}

export function MaintenanceChat({ workspaceId, requestId, isPropertyManager = true }: MaintenanceChatProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { socket } = useRealtime();

  const fetchHistory = React.useCallback(async () => {
    try {
      const data = await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/maintenance/${requestId}/messages`, {
        credentials: 'include'
      });
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, requestId]);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  React.useEffect(() => {
    if (!socket) return;

    // Join the specific maintenance room
    socket.emit('join-maintenance', { workspaceId, requestId });

    const handleNewMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
    };

    socket.on('maintenance-message', handleNewMessage);

    return () => {
      socket.off('maintenance-message', handleNewMessage);
      socket.emit('leave-maintenance', requestId);
    };
  }, [socket, workspaceId, requestId]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;

    const content = newMessage;
    setNewMessage('');

    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/maintenance/${requestId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        credentials: 'include'
      });
      // The message will come back through the socket
    } catch (e) {
      console.error(e);
      // Revert optimization if error (optional)
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
        <div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Issue History</h4>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Timeline & Communication</p>
        </div>
      </div>

      {/* Messages Feed */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth scrollbar-hide"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-zinc-300" />
            </div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No activity logged yet</p>
            <p className="text-[10px] text-zinc-400 mt-1">Status changes and messages will appear here.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id} className="relative">
              {/* Timeline Connector */}
              {i < messages.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-[-24px] w-[1px] bg-zinc-100 dark:bg-zinc-800" />
              )}

              {msg.type === 'SYSTEM' ? (
                <div className="flex items-start gap-4 animate-in fade-in slide-in-from-left-2">
                  <div className="w-[23px] h-[23px] bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center z-10 border-2 border-white dark:border-zinc-950">
                    <AlertCircle className="w-3 h-3 text-zinc-500" />
                  </div>
                  <div className="flex-1 py-0.5">
                    <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 italic">
                      {msg.content}
                    </p>
                    <span className="text-[9px] text-zinc-400">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4 animate-in fade-in slide-in-from-left-2">
                  <div className="w-[23px] h-[23px] bg-zinc-900 dark:bg-zinc-50 rounded-full flex items-center justify-center z-10 border-2 border-white dark:border-zinc-950">
                    <User className="w-3 h-3 text-white dark:text-zinc-900" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">
                        {msg.sender?.name}
                      </span>
                      <span className="text-[9px] text-zinc-400">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-2xl rounded-tl-none border border-zinc-100 dark:border-zinc-800">
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form 
        onSubmit={handleSendMessage}
        className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30"
      >
        <div className="relative group">
          <input 
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Type a message or update..."
            className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-3 pl-4 pr-12 text-xs focus:ring-4 focus:ring-zinc-900/5 outline-none transition-all group-hover:border-zinc-400"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:grayscale disabled:scale-100"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
