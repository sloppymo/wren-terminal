/**
 * Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
 * Wren Terminal - Shadowrun RPG Entity List Component
 * This code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is strictly prohibited.
 */

import React, { useState } from 'react';
import { Entity } from '../../utils/api';

interface EntityListProps {
  entities: Entity[];
  theme: any;
  isGM: boolean;
}

export default function EntityList({ entities, theme, isGM }: EntityListProps) {
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  // Group entities by type
  const groupedEntities = entities.reduce((groups, entity) => {
    const { type } = entity;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(entity);
    return groups;
  }, {} as Record<string, Entity[]>);

  // Typical entity types in Shadowrun
  const entityTypes = [
    'character', 'npc', 'spirit', 'sprite', 'drone', 'vehicle', 'critter', 'device', 'other'
  ];

  // Sort groups by the predefined order, with any other types at the end
  const sortedTypes = Object.keys(groupedEntities).sort((a, b) => {
    const indexA = entityTypes.indexOf(a);
    const indexB = entityTypes.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Format the timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const toggleExpand = (entityId: string) => {
    if (expandedEntity === entityId) {
      setExpandedEntity(null);
    } else {
      setExpandedEntity(entityId);
    }
  };

  // Get appropriate icon for entity type
  const getEntityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'character':
      case 'npc':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'spirit':
      case 'sprite':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      case 'drone':
      case 'device':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        );
      case 'vehicle':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      case 'critter':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.953-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4m9-1.5a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className={`${theme.secondaryBackground} ${theme.text} p-3 rounded shadow-inner text-sm`}>
      <h3 className="text-md font-bold mb-2 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Active Entities ({entities.length})
      </h3>

      {entities.length === 0 ? (
        <div className="italic text-gray-500">No active entities in the scene</div>
      ) : (
        <div className="space-y-3">
          {sortedTypes.map(type => (
            <div key={type} className="mb-2">
              <h4 className={`${theme.accent} font-semibold text-xs uppercase mb-1`}>
                {type} ({groupedEntities[type].length})
              </h4>
              <ul className="space-y-1">
                {groupedEntities[type].map(entity => (
                  <li 
                    key={entity.entity_id} 
                    className={`rounded ${expandedEntity === entity.entity_id ? 'bg-opacity-30 bg-gray-700' : ''} transition-colors duration-150`}
                  >
                    <div 
                      className="flex items-center justify-between cursor-pointer p-1 hover:bg-gray-700 hover:bg-opacity-30 rounded"
                      onClick={() => toggleExpand(entity.entity_id)}
                    >
                      <div className="flex items-center">
                        <span className="mr-1">{getEntityIcon(entity.type)}</span>
                        <span className="font-medium">{entity.name}</span>
                      </div>
                      <div className="flex items-center">
                        <span 
                          className={`px-1.5 py-0.5 text-xs rounded-full ${
                            entity.status === 'active' ? 'bg-green-500' : 
                            entity.status === 'damaged' ? 'bg-yellow-500' : 
                            entity.status === 'critical' ? 'bg-red-500' : 
                            'bg-gray-500'
                          } text-white mr-1`}
                        >
                          {entity.status}
                        </span>
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className={`h-4 w-4 transition-transform ${expandedEntity === entity.entity_id ? 'transform rotate-180' : ''}`} 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    
                    {expandedEntity === entity.entity_id && (
                      <div className="p-2 text-xs border-t border-gray-700">
                        <div className="mb-1">{entity.description}</div>
                        {isGM && (
                          <div className="text-gray-400 mt-1 text-xs">
                            Created by: {entity.created_by}<br />
                            Last updated: {formatTimestamp(entity.last_updated)}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
