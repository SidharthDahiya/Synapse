import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { UserIcon, PlusIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const JoinRoom = ({ onUserJoin }) => {
  const [formData, setFormData] = useState({
    username: '',
    roomId: '',
    action: 'join' // 'join' or 'create'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!formData.username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    if (formData.username.trim().length < 2) {
      toast.error('Username must be at least 2 characters long');
      return;
    }

    if (formData.username.trim().length > 20) {
      toast.error('Username must be less than 20 characters');
      return;
    }

    let roomId = formData.roomId;

    if (formData.action === 'create') {
      roomId = uuidv4();
    } else if (!roomId.trim()) {
      toast.error('Please enter a room ID');
      return;
    }

    setIsSubmitting(true);

    try {
      const userData = {
        userId: uuidv4(),
        username: formData.username.trim(),
        roomId: roomId.trim()
      };

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success(
        formData.action === 'create'
          ? 'Room created successfully!'
          : 'Joining room...'
      );

      onUserJoin(userData);
    } catch (error) {
      toast.error('Failed to join room. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="card animate-fade-in">
          <div className="text-center mb-8">
            <img
    src="/logo.png" // Replace with your actual logo filename
    alt="Logo"
    className="mx-auto mb-2 w-48 h-48"
    style={{ display: 'block' }}
  />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {process.env.REACT_APP_APP_NAME || 'AI Chat Room'}
            </h1>
            <p className="text-gray-600">
              Join or create a room to start chatting with AI assistance
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="input-field"
                placeholder="Enter your username"
                required
                maxLength="20"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-4">
              <div className="flex space-x-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="action"
                    value="join"
                    checked={formData.action === 'join'}
                    onChange={(e) => handleInputChange('action', e.target.value)}
                    className="text-primary-600 focus:ring-primary-500"
                    disabled={isSubmitting}
                  />
                  <span className="ml-2 text-sm text-gray-700">Join Room</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="action"
                    value="create"
                    checked={formData.action === 'create'}
                    onChange={(e) => handleInputChange('action', e.target.value)}
                    className="text-primary-600 focus:ring-primary-500"
                    disabled={isSubmitting}
                  />
                  <span className="ml-2 text-sm text-gray-700">Create Room</span>
                </label>
              </div>

              {formData.action === 'join' && (
                <div className="animate-slide-up">
                  <label htmlFor="roomId" className="block text-sm font-medium text-gray-700 mb-2">
                    Room ID
                  </label>
                  <input
                    type="text"
                    id="roomId"
                    value={formData.roomId}
                    onChange={(e) => handleInputChange('roomId', e.target.value)}
                    className="input-field"
                    placeholder="Enter room ID"
                    required={formData.action === 'join'}
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="spinner w-4 h-4 border-2 border-white border-t-transparent"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {formData.action === 'join' ? (
                    <ArrowRightIcon className="w-4 h-4" />
                  ) : (
                    <PlusIcon className="w-4 h-4" />
                  )}
                  <span>
                    {formData.action === 'join' ? 'Join Room' : 'Create Room'}
                  </span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <a
              href="/documents"
              className="text-primary-600 hover:text-primary-800 text-sm font-medium transition-colors"
            >
              Manage Documents →
            </a>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Version {process.env.REACT_APP_VERSION || '1.0.0'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default JoinRoom;
