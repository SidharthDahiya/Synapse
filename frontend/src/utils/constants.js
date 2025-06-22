// API endpoints
export const API_ENDPOINTS = {
  CHAT: '/api/chat',
  DOCUMENTS: '/api/documents',
};

// File upload constraints
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  ALLOWED_EXTENSIONS: ['.pdf', '.txt', '.docx']
};

// Socket events
export const SOCKET_EVENTS = {
  // Client to server
  JOIN_ROOM: 'join-room',
  SEND_MESSAGE: 'send-message',
  TYPING: 'typing',
  STOP_TYPING: 'stop-typing',

  // Server to client
  ROOM_MESSAGES: 'room-messages',
  NEW_MESSAGE: 'new-message',
  AI_THINKING: 'ai-thinking',
  AI_ERROR: 'ai-error',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  USER_TYPING: 'user-typing',
  USER_STOP_TYPING: 'user-stop-typing',
  ERROR: 'error'
};

// Message types
export const MESSAGE_TYPES = {
  USER: 'user',
  AI: 'ai'
};

// UI constants
export const UI = {
  MAX_MESSAGE_LENGTH: 2000,
  MIN_USERNAME_LENGTH: 2,
  MAX_USERNAME_LENGTH: 20,
  MESSAGES_PER_PAGE: 50,
  TYPING_TIMEOUT: 1000,
  TOAST_DURATION: 4000
};

// Local storage keys
export const STORAGE_KEYS = {
  USER: 'chatUser',
  THEME: 'theme',
  SETTINGS: 'settings'
};

// Document status
export const DOCUMENT_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SERVER_ERROR: 'Server error. Please try again later.',
  FILE_TOO_LARGE: 'File is too large. Maximum size is 10MB.',
  INVALID_FILE_TYPE: 'Invalid file type. Only PDF, TXT, and DOCX files are allowed.',
  UPLOAD_FAILED: 'Failed to upload file. Please try again.',
  CONNECTION_LOST: 'Connection lost. Attempting to reconnect...',
  RECONNECTED: 'Connection restored.',
  FAILED_TO_SEND: 'Failed to send message. Please try again.'
};
