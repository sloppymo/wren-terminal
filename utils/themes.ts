/**
 * Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
 * Wren Terminal - Theme Configuration
 * This code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is strictly prohibited.
 */

export type Theme = {
  id: string;
  name: string;
  background: string;
  text: string;
  accent: string;
  prompt: string;
  cursor: string;
  secondaryText: string;
  streaming: string;
  selection: string;
};

export const themes: Record<string, Theme> = {
  shadowrunBarren: {
    id: 'shadowrunBarren',
    name: 'Shadowrun Barren',
    background: 'bg-gray-900',
    text: 'text-gray-300',
    accent: 'text-red-500',
    prompt: 'text-green-500',
    cursor: 'border-green-500',
    secondaryText: 'text-gray-400',
    streaming: 'text-green-400',
    selection: 'bg-gray-800/50'
  },
  classic: {
    id: 'classic',
    name: 'Classic Terminal',
    background: 'bg-black',
    text: 'text-green-400',
    accent: 'text-green-600',
    prompt: 'text-green-500',
    cursor: 'border-green-400',
    secondaryText: 'text-green-300',
    streaming: 'text-lime-400',
    selection: 'bg-green-900/50'
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Blue',
    background: 'bg-slate-900',
    text: 'text-blue-300',
    accent: 'text-blue-500',
    prompt: 'text-blue-400',
    cursor: 'border-blue-400',
    secondaryText: 'text-blue-200',
    streaming: 'text-cyan-300',
    selection: 'bg-blue-900/50'
  },
  forest: {
    id: 'forest',
    name: 'Forest Within',
    background: 'bg-emerald-950',
    text: 'text-emerald-300',
    accent: 'text-emerald-500',
    prompt: 'text-emerald-400',
    cursor: 'border-emerald-400',
    secondaryText: 'text-emerald-200',
    streaming: 'text-teal-300',
    selection: 'bg-emerald-900/50'
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    background: 'bg-gray-900',
    text: 'text-amber-300',
    accent: 'text-orange-500',
    prompt: 'text-amber-400',
    cursor: 'border-amber-400',
    secondaryText: 'text-amber-200',
    streaming: 'text-orange-300',
    selection: 'bg-amber-900/50'
  },
  light: {
    id: 'light',
    name: 'Light Mode',
    background: 'bg-gray-100',
    text: 'text-gray-800',
    accent: 'text-indigo-600',
    prompt: 'text-indigo-700',
    cursor: 'border-gray-800',
    secondaryText: 'text-gray-600',
    streaming: 'text-indigo-500',
    selection: 'bg-gray-300'
  }
};

export const fontSizes = [
  { id: 'xs', name: 'Extra Small', class: 'text-xs' },
  { id: 'sm', name: 'Small', class: 'text-sm' },
  { id: 'md', name: 'Medium', class: 'text-base' },
  { id: 'lg', name: 'Large', class: 'text-lg' },
  { id: 'xl', name: 'Extra Large', class: 'text-xl' }
];

export const defaultPrompts = [
  { id: 'default', template: '{user}@wren:~$' },
  { id: 'therapy', template: '[Therapy] {user}>' },
  { id: 'minimal', template: '>' },
  { id: 'friendly', template: 'Wren ({user}) 🌿' },
  { id: 'forest', template: '🌲 Forest Within: ' }
];

export type UserSettings = {
  theme: string;
  fontSize: string;
  promptTemplate: string;
  customPrompt: string;
};

export const defaultSettings: UserSettings = {
  theme: 'classic',
  fontSize: 'sm',
  promptTemplate: 'default',
  customPrompt: ''
};

// Save settings to localStorage
export const saveSettings = (settings: UserSettings): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('wren_settings', JSON.stringify(settings));
  }
};

// Load settings from localStorage
export const loadSettings = (): UserSettings => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('wren_settings');
    if (saved) {
      try {
        return JSON.parse(saved) as UserSettings;
      } catch (e) {
        console.error('Failed to parse saved settings', e);
      }
    }
  }
  return defaultSettings;
};

// Format prompt with user info
export const formatPrompt = (template: string, username: string): string => {
  return template.replace('{user}', username || 'guest');
};
