import express from 'express';
import Message from '../models/Message.js';
import { redisClient } from '../../server.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get room messages with pagination
router.get('/rooms/:roomId/messages', asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const skip = (page - 1) * limit;

  // Validate parameters
  if (!roomId) {
    return res.status(400).json({ error: 'Room ID is required' });
  }

  // Try cache first
  const cacheKey = `room:${roomId}:messages:page:${page}`;
  const cachedMessages = await redisClient.get(cacheKey);

  if (cachedMessages) {
    return res.json(JSON.parse(cachedMessages));
  }

  // Query database
  const messages = await Message.find({ roomId })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  const totalMessages = await Message.countDocuments({ roomId });
  const hasMore = skip + messages.length < totalMessages;

  const result = {
    messages: messages.reverse(),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalMessages,
      hasMore
    }
  };

  // Cache result for 5 minutes
  await redisClient.setEx(cacheKey, 300, JSON.stringify(result));

  res.json(result);
}));

// Get room statistics
router.get('/rooms/:roomId/stats', asyncHandler(async (req, res) => {
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
        lastMessage: { $max: '$timestamp' }
      }
    }
  ]);

  const result = stats[0] || {
    totalMessages: 0,
    userMessages: 0,
    aiMessages: 0,
    uniqueUsers: [],
    firstMessage: null,
    lastMessage: null
  };

  result.uniqueUsersCount = result.uniqueUsers.length;
  delete result.uniqueUsers;

  // Cache for 10 minutes
  await redisClient.setEx(cacheKey, 600, JSON.stringify(result));

  res.json(result);
}));

// Delete room messages (admin endpoint)
router.delete('/rooms/:roomId/messages', asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  if (!roomId) {
    return res.status(400).json({ error: 'Room ID is required' });
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
    deletedCount: result.deletedCount
  });
}));

export default router;
