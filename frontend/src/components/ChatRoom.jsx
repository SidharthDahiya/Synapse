import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon,
  ArrowLeftIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { useSocket } from '../hooks/useSocket';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import LoadingSpinner from './LoadingSpinner';
import WebSearchToggle from './WebSearchToggle';

const ChatRoom = ({ user, onLeave }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);

  // Scrolling refs
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const socket = useSocket(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000');

  // Improved scroll to bottom function
  const scrollToBottom = (force = false) => {
    if (messagesEndRef.current) {
      // Only auto-scroll if user hasn't manually scrolled up, or if forced
      if (!userScrolledUp || force) {
        messagesEndRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'end'
        });
      }
    }
  };

  // Check if user is at bottom of messages
  const checkScrollPosition = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
      setUserScrolledUp(!isAtBottom);
    }
  };

  // Socket event handlers (your existing code)
  useEffect(() => {
    if (!socket) {
      console.log('❌ No socket available');
      return;
    }

    const handleConnect = () => {
      console.log('✅ Socket connected successfully!');
      setIsConnected(true);
      setIsLoading(false);
      socket.emit('join-room', user);
    };

    const handleDisconnect = () => {
      console.log('🔌 Socket disconnected');
      setIsConnected(false);
    };

    const handleConnectError = (error) => {
      console.error('❌ Socket connection error:', error);
      setIsLoading(false);
    };

    const handleRoomMessages = (roomMessages) => {
      console.log('📨 Received room messages:', roomMessages);
      setMessages(roomMessages);
      // Force scroll to bottom when loading initial messages
      setTimeout(() => scrollToBottom(true), 100);
    };

    const handleNewMessage = (message) => {
      console.log('📨 New message received:', message);
      setMessages(prev => [...prev, message]);
      setIsAiThinking(false);
      // Force scroll to bottom for new messages
      setTimeout(() => scrollToBottom(true), 100);
    };

    const handleAiThinking = () => {
      setIsAiThinking(true);
      // Scroll when AI starts thinking
      setTimeout(() => scrollToBottom(true), 100);
    };

    const handleAiError = (error) => {
      setIsAiThinking(false);
      toast.error(error.message || 'AI response failed');
    };

    const handleUserJoined = (userData) => {
      toast.success(`${userData.username} joined the room`);
    };

    const handleUserLeft = (userData) => {
      toast(`${userData.username} left the room`);
    };

    const handleUserTyping = (userData) => {
      setTypingUsers(prev => {
        if (!prev.find(u => u.userId === userData.userId)) {
          return [...prev, userData];
        }
        return prev;
      });
    };

    const handleUserStopTyping = (userData) => {
      setTypingUsers(prev => prev.filter(u => u.userId !== userData.userId));
    };

    const handleError = (error) => {
      toast.error(error.message || 'An error occurred');
    };

    // Socket event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('room-messages', handleRoomMessages);
    socket.on('new-message', handleNewMessage);
    socket.on('ai-thinking', handleAiThinking);
    socket.on('ai-error', handleAiError);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stop-typing', handleUserStopTyping);
    socket.on('error', handleError);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('room-messages', handleRoomMessages);
      socket.off('new-message', handleNewMessage);
      socket.off('ai-thinking', handleAiThinking);
      socket.off('ai-error', handleAiError);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stop-typing', handleUserStopTyping);
      socket.off('error', handleError);
    };
  }, [socket, user]);

  // Auto-scroll when messages or AI thinking state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiThinking]);

  // Other functions (your existing code)
  const handleSendMessage = (content) => {
    if (!content.trim() || !isConnected) return;

    socket.emit('send-message', {
      roomId: user.roomId,
      userId: user.userId,
      username: user.username,
      content: content.trim(),
      webSearchEnabled
    });

    // Force scroll after sending message
    setTimeout(() => scrollToBottom(true), 100);
  };

  const handleTyping = () => {
    socket.emit('typing', {
      roomId: user.roomId,
      userId: user.userId,
      username: user.username
    });
  };

  const handleStopTyping = () => {
    socket.emit('stop-typing', {
      roomId: user.roomId,
      userId: user.userId
    });
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(user.roomId);
      toast.success('Room ID copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy room ID');
    }
  };

  const handleLeaveRoom = () => {
    if (window.confirm('Are you sure you want to leave this room?')) {
      socket?.disconnect();
      onLeave();
      navigate('/');
    }
  };

  const handleWebSearchToggle = (enabled) => {
    setWebSearchEnabled(enabled);
    toast.success(`Web search ${enabled ? 'enabled' : 'disabled'}`);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner message="Connecting to room..." />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleLeaveRoom}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>

            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                AI Chat Room
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                <span>•</span>
                <span>{messages.length} messages</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <WebSearchToggle
              enabled={webSearchEnabled}
              onChange={handleWebSearchToggle}
              disabled={!isConnected}
            />

            <div className="flex items-center space-x-2">
              <button
                onClick={copyRoomId}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
                <span>Copy ID</span>
              </button>

              <button
                onClick={() => navigate('/documents')}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg transition-colors"
              >
                <DocumentTextIcon className="w-4 h-4" />
                <span>Docs</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container with Scroll Detection */}
      <div
        className="flex-1 overflow-hidden"
        ref={messagesContainerRef}
        onScroll={checkScrollPosition}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
      >
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <MessageList
            messages={messages}
            currentUserId={user.userId}
            isAiThinking={isAiThinking}
          />
          <TypingIndicator users={typingUsers} />
          {/* This div is the scroll target */}
          <div ref={messagesEndRef} style={{ height: '1px' }} />
        </div>
      </div>

      {/* Scroll to Bottom Button (appears when user scrolled up) */}
      {userScrolledUp && (
        <div className="absolute bottom-20 right-4">
          <button
            onClick={() => scrollToBottom(true)}
            className="bg-primary-600 text-white p-2 rounded-full shadow-lg hover:bg-primary-700 transition-colors"
            title="Scroll to bottom"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-white border-t px-4 py-3">
        <MessageInput
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          onStopTyping={handleStopTyping}
          disabled={!isConnected}
          placeholder={
            webSearchEnabled
              ? "Type your message... (add ? for AI assistance with web search)"
              : "Type your message... (add ? for AI assistance from documents only)"
          }
        />
        <div className="mt-2 text-xs text-gray-500 flex items-center justify-center">
          <span>
            💡 Tip: {webSearchEnabled
              ? 'Web search is enabled - AI can use internet sources'
              : 'Web search is disabled - AI will only use uploaded documents'
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
