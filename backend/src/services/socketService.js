import Message from '../models/Message.js';
import { redisClient } from '../../server.js';
import ragService from './ragService.js';

export const handleSocketConnection = (socket, io) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('join-room', async (data) => {
    try {
      const { roomId, userId, username } = data;

      if (!roomId || !userId || !username) {
        socket.emit('error', { message: 'Missing required data' });
        return;
      }

      socket.join(roomId);

      // Store user info in Redis
      await redisClient.hSet(`user:${socket.id}`, {
        roomId,
        userId,
        username,
        joinedAt: new Date().toISOString()
      });

      // Load recent messages from cache or database
      const cacheKey = `room:${roomId}:messages`;
      let messages = await redisClient.lRange(cacheKey, 0, 49);

      if (messages.length === 0) {
        // Load from database if not in cache
        const dbMessages = await Message.find({ roomId })
          .sort({ timestamp: -1 })
          .limit(50)
          .lean();

        if (dbMessages.length > 0) {
          messages = dbMessages.reverse().map(msg => ({
            id: msg._id.toString(),
            userId: msg.userId,
            username: msg.username,
            content: msg.content,
            type: msg.type,
            timestamp: msg.timestamp,
            ...(msg.metadata && msg.metadata.sources && { sources: msg.metadata.sources }),
            ...(msg.metadata && msg.metadata.webResults && { webResults: msg.metadata.webResults })
          }));

          // Cache messages (expire in 1 hour)
          const messageStrings = messages.map(msg => JSON.stringify(msg));
          if (messageStrings.length > 0) {
            await redisClient.lPush(cacheKey, ...messageStrings);
            await redisClient.expire(cacheKey, 3600);
          }
        } else {
          messages = [];
        }
      } else {
        messages = messages.map(msg => JSON.parse(msg)).reverse();
      }

      socket.emit('room-messages', messages);
      socket.to(roomId).emit('user-joined', { userId, username });

      console.log(`User ${username} joined room ${roomId}`);
    } catch (error) {
      console.error('Error in join-room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle new message with web search toggle support
  socket.on('send-message', async (data) => {
    try {
      const { roomId, userId, username, content, webSearchEnabled = true } = data;

      console.log(`📨 Message received from ${username}: "${content.substring(0, 50)}..." (Web search: ${webSearchEnabled})`);

      if (!roomId || !userId || !username || !content?.trim()) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // Save message to database
      const message = new Message({
        roomId,
        userId,
        username,
        content: content.trim(),
        type: 'user'
      });
      await message.save();

      const messageData = {
        id: message._id.toString(),
        userId,
        username,
        content: content.trim(),
        type: 'user',
        timestamp: message.timestamp
      };

      // Add to Redis cache
      const cacheKey = `room:${roomId}:messages`;
      await redisClient.lPush(cacheKey, JSON.stringify(messageData));
      await redisClient.lTrim(cacheKey, 0, 49); // Keep only 50 recent messages
      await redisClient.expire(cacheKey, 3600);

      // Broadcast to room
      io.to(roomId).emit('new-message', messageData);

      // Check if message is a question (contains ?)
      if (content.includes('?')) {
        // Generate AI response with web search preference
        socket.emit('ai-thinking', { roomId });

        try {
          console.log(`🤖 Generating AI response with web search ${webSearchEnabled ? 'enabled' : 'disabled'}`);

          const aiResponse = await ragService.generateAnswer(content, roomId, webSearchEnabled);

          // Save AI response with metadata including sources and web results
          const aiMessage = new Message({
            roomId,
            userId: 'ai',
            username: 'AI Assistant',
            content: aiResponse.answer,
            type: 'ai',
            metadata: {
              sources: aiResponse.sources || [],
              webResults: aiResponse.webResults || [],
              webSearchEnabled: webSearchEnabled,
              timestamp: new Date().toISOString()
            }
          });
          await aiMessage.save();

          const aiMessageData = {
            id: aiMessage._id.toString(),
            userId: 'ai',
            username: 'AI Assistant',
            content: aiResponse.answer,
            type: 'ai',
            timestamp: aiMessage.timestamp,
            sources: aiResponse.sources || [],
            webResults: aiResponse.webResults || []
          };

          // Add to Redis cache
          await redisClient.lPush(cacheKey, JSON.stringify(aiMessageData));
          await redisClient.lTrim(cacheKey, 0, 49);
          await redisClient.expire(cacheKey, 3600);

          // Broadcast AI response
          io.to(roomId).emit('new-message', aiMessageData);

          console.log(`✅ AI response sent: ${aiResponse.sources?.length || 0} document sources, ${aiResponse.webResults?.length || 0} web results`);

        } catch (error) {
          console.error('❌ Error generating AI response:', error);
          socket.emit('ai-error', {
            message: 'Failed to generate AI response',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('user-typing', {
      userId: data.userId,
      username: data.username
    });
  });

  socket.on('stop-typing', (data) => {
    socket.to(data.roomId).emit('user-stop-typing', {
      userId: data.userId
    });
  });

  // Handle web search toggle state (optional - for room-wide settings)
  socket.on('toggle-web-search', async (data) => {
    try {
      const { roomId, userId, username, enabled } = data;

      console.log(`🔄 ${username} ${enabled ? 'enabled' : 'disabled'} web search in room ${roomId}`);

      // Optionally broadcast to other users in the room
      socket.to(roomId).emit('web-search-toggled', {
        userId,
        username,
        enabled,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error handling web search toggle:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      const userData = await redisClient.hGetAll(`user:${socket.id}`);
      if (userData.roomId) {
        socket.to(userData.roomId).emit('user-left', {
          userId: userData.userId,
          username: userData.username
        });
        console.log(`User ${userData.username} left room ${userData.roomId}`);
      }
      await redisClient.del(`user:${socket.id}`);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
    console.log('User disconnected:', socket.id);
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
};
