import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import JoinRoom from './components/JoinRoom';
import ChatRoom from './components/ChatRoom';
import DocumentManager from './components/DocumentManager';
import { useLocalStorage } from './hooks/useLocalStorage';
import './App.css';

function App() {
  const [user, setUser] = useLocalStorage('chatUser', null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleUserJoin = (userData) => {
    setUser(userData);
  };

  const handleUserLeave = () => {
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-700">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <div className="App">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            }
          }}
        />
        <Routes>
          <Route
            path="/"
            element={
              user ?
                <Navigate to={`/room/${user.roomId}`} replace /> :
                <JoinRoom onUserJoin={handleUserJoin} />
            }
          />
          <Route
            path="/room/:roomId"
            element={
              user ?
                <ChatRoom user={user} onLeave={handleUserLeave} /> :
                <Navigate to="/" replace />
            }
          />
          <Route
            path="/documents"
            element={<DocumentManager />}
          />
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
