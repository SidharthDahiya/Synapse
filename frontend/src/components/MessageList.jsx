import React from 'react';
import { formatTime } from '../utils/helpers';
import { DocumentTextIcon, UserIcon, SparklesIcon } from '@heroicons/react/24/outline';

const MessageList = ({ messages, currentUserId, isAiThinking }) => {
  const renderMessage = (message) => {
    const isCurrentUser = message.userId === currentUserId;
    const isAI = message.type === 'ai';

    return (
      <div
        key={message.id}
        className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-4 animate-slide-up`}
      >
        <div
          className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
            isAI
              ? 'bg-purple-100 text-purple-900 border border-purple-200'
              : isCurrentUser
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
          }`}
        >
          {/* Message Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {isAI ? (
                <SparklesIcon className="w-4 h-4" />
              ) : (
                <UserIcon className="w-4 h-4" />
              )}
              <span className="text-xs font-medium">
                {message.username}
              </span>
            </div>
            <span className={`text-xs ${isAI ? 'text-purple-600' : isCurrentUser ? 'text-white/75' : 'text-gray-500'}`}>
              {formatTime(message.timestamp)}
            </span>
          </div>

          {/* Message Content */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>

          {/* Sources (for AI messages) */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-purple-200">
              <div className="flex items-start space-x-2">
                <DocumentTextIcon className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-purple-700 mb-1">Sources:</p>
                  <div className="space-y-1">
                    {message.sources.map((source, index) => (
                      <div key={index} className="text-xs text-purple-600 break-words">
                        <span className="font-medium">{source.filename}</span>
                        {source.similarity && (
                          <span className="ml-2 text-purple-500">
                            ({Math.round(source.similarity * 100)}% match)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}


{message.webResults && message.webResults.length > 0 && (
  <div className="mt-3 pt-3 border-t border-purple-200">
    <div className="flex items-start space-x-2">
      <svg className="w-4 h-4 text-purple-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
      </svg>
      <div>
        <p className="text-xs font-medium text-purple-700 mb-1">Web Search Results:</p>
        <div className="space-y-1">
          {message.webResults.map((result, index) => (
            <div key={index} className="text-xs text-purple-600">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-purple-800 underline"
              >
                {result.title}
              </a>
              <span className="ml-2 text-purple-500">({result.source})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}

        </div>
      </div>
    );
  };

  const renderAiThinking = () => (
    <div className="flex justify-start mb-4">
      <div className="bg-purple-100 text-purple-900 border border-purple-200 max-w-xs lg:max-w-md px-4 py-3 rounded-lg">
        <div className="flex items-center space-x-3">
          <SparklesIcon className="w-4 h-4" />
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
            <span className="text-sm">AI is thinking...</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-2">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <SparklesIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">Start the conversation</h3>
            <p className="text-gray-500 text-sm max-w-md">
              Send a message to begin chatting. Add "?" to get AI assistance based on your uploaded documents!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map(renderMessage)}
          {isAiThinking && renderAiThinking()}
        </div>
      )}
    </div>
  );
};

export default MessageList;
