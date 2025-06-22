import Message from '../models/Message.js';
import { redisClient } from '../../server.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Get room messages with pagination
export const getRoomMessages = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const skip = (page - 1) * limit;

  // Validate parameters
  if (!roomId) {
    return res.status(400).json({ error: 'Room ID is required' });
  }

  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Invalid pagination parameters' });
  }

  // Try cache first
  const cacheKey = `room:${roomId}:messages:page:${page}:limit:${limit}`;
  const cachedMessages = await redisClient.get(cacheKey);

  if (cachedMessages) {
    return res.json(JSON.parse(cachedMessages));
  }

  // Query database
  const [messages, totalMessages] = await Promise.all([
    Message.find({ roomId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    Message.countDocuments({ roomId })
  ]);

  const hasMore = skip + messages.length < totalMessages;
  const totalPages = Math.ceil(totalMessages / limit);

  const result = {
    messages: messages.reverse().map(msg => ({
      id: msg._id.toString(),
      userId: msg.userId,
      username: msg.username,
      content: msg.content,
      type: msg.type,
      timestamp: msg.timestamp,
      ...(msg.metadata && msg.metadata.sources && { sources: msg.metadata.sources })
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalMessages,
      totalPages,
      hasMore,
      hasPrevious: page > 1
    }
  };

  // Cache result for 5 minutes
  await redisClient.setEx(cacheKey, 300, JSON.stringify(result));

  res.json(result);
});

// Get room statistics
export const getRoomStats = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  if (!roomId) {
    return res.status(400).json({ error: 'Room ID is required' });
  }

  // Try cache first
  const cacheKey = `room:${roomId}:stats`;
  const cachedStats = await redisClient.get(cacheKey);

  if (cachedStats) {
    return res.json(JSON.parse(cachedStats));
  }

  const stats = await Message.aggregate([
    { $match: { roomId } },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        userMessages: {
          $sum: { $cond: [{ $eq: ['$type', 'user'] }, 1, 0] }
        },
        aiMessages: {
          $sum: { $cond: [{ $eq: ['$type', 'ai'] }, 1, 0] }
        },
        uniqueUsers: { $addToSet: '$userId' },
        firstMessage: { $min: '$timestamp' },
        lastMessage: { $max: '$timestamp' },
        avgMessageLength: { $avg: { $strLenCP: '$content' } }
      }
    }
  ]);

  const result = stats[0] || {
    totalMessages: 0,
    userMessages: 0,
    aiMessages: 0,
    uniqueUsers: [],
    firstMessage: null,
    lastMessage: null,
    avgMessageLength: 0
  };

  // Calculate additional stats
  result.uniqueUsersCount = result.uniqueUsers.length;
  result.aiResponseRate = result.totalMessages > 0
    ? Math.round((result.aiMessages / result.totalMessages) * 100)
    : 0;
  result.avgMessageLength = Math.round(result.avgMessageLength || 0);

  // Remove uniqueUsers array from response for privacy
  delete result.uniqueUsers;

  // Cache for 10 minutes
  await redisClient.setEx(cacheKey, 600, JSON.stringify(result));

  res.json(result);
});

// Get recent active rooms
export const getActiveRooms = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const activeRooms = await Message.aggregate([
    {
      $group: {
        _id: '$roomId',
        lastActivity: { $max: '$timestamp' },
        messageCount: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $project: {
        roomId: '$_id',
        lastActivity: 1,
        messageCount: 1,
        userCount: { $size: '$uniqueUsers' },
        _id: 0
      }
    },
    { $sort: { lastActivity: -1 } },
    { $limit: parseInt(limit) }
  ]);

  res.json(activeRooms);
});

// Delete room messages (admin endpoint)
export const deleteRoomMessages = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { confirm } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: 'Room ID is required' });
  }

  if (!confirm) {
    return res.status(400).json({
      error: 'Confirmation required',
      message: 'Send { "confirm": true } to confirm deletion'
    });
  }

  // Delete from database
  const result = await Message.deleteMany({ roomId });

  // Clear cache
  const cacheKeys = await redisClient.keys(`room:${roomId}:*`);
  if (cacheKeys.length > 0) {
    await redisClient.del(cacheKeys);
  }

  res.json({
    message: 'Room messages deleted successfully',
    deletedCount: result.deletedCount,
    roomId
  });
});

// Get message by ID
export const getMessageById = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  if (!messageId) {
    return res.status(400).json({ error: 'Message ID is required' });
  }

  const message = await Message.findById(messageId).lean();

  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  res.json({
    id: message._id.toString(),
    userId: message.userId,
    username: message.username,
    content: message.content,
    type: message.type,
    timestamp: message.timestamp,
    roomId: message.roomId,
    ...(message.metadata && { metadata: message.metadata })
  });
});

// Update message (edit functionality)
export const updateMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content, userId } = req.body;

  if (!messageId || !content || !userId) {
    return res.status(400).json({
      error: 'Message ID, content, and user ID are required'
    });
  }

  const message = await Message.findById(messageId);

  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  // Only allow user to edit their own messages
  if (message.userId !== userId) {
    return res.status(403).json({ error: 'Not authorized to edit this message' });
  }

  // Only allow editing within 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (message.timestamp < fiveMinutesAgo) {
    return res.status(400).json({ error: 'Message can only be edited within 5 minutes' });
  }

  message.content = content.trim();
  message.metadata = {
    ...message.metadata,
    edited: true,
    editedAt: new Date()
  };

  await message.save();

  // Clear room cache
  const cacheKeys = await redisClient.keys(`room:${message.roomId}:*`);
  if (cacheKeys.length > 0) {
    await redisClient.del(cacheKeys);
  }

  res.json({
    message: 'Message updated successfully',
    messageId: message._id.toString()
  });
});

// Delete single message
export const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { userId } = req.body;

  if (!messageId || !userId) {
    return res.status(400).json({
      error: 'Message ID and user ID are required'
    });
  }

  const message = await Message.findById(messageId);

  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  // Only allow user to delete their own messages
  if (message.userId !== userId) {
    return res.status(403).json({ error: 'Not authorized to delete this message' });
  }

  await Message.findByIdAndDelete(messageId);

  // Clear room cache
  const cacheKeys = await redisClient.keys(`room:${message.roomId}:*`);
  if (cacheKeys.length > 0) {
    await redisClient.del(cacheKeys);
  }

  res.json({
    message: 'Message deleted successfully',
    messageId
  });
});

// Search messages
export const searchMessages = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { query, page = 1, limit = 20 } = req.query;

  if (!roomId || !query) {
    return res.status(400).json({ error: 'Room ID and search query are required' });
  }

  const skip = (page - 1) * limit;

  const searchResults = await Message.find({
    roomId,
    content: { $regex: query, $options: 'i' }
  })
  .sort({ timestamp: -1 })
  .limit(parseInt(limit))
  .skip(skip)
  .lean();

  const totalResults = await Message.countDocuments({
    roomId,
    content: { $regex: query, $options: 'i' }
  });

  res.json({
    results: searchResults.map(msg => ({
      id: msg._id.toString(),
      userId: msg.userId,
      username: msg.username,
      content: msg.content,
      type: msg.type,
      timestamp: msg.timestamp
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalResults,
      hasMore: skip + searchResults.length < totalResults
    },
    query
  });
});
