<p align="center">
  <img src="frontend/public/logo.png" alt="AI Chat App Logo" width="400" height="400" />
</p>

<h1 align="center">Synapse - AI Chat Room</h1>
<p align="center"><i>AI-Powered Real-Time Chat Application with RAG and Document Processing</i></p>

<p align="center">
  <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/Frontend-React%2018-blue" alt="React"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Backend-Node.js%2018-green" alt="Node.js"></a>
  <a href="https://ai.google.dev/"><img src="https://img.shields.io/badge/AI-Google%20Gemini-purple" alt="AI Powered"></a>
  <a href="https://socket.io/"><img src="https://img.shields.io/badge/Real--time-Socket.IO-black" alt="Socket.IO"></a>
</p>

## 🌟 Overview
Synapse is a smart team messaging platform that lets you and your colleagues chat in real-time while getting intelligent answers from an AI assistant. What makes it special? You can upload your documents (PDFs, Word files, text files), and the AI will read them and answer questions about their content - all while collaborating with multiple team members in shared chat rooms.

Think of it as having a personal assistant that has read all your team's documents and can instantly help anyone find information, explain concepts, or answer questions during group conversations. Whether you're working alone or with a distributed team, everyone gets access to the same AI knowledge base.

**🎯 Problem Solved**: Most chat apps are just for basic messaging, AI tools work in isolation, and team collaboration on documents is fragmented across multiple platforms. Our app brings everything together - you get instant team messaging with an AI that actually understands your shared documents. No more switching between Slack, ChatGPT, and document viewers, or having team members search through files separately to find the same information.

**Key Benefits**:

👥 Multi-user rooms - Multiple people can join the same chat room for team collaboration

🤖 Smart AI assistant - Ask questions and get intelligent responses

📄 Document-aware - AI reads your uploaded files and answers based on their content

🌐 Web search option - AI can also search the internet when needed

🤝 Team collaboration - Work together on projects, brainstorm ideas, and share knowledge

Perfect for students studying from PDFs, teams collaborating on documents, researchers working with papers, or anyone who wants an AI assistant that knows their specific content.

## 🎬 Platform Demo Video: [YouTube Demo](https://youtu.be/CEIwTCGZNmE) ↗

## ✨ Key Features

### 🤖 AI-Powered Conversations
- **Google Gemini Integration**: Advanced AI responses using state-of-the-art language models
- **RAG Technology**: Retrieval-Augmented Generation based on uploaded documents
- **Smart Context**: AI understands document content and provides relevant answers
- **Web Search Toggle**: Optional integration with external web sources for enhanced responses

### 📄 Document Processing Suite
- **Multi-Format Support**: PDF, TXT, and DOCX file processing
- **Intelligent Chunking**: Automatic text segmentation for optimal AI processing  
- **Memory-Safe Processing**: Optimized for large files without system crashes
- **Real-Time Upload**: Drag & drop interface with live processing feedback

### 💬 Real-Time Messaging System
- **Instant Communication**: Socket.IO powered real-time messaging
- **Room-Based Chat**: Create or join specific conversation rooms
- **Typing Indicators**: Live typing status and user presence
- **Message History**: Persistent chat history with pagination support

### 🎨 Modern User Experience
- **Responsive Design**: Tailwind CSS with mobile-first approach
- **Dark/Light Themes**: Customizable interface themes
- **Smooth Animations**: Enhanced UX with fluid transitions
- **Auto-Scroll**: Smart message scrolling with manual override

## 🎯 Complete Usage Workflow

### Step 1: Document Upload
- Drag & drop or select your documents (PDF, TXT, DOCX)
- Real-time processing with progress indicators
- Automatic text extraction and chunking

### Step 2: Room Creation/Join
- Create new chat rooms or join existing ones
- Set username and room preferences
- Invite others using room ID sharing

### Step 3: AI-Enhanced Conversations  
- 💬 Send messages in real-time
- 🤖 Add "?" to trigger AI assistance
- 📊 Toggle web search for external information
- 📄 Get responses based on uploaded documents

### Step 4: Advanced Features
- 🔍 Search through message history
- 📁 Manage uploaded documents
- ⚡ Redis-cached responses for speed
- 🌐 Web search integration when enabled

## 🛠️ Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Tailwind CSS, Socket.IO Client, Axios, React Router |
| **Backend** | Node.js, Express.js, Socket.IO, Multer, PDF-Parse, Mammoth |
| **Database** | MongoDB, Redis (Caching & Pub/Sub) |
| **AI/ML** | Google Gemini API, RAG Implementation, Web Search API |
| **Deployment** | Appwrite Functions, Appwrite Database, Appwrite Sites |
| **DevOps** | Docker, Docker Compose, PM2, Nginx |


## 📁 Project Structure

```
Synapse/
├── 🎯 backend/ # Express.js Backend Server
│ ├── src/
│ │ ├── controllers/ # API route handlers
│ │ ├── models/ # Database schemas
│ │ ├── routes/ # Express routes
│ │ ├── services/ # Business logic
│ │ │ ├── ragService.js # RAG implementation
│ │ │ ├── socketService.js # Real-time logic
│ │ │ └── webSearchService.js # Web search integration
│ │ ├── middleware/ # Express middleware
│ │ └── utils/ # Helper functions
│ ├── documents/ # File upload storage
│ └── server.js # Application entry point
├── 🌐 frontend/ # React Frontend Application
│ ├── src/
│ │ ├── components/ # React components
│ │ │ ├── ChatRoom.jsx # Main chat interface
│ │ │ ├── DocumentManager.jsx # File management
│ │ │ ├── MessageList.jsx # Message display
│ │ │ └── WebSearchToggle.jsx # Search control
│ │ ├── services/ # API communication
│ │ ├── hooks/ # Custom React hooks
│ │ └── utils/ # Frontend utilities
│ ├── public/ # Static assets
│ └── package.json # Dependencies
├── 🐳 docker-compose.yml # Container orchestration
├── 📋 docs/ # Documentation
└── 📖 README.md # Project documentation
```

## 🏃‍♂️ Quick Start Guide

### Prerequisites

Ensure you have the following tools installed:

- Node.js (v18 or higher)
- MongoDB (v6.0+)
- Redis (v7+)
- Git
- Google Gemini API Key

### 🔧 Local Development Setup

1. **Clone & Navigate**
   ```bash
   git clone https://github.com/SidharthDahiya/Synapse.git
   cd Synapse
   ```
   
2. **Backend Setup**

   ```bash
   cd backend
   npm install
   cp .env.example .env

   #Add your API keys to .env file
   npm run dev
   ```
   
3. **Frontend Setup**

   ```bash
   cd frontend
   npm install
   cp .env.example .env
   npm start
   ```
4. **Environment Configuration**
   ```bash
   #Backend .env
   GEMINI_API_KEY=your_google_gemini_api_key
   SERPER_API_KEY=your_serper_api_key_optional
   MONGODB_URI=mongodb://localhost:27017/ai-chat
   REDIS_URL=redis://localhost:6379
   ```

5. **Start Dependencies**

   ```bash
   #Start MongoDB
   mongod

   #Start Redis
   redis-server
   ```
   Open [http://localhost:3000](http://localhost:3000)

### 🐳 Docker Deployment

```bash
  #Quick start with Docker
   docker-compose up -d

   #View logs 
   docker-compose logs -f

   #Stop services
   docker-compose down
 ```



## 🔌 API Endpoints

### Chat Management
- `GET /api/chat/rooms/:roomId/messages` - Retrieve room messages
- `POST /api/chat/rooms/:roomId/messages` - Send new message
- `DELETE /api/chat/rooms/:roomId/messages` - Clear room history

### Document Operations
- `POST /api/documents/upload` - Upload new document
- `GET /api/documents` - List all documents
- `DELETE /api/documents/:id` - Remove document
- `GET /api/documents/:id/status` - Check processing status

### AI & Search
- `POST /api/ai/generate` - Generate AI response
- `GET /api/search/web` - Perform web search
- `GET /api/health` - System health check


## 🎮 Real-Time Events

### Socket.IO Events
- `join-room` - Join chat room
- `send-message` - Send message
- `new-message` - Receive message
- `ai-thinking` - AI processing indicator
- `user-typing` - Typing status
- `user-joined/left` - Presence updates



---

<p align="center">
  <strong>Built with ❤️ using AI and real-time technologies</strong>
</p>

<p align="center">
  <a href="https://ai.google.dev/">Google Gemini</a> • 
  <a href="https://socket.io/">Socket.IO</a> • 
  <a href="https://reactjs.org/">React</a>
</p>
