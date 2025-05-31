/**
 * Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
 * Wren Terminal - Shadowrun RPG Controller
 * This code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is strictly prohibited.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  SessionRole,
  SessionInfo,
  Entity,
  SceneInfo as SceneInfoType,
  SceneLog as SceneLogType,
  getSessionInfo,
  sendRpgCommand,
  connectToRpgStream,
  getRpgStreamingResponse
} from '../../utils/api';
import SessionManager from './SessionManager';
import SceneInfoPanel from './SceneInfo';
import EntityList from './EntityList';
import SceneLog from './SceneLog';

interface RpgControllerProps {
  theme: any;
  onCommand: (command: string) => void;
  onExit: () => void;
}

export default function RpgController({ theme, onCommand, onExit }: RpgControllerProps) {
  const { user, isSignedIn } = useUser();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [role, setRole] = useState<SessionRole | null>(null);
  const [characterName, setCharacterName] = useState<string>('');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [logs, setLogs] = useState<SceneLogType[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [sceneInfo, setSceneInfo] = useState<SceneInfoType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [showSessionManager, setShowSessionManager] = useState(true);

  // Function to handle joining a session
  const handleSessionJoined = useCallback((
    newSessionId: string, 
    newRole: SessionRole, 
    newCharacterName?: string
  ) => {
    setSessionId(newSessionId);
    setRole(newRole);
    setCharacterName(newCharacterName || '');
    setShowSessionManager(false);
    
    // Store session info in localStorage for persistence
    localStorage.setItem('rpgSessionId', newSessionId);
    localStorage.setItem('rpgRole', newRole);
    localStorage.setItem('rpgCharacterName', newCharacterName || '');
  }, []);

  // Function to exit the current session
  const handleExitSession = useCallback(() => {
    setSessionId(null);
    setRole(null);
    setCharacterName('');
    setSessionInfo(null);
    setLogs([]);
    setEntities([]);
    setSceneInfo(null);
    
    // Clear stored session
    localStorage.removeItem('rpgSessionId');
    localStorage.removeItem('rpgRole');
    localStorage.removeItem('rpgCharacterName');
    
    // Show session manager
    setShowSessionManager(true);
    
    // Notify parent component
    onExit();
  }, [onExit]);

  // Check for existing session on mount
  useEffect(() => {
    const storedSessionId = localStorage.getItem('rpgSessionId');
    const storedRole = localStorage.getItem('rpgRole') as SessionRole;
    const storedCharacterName = localStorage.getItem('rpgCharacterName');
    
    if (storedSessionId && storedRole) {
      handleSessionJoined(storedSessionId, storedRole, storedCharacterName || undefined);
    }
  }, [handleSessionJoined]);

  // Fetch session info when joining a session
  useEffect(() => {
    if (!sessionId) return;
    
    const fetchSessionInfo = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const info = await getSessionInfo(sessionId);
        setSessionInfo(info);
        setLogs(info.logs);
        setEntities(info.entities);
        setSceneInfo(info.scene);
      } catch (err) {
        console.error('Failed to fetch session info:', err);
        setError('Failed to fetch session information. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSessionInfo();
  }, [sessionId]);

  // Connect to the SSE stream for real-time updates
  useEffect(() => {
    if (!sessionId || !user?.id) return;
    
    const userId = isSignedIn ? user.id : 'guest-user';
    
    // Connect to the stream
    const disconnect = connectToRpgStream(sessionId, userId, {
      onLog: (newLog) => {
        setLogs((prev) => [...prev, newLog]);
      },
      onEntityUpdate: (updatedEntity) => {
        setEntities((prev) => {
          // Replace if entity exists, otherwise add
          const exists = prev.some(e => e.entity_id === updatedEntity.entity_id);
          if (exists) {
            return prev.map(e => 
              e.entity_id === updatedEntity.entity_id ? updatedEntity : e
            );
          } else {
            return [...prev, updatedEntity];
          }
        });
      },
      onSceneUpdate: (updatedScene) => {
        setSceneInfo(updatedScene);
      },
      onError: (error) => {
        console.error('Stream error:', error);
        setError(`Stream connection error: ${error.message}`);
      }
    });
    
    // Cleanup: disconnect from the stream
    return () => {
      disconnect();
    };
  }, [sessionId, user?.id, isSignedIn]);

  // Handle sending commands
  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!commandInput.trim() || !sessionId || !user?.id) return;
    
    const command = commandInput.trim();
    setCommandInput('');
    
    const userId = isSignedIn ? user.id : 'guest-user';
    
    // Check if this is a slash command or text to process through AI
    const isSlashCommand = command.startsWith('/');
    
    if (isSlashCommand) {
      try {
        const result = await sendRpgCommand(sessionId, userId, command);
        
        // The backend will add the command to the log, so we don't need 
        // to update state here - the SSE stream will handle it
      } catch (err) {
        console.error('Command error:', err);
        setError(`Error executing command: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } else {
      // For non-slash commands, we'll use the streaming AI response
      setIsStreaming(true);
      setStreamingResponse('');
      
      // Use the streaming API for AI responses
      getRpgStreamingResponse(
        sessionId,
        userId,
        command,
        {
          onToken: (token) => {
            setStreamingResponse((prev) => prev + token);
          },
          onComplete: () => {
            setIsStreaming(false);
          },
          onError: (error) => {
            console.error('Streaming error:', error);
            setError(`Streaming error: ${error.message}`);
            setIsStreaming(false);
          }
        }
      );
    }
  };

  // If we're showing the session manager, render that
  if (showSessionManager) {
    return (
      <SessionManager 
        onSessionJoined={handleSessionJoined}
        onCancel={onExit}
        theme={theme}
      />
    );
  }

  // Get a boolean indicating if the user is a GM
  const isGM = role === 'gm';

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="bg-red-500 text-white p-2 mb-2 rounded">
          {error}
          <button 
            className="ml-2 underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-3 mb-3">
        <div className="md:w-1/3">
          {sceneInfo && <SceneInfoPanel scene={sceneInfo} theme={theme} isGM={isGM} />}
        </div>
        <div className="md:w-2/3">
          <EntityList entities={entities} theme={theme} isGM={isGM} />
        </div>
      </div>
      
      <div className="flex-grow overflow-hidden mb-3">
        <SceneLog logs={logs} theme={theme} isGM={isGM} />
      </div>
      
      {/* Command input */}
      <form onSubmit={handleSendCommand} className="flex items-center">
        <div className="flex-shrink-0 mr-2">
          <span className={`${theme.prompt} font-bold`}>{characterName || role || '>'}</span>
        </div>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          className={`flex-grow ${theme.input} ${theme.inputText} p-2 rounded`}
          placeholder={isGM ? "Enter GM command or /help..." : "Enter character action or /help..."}
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !commandInput.trim()}
          className={`ml-2 ${theme.accent} p-2 rounded ${(isStreaming || !commandInput.trim()) ? 'opacity-50' : ''}`}
        >
          {isStreaming ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={handleExitSession}
          className="ml-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded"
          title="Exit Session"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V7.414l-5-5H3zm7 9a1 1 0 01-1-1V8.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L7 8.414V11a1 1 0 001 1h4a1 1 0 000-2H8z" clipRule="evenodd" />
          </svg>
        </button>
      </form>
      
      {/* Help section with quick command reference */}
      <div className={`text-xs ${theme.secondaryText} mt-2`}>
        <span className="font-bold">Quick Commands:</span> 
        {isGM ? (
          <span> /scene, /roll, /summon, /echo, /mark, /meta, /recall, /pulse</span>
        ) : (
          <span> /roll, /echo, /meta, /recall</span>
        )}
      </div>
    </div>
  );
}
