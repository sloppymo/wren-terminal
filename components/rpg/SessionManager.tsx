/**
 * Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
 * Wren Terminal - Shadowrun RPG Session Manager
 * This code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is strictly prohibited.
 */

import React, { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { createRpgSession, joinRpgSession, SessionRole } from '../../utils/api';

interface SessionManagerProps {
  onSessionJoined: (sessionId: string, role: SessionRole, characterName?: string) => void;
  onCancel: () => void;
  theme: any;
}

export default function SessionManager({ onSessionJoined, onCancel, theme }: SessionManagerProps) {
  const { user, isSignedIn } = useUser();
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [sessionName, setSessionName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [role, setRole] = useState<SessionRole>('player');
  const [characterName, setCharacterName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const userId = isSignedIn ? user?.id : 'guest-user';
      if (!userId) {
        throw new Error('User ID is required');
      }

      const response = await createRpgSession(
        sessionName,
        userId,
        'shadowrunBarren' // Default theme
      );

      onSessionJoined(response.session_id, 'gm', characterName || 'GM');
    } catch (error) {
      console.error('Failed to create session:', error);
      setError(error instanceof Error ? error.message : 'Failed to create session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const userId = isSignedIn ? user?.id : 'guest-user';
      if (!userId) {
        throw new Error('User ID is required');
      }

      const response = await joinRpgSession(
        sessionId,
        userId,
        role,
        characterName
      );

      onSessionJoined(response.session_id, response.role, characterName);
    } catch (error) {
      console.error('Failed to join session:', error);
      setError(error instanceof Error ? error.message : 'Failed to join session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`${theme.background} ${theme.text} p-6 rounded-lg shadow-lg`}>
      <h2 className="text-xl font-bold mb-4">Shadowrun RPG Session</h2>
      
      {mode === 'select' && (
        <div className="space-y-4">
          <p className="mb-4">Welcome to Shadowrun! Choose an option to begin:</p>
          <div className="flex flex-col space-y-3">
            <button
              onClick={() => setMode('create')}
              className={`${theme.accent} px-4 py-2 rounded hover:opacity-90`}
            >
              Create New Session
            </button>
            <button
              onClick={() => setMode('join')}
              className={`${theme.accent} px-4 py-2 rounded hover:opacity-90`}
            >
              Join Existing Session
            </button>
            <button
              onClick={onCancel}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'create' && (
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div>
            <label className="block mb-1">Session Name</label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className={`w-full p-2 rounded ${theme.input} ${theme.inputText}`}
              placeholder="Enter a name for your session"
              required
            />
          </div>

          <div>
            <label className="block mb-1">Your Character Name (optional)</label>
            <input
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              className={`w-full p-2 rounded ${theme.input} ${theme.inputText}`}
              placeholder="Enter your character name or GM"
            />
          </div>

          {error && <div className="text-red-500">{error}</div>}

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={isLoading}
              className={`${theme.accent} px-4 py-2 rounded hover:opacity-90 ${isLoading ? 'opacity-50' : ''}`}
            >
              {isLoading ? 'Creating...' : 'Create Session'}
            </button>
            <button
              type="button"
              onClick={() => setMode('select')}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {mode === 'join' && (
        <form onSubmit={handleJoinSession} className="space-y-4">
          <div>
            <label className="block mb-1">Session ID</label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className={`w-full p-2 rounded ${theme.input} ${theme.inputText}`}
              placeholder="Enter the session ID"
              required
            />
          </div>

          <div>
            <label className="block mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as SessionRole)}
              className={`w-full p-2 rounded ${theme.input} ${theme.inputText}`}
              required
            >
              <option value="player">Player</option>
              <option value="gm">Game Master</option>
              <option value="observer">Observer</option>
            </select>
          </div>

          <div>
            <label className="block mb-1">Character Name</label>
            <input
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              className={`w-full p-2 rounded ${theme.input} ${theme.inputText}`}
              placeholder={role === 'gm' ? 'GM' : 'Enter your character name'}
              required={role === 'player'}
            />
          </div>

          {error && <div className="text-red-500">{error}</div>}

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={isLoading}
              className={`${theme.accent} px-4 py-2 rounded hover:opacity-90 ${isLoading ? 'opacity-50' : ''}`}
            >
              {isLoading ? 'Joining...' : 'Join Session'}
            </button>
            <button
              type="button"
              onClick={() => setMode('select')}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
