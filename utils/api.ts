/**
 * Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
 * Wren Terminal - API Utilities
 * This code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is strictly prohibited.
 */

// API utilities for the Wren Console

/**
 * Send a command to the chat API
 * @param command The command text to process
 * @returns The API response
 */
export async function sendCommand(command: string): Promise<{ 
  output: string; 
  status: string; 
  timestamp: string;
}> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process command');
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    return {
      output: `Error: ${error instanceof Error ? error.message : 'Failed to connect to API'}`,
      status: 'error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get a streaming response from the API
 * @param prompt The prompt to send to the API
 * @param userId The user ID for context tracking
 * @param callbacks Callbacks for streaming events
 */
export function getStreamingResponse(
  prompt: string, 
  userId: string = 'guest', 
  callbacks: {
    onStart?: () => void;
    onToken?: (token: string) => void;
    onComplete?: (fullResponse: string) => void;
    onError?: (error: Error) => void;
  }
): () => void {
  // Get the backend URL from environment variable or use default
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const streamUrl = `${backendUrl}/stream?prompt=${encodeURIComponent(prompt)}&user_id=${encodeURIComponent(userId)}`;
  
  try {
    // Call onStart callback if provided
    if (callbacks.onStart) {
      callbacks.onStart();
    }
    
    // Create EventSource for streaming
    const eventSource = new EventSource(streamUrl);
    let fullResponse = '';
    
    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.status === 'streaming' && 'content' in data) {
          // Accumulate the full response
          fullResponse += data.content;
          
          // Call the token callback with the new token
          if (callbacks.onToken) {
            callbacks.onToken(data.content);
          }
        } else if (data.status === 'complete') {
          // Call the complete callback with the full response
          if (callbacks.onComplete) {
            callbacks.onComplete(fullResponse);
          }
          
          // Close the connection
          eventSource.close();
        } else if (data.status === 'error') {
          throw new Error(data.message || 'Unknown streaming error');
        }
      } catch (err) {
        console.error('Error processing stream data:', err);
        if (callbacks.onError && err instanceof Error) {
          callbacks.onError(err);
        }
        eventSource.close();
      }
    };
    
    // Handle errors
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      if (callbacks.onError) {
        callbacks.onError(new Error('Connection error with streaming API'));
      }
      eventSource.close();
    };
    
    // Return a function to cancel the stream
    return () => {
      eventSource.close();
    };
  } catch (error) {
    console.error('Error setting up stream:', error);
    if (callbacks.onError && error instanceof Error) {
      callbacks.onError(error);
    }
    // Return a no-op function since we couldn't set up the stream
    return () => {};
  }
}

/**
 * Check if the backend API is available
 * @returns Boolean indicating if the backend is reachable
 */
export async function checkBackendStatus(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Backend status check failed:', error);
    return false;
  }
}

// ===== Shadowrun RPG Session Management API =====

/**
 * Types for Shadowrun RPG session management
 */
export type SessionRole = 'gm' | 'player' | 'observer';

export interface SessionUser {
  user_id: string;
  character_name: string;
  role: SessionRole;
}

export interface SceneInfo {
  location: string;
  goal: string;
  opposition: string;
  magical_conditions: string;
  current_scene_number: number;
  last_updated: string;
}

export interface Entity {
  entity_id: string;
  name: string;
  type: string;
  status: string;
  description: string;
  created_by: string;
  last_updated: string;
}

export interface SceneLog {
  log_id: number;
  user_id: string;
  speaker: string;
  content: string;
  command_type: string;
  is_gm_override: boolean;
  timestamp: string;
}

export interface SessionInfo {
  session: {
    session_id: string;
    name: string;
    created_by: string;
    theme: string;
    is_active: boolean;
    created_at: string;
    last_active: string;
  };
  users: SessionUser[];
  scene: SceneInfo;
  entities: Entity[];
  logs: SceneLog[];
}

/**
 * Create a new Shadowrun RPG session
 * @param name The name of the session
 * @param userId The user ID of the creator
 * @param theme The theme to use for the session
 * @returns The session ID and other info
 */
export async function createRpgSession(
  name: string,
  userId: string,
  theme: string = 'shadowrunBarren'
): Promise<{ session_id: string; name: string; message: string }> {
  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, user_id: userId, theme }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create session');
    }

    return await response.json();
  } catch (error) {
    console.error('Create session failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to create session');
  }
}

/**
 * Join an existing Shadowrun RPG session
 * @param sessionId The session ID to join
 * @param userId The user ID of the joiner
 * @param role The role to join as (gm, player, observer)
 * @param characterName Optional character name
 * @returns Status and session info
 */
export async function joinRpgSession(
  sessionId: string,
  userId: string,
  role: SessionRole = 'player',
  characterName?: string
): Promise<{ success: boolean; session_id: string; role: SessionRole }> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, role, character_name: characterName }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to join session');
    }

    return await response.json();
  } catch (error) {
    console.error('Join session failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to join session');
  }
}

/**
 * Get information about an RPG session
 * @param sessionId The session ID to get info for
 * @returns Full session info including users, scene, entities, and logs
 */
export async function getSessionInfo(sessionId: string): Promise<SessionInfo> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get session info');
    }

    return await response.json();
  } catch (error) {
    console.error('Get session info failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to get session info');
  }
}

/**
 * Send an RPG command to the server
 * @param sessionId The session ID
 * @param userId The user ID
 * @param command The command text (including slash commands)
 * @param streaming Whether to use streaming for AI responses
 * @returns The command result
 */
export async function sendRpgCommand(
  sessionId: string,
  userId: string,
  command: string,
  streaming: boolean = false
): Promise<any> {
  if (streaming && !command.startsWith('/')) {
    // For streaming AI responses, we'll handle differently
    return null; // This will be handled by the streaming function
  }
  
  try {
    const response = await fetch('/api/rpg/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id: sessionId, user_id: userId, command, streaming }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process RPG command');
    }

    return await response.json();
  } catch (error) {
    console.error('RPG command failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to process RPG command');
  }
}

/**
 * Connect to the RPG event stream for real-time updates
 * @param sessionId The session ID to stream events for
 * @param userId The user ID
 * @param callbacks Callbacks for different event types
 */
export function connectToRpgStream(
  sessionId: string,
  userId: string,
  callbacks: {
    onLog?: (log: SceneLog) => void;
    onEntityUpdate?: (entity: Entity) => void;
    onSceneUpdate?: (scene: SceneInfo) => void;
    onError?: (error: Error) => void;
  }
): () => void {
  try {
    // Get the backend URL from environment variable or use default
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const streamUrl = `${backendUrl}/api/rpg/stream/${sessionId}?user_id=${encodeURIComponent(userId)}`;
    
    // Create EventSource for streaming
    const eventSource = new EventSource(streamUrl);
    
    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.status === 'log' && callbacks.onLog && data.entry) {
          callbacks.onLog(data.entry);
        } else if (data.status === 'entity_update' && callbacks.onEntityUpdate && data.entity) {
          callbacks.onEntityUpdate(data.entity);
        } else if (data.status === 'scene_update' && callbacks.onSceneUpdate && data.scene) {
          callbacks.onSceneUpdate(data.scene);
        } else if (data.status === 'error') {
          throw new Error(data.message || 'Unknown streaming error');
        }
        // Ignore heartbeat events
      } catch (err) {
        console.error('Error processing RPG stream data:', err);
        if (callbacks.onError && err instanceof Error) {
          callbacks.onError(err);
        }
      }
    };
    
    // Handle errors
    eventSource.onerror = (error) => {
      console.error('RPG EventSource error:', error);
      if (callbacks.onError) {
        callbacks.onError(new Error('Connection error with RPG stream'));
      }
      // Don't close on error - the browser will attempt to reconnect
    };
    
    // Return a function to close the connection
    return () => {
      eventSource.close();
    };
  } catch (error) {
    console.error('Error setting up RPG stream:', error);
    if (callbacks.onError && error instanceof Error) {
      callbacks.onError(error);
    }
    // Return a no-op function since we couldn't set up the stream
    return () => {};
  }
}

/**
 * Get a streaming RPG response from the AI
 * @param sessionId The session ID
 * @param userId The user ID
 * @param prompt The prompt to send to the AI
 * @param callbacks Callbacks for streaming events
 */
export function getRpgStreamingResponse(
  sessionId: string,
  userId: string,
  prompt: string,
  callbacks: {
    onStart?: () => void;
    onToken?: (token: string) => void;
    onComplete?: (fullResponse: string) => void;
    onError?: (error: Error) => void;
  }
): () => void {
  // Get the backend URL from environment variable or use default
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const streamUrl = `${backendUrl}/api/rpg/command`;
  
  try {
    // Call onStart callback if provided
    if (callbacks.onStart) {
      callbacks.onStart();
    }
    
    // Make a POST request to start streaming
    fetch(streamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        session_id: sessionId, 
        user_id: userId, 
        command: prompt, 
        streaming: true 
      }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to initialize RPG streaming');
      }
      
      // Set up EventSource for server-sent events
      const eventSource = new EventSource(`${backendUrl}/api/rpg/stream/${sessionId}?user_id=${encodeURIComponent(userId)}`);
      let fullResponse = '';
      
      // Handle incoming messages
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // We're only interested in AI responses here
          if (data.status === 'log' && data.entry && data.entry.command_type === 'ai') {
            const token = data.entry.content;
            fullResponse += token;
            
            // Call the token callback
            if (callbacks.onToken) {
              callbacks.onToken(token);
            }
          } else if (data.status === 'complete') {
            // Stream is complete
            if (callbacks.onComplete) {
              callbacks.onComplete(fullResponse);
            }
            eventSource.close();
          }
        } catch (err) {
          console.error('Error processing RPG stream data:', err);
          if (callbacks.onError && err instanceof Error) {
            callbacks.onError(err);
          }
          eventSource.close();
        }
      };
      
      // Handle errors
      eventSource.onerror = (error) => {
        console.error('RPG EventSource error:', error);
        if (callbacks.onError) {
          callbacks.onError(new Error('Connection error with RPG stream'));
        }
        eventSource.close();
      };
      
      // Return a function to close the connection
      return () => {
        eventSource.close();
      };
    })
    .catch(error => {
      console.error('Error setting up RPG streaming:', error);
      if (callbacks.onError) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
    });
    
    // Return a function to cancel the request (not fully implemented)
    return () => {
      console.log('Canceling RPG streaming request');
    };
  } catch (error) {
    console.error('Error setting up RPG streaming:', error);
    if (callbacks.onError && error instanceof Error) {
      callbacks.onError(error);
    }
    // Return a no-op function
    return () => {};
  }
}
