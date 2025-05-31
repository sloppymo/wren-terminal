/**
 * Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
 * Wren Terminal - Shadowrun RPG Scene Log Component
 * This code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is strictly prohibited.
 */

import React, { useRef, useEffect } from 'react';
import { SceneLog as SceneLogType } from '../../utils/api';
import ReactMarkdown from 'react-markdown';

interface SceneLogProps {
  logs: SceneLogType[];
  theme: any;
  isGM: boolean;
}

export default function SceneLog({ logs, theme, isGM }: SceneLogProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Format the timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return timeString;
    } catch {
      return '';
    }
  };

  // Get appropriate style based on command type
  const getLogStyle = (log: SceneLogType) => {
    const baseStyle = `my-1 pl-2 border-l-2 `;

    switch (log.command_type) {
      case 'scene':
        return `${baseStyle} border-purple-500 italic`;
      case 'roll':
        return `${baseStyle} border-blue-400`;
      case 'summon':
        return `${baseStyle} border-green-500`;
      case 'echo':
        return `${baseStyle} border-yellow-400`;
      case 'ai':
        return `${baseStyle} border-cyan-400`;
      case 'mark':
        return `${baseStyle} border-red-500 font-bold`;
      case 'meta':
        return `${baseStyle} border-gray-500 text-gray-400 italic`;
      default:
        return baseStyle;
    }
  };

  // Get appropriate icon for command type
  const getCommandIcon = (commandType: string) => {
    switch (commandType) {
      case 'scene':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        );
      case 'roll':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      case 'summon':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        );
      case 'echo':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        );
      case 'ai':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'mark':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`${theme.secondaryBackground} ${theme.text} p-3 rounded shadow-inner h-full overflow-y-auto`}>
      <h3 className="text-md font-bold mb-2 sticky top-0 bg-inherit flex items-center z-10">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        Scene Log
      </h3>

      {logs.length === 0 ? (
        <div className="italic text-gray-500">No logs yet. Start the scene!</div>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.log_id} className={getLogStyle(log)}>
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-1 mt-1">
                  {getCommandIcon(log.command_type)}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center text-xs text-gray-400 mb-0.5">
                    <span className="font-semibold">{log.speaker}</span>
                    <span className="mx-1">•</span>
                    <span>{formatTimestamp(log.timestamp)}</span>
                    {log.is_gm_override && (
                      <span className="ml-1 px-1 py-0.5 bg-red-500 text-white text-xs rounded">GM</span>
                    )}
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{log.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
