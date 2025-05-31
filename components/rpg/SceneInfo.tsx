/**
 * Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
 * Wren Terminal - Shadowrun RPG Scene Info Component
 * This code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is strictly prohibited.
 */

import React from 'react';
import { SceneInfo as SceneInfoType } from '../../utils/api';

interface SceneInfoProps {
  scene: SceneInfoType;
  theme: any;
  isGM: boolean;
}

export default function SceneInfoPanel({ scene, theme, isGM }: SceneInfoProps) {
  // Format the timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className={`${theme.secondaryBackground} ${theme.text} p-3 rounded shadow-inner text-sm`}>
      <h3 className="text-md font-bold mb-2 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Scene {scene.current_scene_number}
      </h3>
      
      <div className="space-y-1 mb-2">
        {scene.location && (
          <div>
            <span className={`${theme.accent} font-bold`}>Location:</span> {scene.location}
          </div>
        )}
        
        {isGM && scene.goal && (
          <div>
            <span className={`${theme.accent} font-bold`}>Goal:</span> {scene.goal}
          </div>
        )}
        
        {isGM && scene.opposition && (
          <div>
            <span className={`${theme.accent} font-bold`}>Opposition:</span> {scene.opposition}
          </div>
        )}
        
        {scene.magical_conditions && (
          <div>
            <span className={`${theme.accent} font-bold`}>Magical Conditions:</span> {scene.magical_conditions}
          </div>
        )}
      </div>
      
      <div className="text-xs opacity-70 mt-2">
        Last updated: {formatTimestamp(scene.last_updated)}
      </div>
    </div>
  );
}
