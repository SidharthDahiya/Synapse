import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

export const useSocket = (url, options = {}) => {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null); // Add state to trigger re-renders

  useEffect(() => {
    console.log('🔌 Connecting to:', url);

    // Create socket connection
    const newSocket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: true,
      ...options
    });

    // Store in ref and state
    socketRef.current = newSocket;
    setSocket(newSocket); // This triggers re-render with socket available

    newSocket.on('connect', () => {
      console.log('✅ Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up socket');
      if (newSocket.connected) {
        newSocket.disconnect();
      }
      socketRef.current = null;
      setSocket(null);
    };
  }, [url]);

  return socket; // Return the state, not the ref
};

export default useSocket;
