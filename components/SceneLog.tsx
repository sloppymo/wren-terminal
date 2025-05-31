/**
 * Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
 * Wren Terminal - Scene Log Component
 * This code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is strictly prohibited.
 */

import React from 'react';
import { Theme } from '../utils/themes';

interface SceneLogProps {
  history: {
    command: string;
    output: string;
    isProcessing?: boolean;
    isStreaming?: boolean;
  }[];
  theme?: any;
};

const SceneLog: React.FC<SceneLogProps> = ({ history, theme }) => {
  return (
    <div>
      {history.map((entry, i) => (
        <div key={i} className="mb-2">
          {entry.command && (
            <div className="flex">
              <span className={theme ? theme.prompt : 'text-blue-400'}>guest@wren:~$</span>
              <span className="ml-2">{entry.command}</span>
            </div>
          )}
          <div className="whitespace-pre-wrap">
            {entry.isProcessing ? (
              <span className="animate-pulse">{entry.output || 'Processing...'}</span>
            ) : entry.isStreaming ? (
              <span className={`${theme ? theme.streaming : 'text-green-400'}`}>{entry.output}</span>
            ) : (
              entry.output
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SceneLog;