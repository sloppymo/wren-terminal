/**
 * Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
 * Wren Terminal - Settings Component
 * This code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is strictly prohibited.
 */

import { useState, useEffect } from 'react';
import { themes, fontSizes, defaultPrompts, UserSettings, saveSettings, loadSettings } from '../utils/themes';

type TerminalSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (settings: UserSettings) => void;
  currentSettings: UserSettings;
};

export default function TerminalSettings({ isOpen, onClose, onApply, currentSettings }: TerminalSettingsProps) {
  const [settings, setSettings] = useState<UserSettings>(currentSettings);
  
  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings, isOpen]);
  
  const handleChange = (key: keyof UserSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const handleApply = () => {
    saveSettings(settings);
    onApply(settings);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className={`${themes[settings.theme].background} ${themes[settings.theme].text} p-6 rounded-lg shadow-lg max-w-md w-full`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Terminal Settings</h2>
          <button onClick={onClose} className="text-2xl">&times;</button>
        </div>
        
        <div className="space-y-4">
          {/* Theme Selection */}
          <div>
            <label className="block mb-1 font-medium">Theme</label>
            <select 
              value={settings.theme}
              onChange={(e) => handleChange('theme', e.target.value)}
              className={`w-full p-2 rounded ${themes[settings.theme].background} ${themes[settings.theme].text} border border-gray-600`}
            >
              {Object.values(themes).map(theme => (
                <option key={theme.id} value={theme.id}>{theme.name}</option>
              ))}
            </select>
          </div>
          
          {/* Font Size */}
          <div>
            <label className="block mb-1 font-medium">Font Size</label>
            <select 
              value={settings.fontSize}
              onChange={(e) => handleChange('fontSize', e.target.value)}
              className={`w-full p-2 rounded ${themes[settings.theme].background} ${themes[settings.theme].text} border border-gray-600`}
            >
              {fontSizes.map(size => (
                <option key={size.id} value={size.id}>{size.name}</option>
              ))}
            </select>
          </div>
          
          {/* Prompt Style */}
          <div>
            <label className="block mb-1 font-medium">Prompt Style</label>
            <select 
              value={settings.promptTemplate}
              onChange={(e) => handleChange('promptTemplate', e.target.value)}
              className={`w-full p-2 rounded ${themes[settings.theme].background} ${themes[settings.theme].text} border border-gray-600`}
            >
              {defaultPrompts.map(prompt => (
                <option key={prompt.id} value={prompt.id}>{prompt.template}</option>
              ))}
              <option value="custom">Custom...</option>
            </select>
          </div>
          
          {/* Custom Prompt */}
          {settings.promptTemplate === 'custom' && (
            <div>
              <label className="block mb-1 font-medium">Custom Prompt</label>
              <input 
                type="text"
                value={settings.customPrompt}
                onChange={(e) => handleChange('customPrompt', e.target.value)}
                placeholder="Use {user} for username"
                className={`w-full p-2 rounded ${themes[settings.theme].background} ${themes[settings.theme].text} border border-gray-600`}
              />
              <p className="text-xs mt-1 opacity-70">Use {'{user}'} to include the username</p>
            </div>
          )}
          
          {/* Preview */}
          <div className="mt-4 p-3 rounded border border-gray-600">
            <p className="text-sm font-medium mb-1">Preview:</p>
            <div className={`font-mono ${fontSizes.find(f => f.id === settings.fontSize)?.class || 'text-sm'}`}>
              <span className={themes[settings.theme].prompt}>
                {settings.promptTemplate === 'custom' 
                  ? settings.customPrompt.replace('{user}', 'preview') 
                  : defaultPrompts.find(p => p.id === settings.promptTemplate)?.template.replace('{user}', 'preview')}
              </span>
              <span className="ml-2">command</span>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-6 space-x-2">
          <button 
            onClick={onClose}
            className={`px-4 py-2 rounded ${themes[settings.theme].background} border border-gray-600 hover:bg-opacity-80`}
          >
            Cancel
          </button>
          <button 
            onClick={handleApply}
            className={`px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700`}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
