import React from 'react';
import { GlobeAltIcon } from '@heroicons/react/24/outline';
import { GlobeAltIcon as GlobeAltIconSolid } from '@heroicons/react/24/solid';

const WebSearchToggle = ({ enabled, onChange, disabled = false }) => {
  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => onChange(!enabled)}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
          ${enabled 
            ? 'bg-indigo-600' 
            : 'bg-gray-200'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        title={enabled ? 'Web search enabled' : 'Web search disabled'}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
            ${enabled ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>

      <div className="flex items-center space-x-1">
        {enabled ? (
          <GlobeAltIconSolid className="w-4 h-4 text-indigo-600" />
        ) : (
          <GlobeAltIcon className="w-4 h-4 text-gray-400" />
        )}
        <span className={`text-xs font-medium ${enabled ? 'text-indigo-700' : 'text-gray-500'}`}>
          Web Search
        </span>
      </div>
    </div>
  );
};

export default WebSearchToggle;
