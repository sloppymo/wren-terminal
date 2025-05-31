/**
 * Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
 * Wren Terminal - Console Component
 * This code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is strictly prohibited.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { sendCommand, getStreamingResponse } from '../utils/api';
import TerminalSettings from './TerminalSettings';
import { themes, fontSizes, UserSettings, loadSettings, saveSettings, formatPrompt } from '../utils/themes';
import RpgController from './rpg/RpgController';

// Type for history items
interface HistoryItem {
  command: string;
  output: string;
  isProcessing?: boolean;
  isStreaming?: boolean;
}

// History item interface is already defined above

export default function WrenConsole() {
  const { user, isSignedIn } = useUser();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [prompt, setPrompt] = useState('> ');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  
  // RPG mode state
  const [isRpgMode, setIsRpgMode] = useState(false);
  
  // Settings state with defaults
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'shadowrunBarren',
    fontSize: 'base',
    promptTemplate: 'default',
    customPrompt: ''
  });

  // Load settings from localStorage on component mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem('wrenSettings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          setSettings(parsedSettings);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    
    loadSettings();
    
    // Update prompt with username if signed in
    updatePrompt(isSignedIn ? (user?.username || user?.firstName || 'user') : 'guest');
    
    // Add welcome message to history
    addToHistory('', 'Welcome to Wren Terminal. Type "help" for a list of commands.');
  }, [isSignedIn, user]);

  // Scroll to bottom of console when history changes
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = (newSettings: UserSettings) => {
    try {
      localStorage.setItem('wrenSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // Update prompt with username
  const updatePrompt = (username: string) => {
    setPrompt(`${username}> `);
  };

  // Add a command and its output to history
  const addToHistory = (command: string, output: string) => {
    setHistory(prev => [...prev, { command, output }]);
  };

  // Handle command execution
  const handleCommand = async (cmd: string) => {
    if (!cmd.trim()) return;
    
    const command = cmd.trim();
    
    // Check for special commands
    if (command.toLowerCase() === 'clear') {
      setHistory([]);
      return;
    }
    
    if (command.toLowerCase() === 'help') {
      addToHistory(cmd, `Available commands:
- clear: Clear the console
- help: Show this help message
- theme: Change the console theme
- fontsize: Change the font size
- ask: Ask a question to the AI assistant
- shadowrun: Enter Shadowrun RPG mode
- exit: Exit the current mode or application`);
      return;
    }
    
    if (command.toLowerCase() === 'shadowrun') {
      setIsRpgMode(true);
      addToHistory(cmd, 'Entering Shadowrun RPG mode...');
      return;
    }
    
    if (command.toLowerCase() === 'exit') {
      if (isRpgMode) {
        setIsRpgMode(false);
        addToHistory(cmd, 'Exiting Shadowrun RPG mode...');
      } else {
        addToHistory(cmd, 'No active mode to exit. Type "help" for available commands.');
      }
      return;
    }
    
    if (command.toLowerCase().startsWith('theme ')) {
      const themeName = command.toLowerCase().replace('theme ', '');
      const validTheme = Object.keys(themes).find(t => t === themeName);
      if (validTheme) {
        const newSettings = { ...settings, theme: validTheme };
        setSettings(newSettings);
        saveSettings(newSettings);
        addToHistory(cmd, `Theme changed to ${themes[validTheme].name}`);
      } else {
        addToHistory(cmd, `Theme not found. Available themes: ${Object.keys(themes).join(', ')}`);
      }
      return;
    }
    
    if (command.toLowerCase().startsWith('fontsize ')) {
      const size = command.toLowerCase().replace('fontsize ', '');
      const validSize = fontSizes.find(f => f.id === size);
      if (validSize) {
        const newSettings = { ...settings, fontSize: size };
        setSettings(newSettings);
        saveSettings(newSettings);
        addToHistory(cmd, `Font size changed to ${validSize.name}`);
      } else {
        addToHistory(cmd, `Font size not found. Available sizes: ${fontSizes.map(f => f.id).join(', ')}`);
      }
      return;
    }
    
    // For all other commands, process via the API
    addToHistory(cmd, '');
    setIsProcessing(true);
    
    try {
      // Show loading indicator in history
      const loadingIndex = history.length;
      setHistory(prev => [...prev, { command: '', output: 'Processing...', isProcessing: true }]);
      
      // Check if command is 'ask' to use streaming
      if (command.toLowerCase().startsWith('ask ')) {
        try {
          const question = command.substring(4); // Remove 'ask ' prefix
          const userId = isSignedIn ? user?.id : 'guest-user';
          
          // Update history to show we're starting streaming
          setHistory(prev => {
            const newHistory = [...prev];
            if (newHistory[loadingIndex]) {
              newHistory[loadingIndex] = { command: '', output: '', isProcessing: false, isStreaming: true };
            }
            return newHistory;
          });
          
          // Use our new streaming API utility
          getStreamingResponse(question, userId, {
            // Handle each token as it arrives
            onToken: (token) => {
              // Update the streaming response incrementally
              setHistory(prev => {
                const newHistory = [...prev];
                if (newHistory[loadingIndex]) {
                  // Get the current output and append the new token
                  const currentOutput = newHistory[loadingIndex].output || '';
                  newHistory[loadingIndex] = { 
                    command: '', 
                    output: currentOutput + token, 
                    isStreaming: true
                  };
                }
                return newHistory;
              });
            },
            
            // Handle stream completion
            onComplete: (fullResponse) => {
              // Update with the final response and remove streaming state
              setHistory(prev => {
                const newHistory = [...prev];
                if (newHistory[loadingIndex]) {
                  newHistory[loadingIndex] = { 
                    command: '', 
                    output: fullResponse,
                    isStreaming: false
                  };
                }
                return newHistory;
              });
            },
            
            // Handle any errors
            onError: (error) => {
              console.error('Streaming error:', error);
              // Show error in console
              setHistory(prev => {
                const newHistory = [...prev];
                if (newHistory[loadingIndex]) {
                  newHistory[loadingIndex] = { 
                    command: '', 
                    output: `Error: ${error.message || 'Failed to connect to streaming API. Please try again.'}`,
                    isStreaming: false 
                  };
                }
                return newHistory;
              });
            }
          });
          
          // Don't continue with regular API call
          return;
        } catch (streamError) {
          console.error('Stream setup error:', streamError);
          // Fall through to regular API call if streaming fails
        }
      }
      
      // For non-streaming or fallback from streaming failure
      const response = await sendCommand(command);
      
      // Remove loading indicator and add actual response
      setHistory(prev => {
        const newHistory = [...prev];
        if (newHistory[loadingIndex]) {
          newHistory[loadingIndex] = { command: '', output: response.output };
        }
        return newHistory;
      });
    } catch (error) {
      addToHistory('', `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCommand(input);
    setInput('');
  };

  // Handle applying settings changes
  const handleApplySettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    // Update prompt with current username
    updatePrompt(isSignedIn ? (user?.username || user?.firstName || 'user') : 'guest');
  };
  
  // Handle exiting RPG mode
  const handleExitRpgMode = () => {
    setIsRpgMode(false);
    addToHistory('exit', 'Exited Shadowrun RPG mode');
  };

  // Get current theme and font size
  const currentTheme = themes[settings.theme] || themes.dark;
  const currentFontSize = fontSizes.find(f => f.id === settings.fontSize)?.class || 'text-base';

  // Render RPG controller if in RPG mode
  if (isRpgMode) {
    // Convert our theme to a format compatible with RpgController
    const rpgTheme = {
      background: themes[settings.theme].background,
      text: themes[settings.theme].text,
      accent: themes[settings.theme].accent,
      secondaryText: themes[settings.theme].secondaryText,
      prompt: themes[settings.theme].prompt,
      selection: themes[settings.theme].selection || 'bg-gray-800'
    };
    
    return (
      <RpgController 
        theme={rpgTheme}
        onCommand={handleCommand}
        onExit={handleExitRpgMode}
      />
    );
  }

  // Regular terminal UI
  return (
    <>
      <div className={`${currentTheme.background} ${currentTheme.text} p-4 rounded-lg shadow-md h-[80vh] flex flex-col relative`}>
        {/* Settings button */}
        <button 
          onClick={() => setShowSettings(true)}
          className={`absolute top-2 right-2 p-2 rounded-full opacity-70 hover:opacity-100 ${currentTheme.accent} focus:outline-none`}
          title="Terminal Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>

        <div ref={consoleRef} className={`flex-1 overflow-auto font-mono ${currentFontSize}`}>
          {/* Display command history */}
          {history.map((item, index) => (
            <div key={index} className="mb-2">
              {item.command && (
                <div className="flex">
                  <span className={currentTheme.prompt}>{prompt}</span>
                  <span className="ml-2">{item.command}</span>
                </div>
              )}
              <div className={`whitespace-pre-wrap ${item.isProcessing ? 'animate-pulse' : ''}`}>
                {item.output}
              </div>
            </div>
          ))}
        </div>
        
        <form onSubmit={handleSubmit} className="flex mt-2">
          <span className={`font-mono ${currentTheme.prompt}`}>{prompt}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={`flex-1 bg-transparent border-none outline-none ml-2 font-mono ${currentTheme.text}`}
            autoFocus
          />
        </form>
      </div>

      {/* Settings modal */}
      <TerminalSettings 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onApply={handleApplySettings}
        currentSettings={settings}
      />
    </>
  );
}