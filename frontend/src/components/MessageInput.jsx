import React, { useState, useRef, useCallback } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { debounce } from '../utils/helpers';

const MessageInput = ({ onSendMessage, onTyping, onStopTyping, disabled, placeholder }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef(null);

  // Debounced stop typing function
  const debouncedStopTyping = useCallback(
    debounce(() => {
      if (isTyping) {
        onStopTyping();
        setIsTyping(false);
      }
    }, 1000),
    [onStopTyping, isTyping]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;

    onSendMessage(message);
    setMessage('');

    // Stop typing when message is sent
    if (isTyping) {
      onStopTyping();
      setIsTyping(false);
    }

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }

    // Handle typing indicators
    if (value.trim() && !disabled) {
      if (!isTyping) {
        onTyping();
        setIsTyping(true);
      }
      debouncedStopTyping();
    } else if (isTyping) {
      onStopTyping();
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isQuestionMessage = message.includes('?');

  return (
    <form onSubmit={handleSubmit} className="flex items-end space-x-3">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={`w-full px-4 py-3 pr-12 border rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
            disabled 
              ? 'bg-gray-100 cursor-not-allowed' 
              : isQuestionMessage
              ? 'border-purple-300 bg-purple-50'
              : 'border-gray-300'
          }`}
          style={{ maxHeight: '120px' }}
        />

        {/* AI indicator */}
        {isQuestionMessage && (
          <div className="absolute right-3 top-3 flex items-center text-purple-600">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse mr-2"></div>
            <span className="text-xs font-medium">AI will respond</span>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className={`p-3 rounded-lg transition-colors ${
          disabled || !message.trim()
            ? 'bg-gray-200 cursor-not-allowed'
            : isQuestionMessage
            ? 'bg-purple-600 hover:bg-purple-700 text-white'
            : 'bg-primary-600 hover:bg-primary-700 text-white'
        }`}
      >
        <PaperAirplaneIcon className="w-5 h-5" />
      </button>
    </form>
  );
};

export default MessageInput;
