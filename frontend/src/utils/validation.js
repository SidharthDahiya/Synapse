import { UI, FILE_UPLOAD } from './constants';

// Validate username
export const validateUsername = (username) => {
  const errors = [];

  if (!username || !username.trim()) {
    errors.push('Username is required');
  } else if (username.trim().length < UI.MIN_USERNAME_LENGTH) {
    errors.push(`Username must be at least ${UI.MIN_USERNAME_LENGTH} characters long`);
  } else if (username.trim().length > UI.MAX_USERNAME_LENGTH) {
    errors.push(`Username must be less than ${UI.MAX_USERNAME_LENGTH} characters`);
  } else if (!/^[a-zA-Z0-9_\s-]+$/.test(username.trim())) {
    errors.push('Username can only contain letters, numbers, spaces, hyphens, and underscores');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validate room ID
export const validateRoomId = (roomId) => {
  const errors = [];

  if (!roomId || !roomId.trim()) {
    errors.push('Room ID is required');
  } else if (roomId.trim().length < 3) {
    errors.push('Room ID must be at least 3 characters long');
  } else if (roomId.trim().length > 50) {
    errors.push('Room ID must be less than 50 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validate message content
export const validateMessage = (content) => {
  const errors = [];

  if (!content || !content.trim()) {
    errors.push('Message cannot be empty');
  } else if (content.trim().length > UI.MAX_MESSAGE_LENGTH) {
    errors.push(`Message must be less than ${UI.MAX_MESSAGE_LENGTH} characters`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validate file upload
export const validateFile = (file) => {
  const errors = [];

  if (!file) {
    errors.push('No file selected');
    return { isValid: false, errors };
  }

  // Check file type
  if (!FILE_UPLOAD.ALLOWED_TYPES.includes(file.type)) {
    errors.push('File type not supported. Please upload PDF, TXT, or DOCX files.');
  }

  // Check file size
  if (file.size > FILE_UPLOAD.MAX_SIZE) {
    const maxSizeMB = FILE_UPLOAD.MAX_SIZE / (1024 * 1024);
    errors.push(`File size exceeds ${maxSizeMB}MB limit`);
  }

  // Check if file is empty
  if (file.size === 0) {
    errors.push('File appears to be empty');
  }

  // Check filename
  if (!file.name || file.name.length > 255) {
    errors.push('Invalid filename');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validate form data
export const validateJoinRoomForm = (formData) => {
  const errors = {};

  // Validate username
  const usernameValidation = validateUsername(formData.username);
  if (!usernameValidation.isValid) {
    errors.username = usernameValidation.errors;
  }

  // Validate room ID (only for join action)
  if (formData.action === 'join') {
    const roomIdValidation = validateRoomId(formData.roomId);
    if (!roomIdValidation.isValid) {
      errors.roomId = roomIdValidation.errors;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Sanitize input
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
};

// Check if string contains profanity (basic implementation)
export const containsProfanity = (text) => {
  // This is a very basic implementation
  // In a real app, you'd use a more comprehensive profanity filter
  const profanityWords = ['spam', 'test123']; // Add actual words as needed
  const lowercaseText = text.toLowerCase();

  return profanityWords.some(word => lowercaseText.includes(word));
};
