import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import corsConfig from './src/middleware/corsConfig.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import chatRoutes from './src/routes/chatRoutes.js';
import documentRoutes from './src/routes/documentRoutes.js';
import { handleSocketConnection } from './src/services/socketService.js';

dotenv.config();

// Debug environment
console.log('Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('GEMINI_API_KEY length:', process.env.GEMINI_API_KEY?.length);

const app = express();
const server = createServer(app);

// Apply CORS FIRST - before any other middleware
app.use(corsConfig);

// Then other middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Database connections (your existing code)
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-chat');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export let redisClient;
const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => console.log('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('Redis connected successfully'));

    await redisClient.connect();
  } catch (error) {
    console.error('Redis connection error:', error);
    process.exit(1);
  }
};

await connectDB();
await connectRedis();

// Routes
console.log('📝 Registering routes...');
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
console.log('✅ Routes registered');

// Add this debugging middleware to list all routes
app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log('📍 Route registered:', r.route.path)
  } else if (r.name === 'router') {
    r.handle.stack.forEach(function(route) {
      if (route.route) {
        console.log('📍 Route registered:', r.regexp.source.replace('\\','').replace('?(?=','') + route.route.path);
      }
    });
  }
});


// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    cors: 'enabled'
  });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  handleSocketConnection(socket, io);
});

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
