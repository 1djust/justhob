'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { API_BASE_URL } from '@/lib/api';

interface RealtimeContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinWorkspace: (workspaceId: string) => void;
  leaveWorkspace: (workspaceId: string) => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  socket: null,
  isConnected: false,
  joinWorkspace: () => {},
  leaveWorkspace: () => {},
});

export const useRealtime = () => useContext(RealtimeContext);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const workspaceRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let s: Socket | null = null;

    const initSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) return;

      // Initialize socket with auth token
      s = io(API_BASE_URL, {
        auth: { token },
        transports: ['websocket'],
      });

      s.on('connect', () => {
        setIsConnected(true);
        console.log('[Realtime] Connected to socket server');
        
        // Re-join workspace if we were in one before disconnect
        if (workspaceRef.current) {
          s?.emit('join-workspace', workspaceRef.current);
        }
      });

      s.on('disconnect', () => {
        setIsConnected(false);
        console.log('[Realtime] Disconnected from socket server');
      });

      s.on('connect_error', (err) => {
        console.error('[Realtime] Connection error:', err.message);
      });

      // Global event listeners for auto-refresh
      s.on('PAYMENT_UPDATED', (data: any) => {
        console.log('[Realtime] Payment updated:', data);
        toast.info('Payment updated in real-time');
        router.refresh();
      });

      s.on('MAINTENANCE_UPDATED', (data: any) => {
        console.log('[Realtime] Maintenance updated:', data);
        toast.info('Maintenance request updated');
        router.refresh();
      });

      setSocket(s);
    };

    initSocket();

    return () => {
      if (s) s.disconnect();
    };
  }, []);

  const joinWorkspace = (workspaceId: string) => {
    if (socket && isConnected) {
      socket.emit('join-workspace', workspaceId);
      workspaceRef.current = workspaceId;
    } else {
      // If not connected yet, store it to join on connect
      workspaceRef.current = workspaceId;
    }
  };

  const leaveWorkspace = (workspaceId: string) => {
    if (socket && isConnected) {
      socket.emit('leave-workspace', workspaceId);
      workspaceRef.current = null;
    }
  };

  return (
    <RealtimeContext.Provider value={{ socket, isConnected, joinWorkspace, leaveWorkspace }}>
      {children}
    </RealtimeContext.Provider>
  );
};
