import React from 'react';
import { Trash2, Target } from 'lucide-react';
import { Waypoint } from '../types/Waypoint';

// Define a more specific type for the config parts needed
interface WaypointEditorConfig {
  waypoint: {
    minRadius: number;
    maxRadius: number;
    defaultStopDuration: number;
  };
  robot: {
    maxVelocity: number;
  };
}

interface WaypointEditorPopupProps {
  waypoint: Waypoint; // Assumed to be non-null when this component is rendered
  waypointIndex: number;
  config: WaypointEditorConfig;
  onUpdateWaypoint: (index: number, field: keyof Waypoint, value: any) => void;
  onDeleteWaypoint: (index: number) => void;
  onClose: () => void;
  editorPosition: { x: number; y: number };
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void; // For drag initiation
}

const WaypointEditorPopup: React.FC<WaypointEditorPopupProps> = ({
  waypoint,
  waypointIndex,
  config,
  onUpdateWaypoint,
  onDeleteWaypoint,
  onClose,
  editorPosition,
  onDragStart,
}) => {
  
  // Helper to call onUpdateWaypoint with the current waypoint's index
  const updateCurrentWaypoint = (field: keyof Waypoint, value: any) => {
    onUpdateWaypoint(waypointIndex, field, value);
  };

  return (
    <div
      className="absolute bg-background-tertiary/80 rounded-xl shadow-lg p-5 backdrop-blur-md space-y-3 z-10 w-80"
      style={{ top: editorPosition.y, left: editorPosition.x }}
    >
      <div
        className="font-bold text-lg mb-4 flex items-center justify-between gap-2 text-accent-primary cursor-move"
        onMouseDown={onDragStart} // Attach drag start handler here
      >
        <div className="flex items-center gap-2">
          <Target size={20} />
          <span>Waypoint Editor</span>
        </div>
        <button
          onClick={onClose}
          title="Close Editor"
          className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-background-primary/50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {/* Waypoint Editor Form Content */}
      <div className="flex justify-between items-center">
        <span className="font-medium text-text-primary">Waypoint {waypointIndex + 1}</span>
        <button onClick={() => onDeleteWaypoint(waypointIndex)} title="Delete Waypoint" className="text-red-400 hover:text-error-color p-1 rounded-md hover:bg-background-primary/50 transform hover:scale-110">
          <Trash2 size={20} />
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-text-secondary">Position (m)</label>
        <div className="flex gap-2">
          <input type="number" step="0.1" value={waypoint.x.toFixed(2)} onChange={(e) => updateCurrentWaypoint('x', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none" />
          <input type="number" step="0.1" value={waypoint.y.toFixed(2)} onChange={(e) => updateCurrentWaypoint('y', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-text-secondary">Radius: {waypoint.radius.toFixed(2)}m</label>
        <input type="range" min={config.waypoint.minRadius} max={config.waypoint.maxRadius} step="0.1" value={waypoint.radius} onChange={(e) => updateCurrentWaypoint('radius', parseFloat(e.target.value))} className="w-full h-3 bg-background-primary rounded-lg appearance-none cursor-pointer accent-accent-primary" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-text-secondary">Target Velocity (m/s)</label>
        <input
          type="number" step="0.1"
          value={waypoint.targetVelocity !== undefined ? waypoint.targetVelocity.toFixed(1) : ''}
          onChange={(e) => updateCurrentWaypoint('targetVelocity', e.target.value ? parseFloat(e.target.value) : undefined)}
          className="w-full px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none"
          placeholder="Optional (e.g., 1.5)"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-text-secondary">Max Velocity Constraint (m/s)</label>
        <input
          type="number" step="0.1"
          value={waypoint.maxVelocityConstraint !== undefined ? waypoint.maxVelocityConstraint.toFixed(1) : ''}
          onChange={(e) => updateCurrentWaypoint('maxVelocityConstraint', e.target.value ? parseFloat(e.target.value) : undefined)}
          className="w-full px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none"
          placeholder={`Optional (e.g., ${config.robot.maxVelocity.toFixed(1)})`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-text-secondary">Target Heading (°)</label>
        <div className="flex gap-2">
          <input type="number" value={waypoint.heading !== undefined ? waypoint.heading : ''} onChange={(e) => updateCurrentWaypoint('heading', e.target.value ? parseFloat(e.target.value) : undefined)} className="flex-1 px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none" placeholder="Optional" min="-180" max="180" />
          <button onClick={() => updateCurrentWaypoint('heading', undefined)} className="px-3 py-1.5 bg-accent-secondary rounded-md text-sm hover:bg-accent-primary text-text-primary shadow-sm transform hover:scale-105"> Clear </button>
        </div>
      </div>
      <div>
        <label className="flex items-center justify-between text-sm font-medium text-text-secondary">
          <span>Stop at Waypoint</span>
          <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
            <input
              type="checkbox"
              checked={waypoint.stopAtWaypoint || false}
              onChange={(e) => {
                const checked = e.target.checked;
                updateCurrentWaypoint('stopAtWaypoint', checked);
                if (checked && waypoint.stopDuration === undefined) {
                  updateCurrentWaypoint('stopDuration', config.waypoint.defaultStopDuration);
                }
              }}
              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-border-color/50 checked:border-accent-primary checked:right-0 transition-all duration-200 ease-in-out peer"
              id={`stopAtWaypoint-${waypointIndex}`}
            />
            <label
              htmlFor={`stopAtWaypoint-${waypointIndex}`}
              className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer peer-checked:bg-accent-primary transition-all duration-200 ease-in-out"
            ></label>
          </div>
        </label>
      </div>

      {waypoint.stopAtWaypoint && (
        <div>
          <label className="block text-sm font-medium mb-1 text-text-secondary">Stop Duration (s)</label>
          <input
            type="number" step="0.1" min="0"
            value={waypoint.stopDuration !== undefined ? waypoint.stopDuration.toFixed(1) : config.waypoint.defaultStopDuration.toFixed(1)}
            onChange={(e) => updateCurrentWaypoint('stopDuration', e.target.value ? parseFloat(e.target.value) : config.waypoint.defaultStopDuration)}
            className="w-full px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none"
          />
        </div>
      )}
      <div>
        <label className="flex items-center justify-between text-sm font-medium text-text-secondary">
          <span>Is Guide Point</span>
           <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
            <input
              type="checkbox"
              checked={waypoint.isGuidePoint || false}
              onChange={(e) => updateCurrentWaypoint('isGuidePoint', e.target.checked)}
              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-border-color/50 checked:border-accent-primary checked:right-0 transition-all duration-200 ease-in-out peer"
              id={`isGuidePoint-${waypointIndex}`}
            />
            <label
              htmlFor={`isGuidePoint-${waypointIndex}`}
              className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer peer-checked:bg-accent-primary transition-all duration-200 ease-in-out"
            ></label>
          </div>
        </label>
        <p className="text-xs text-text-secondary mt-1">Path will try to pass near, not strictly through.</p>
      </div>

      {waypoint.isGuidePoint && (
        <div>
          <label className="block text-sm font-medium mb-1 text-text-secondary">Guide Influence: {waypoint.guideInfluence?.toFixed(2) ?? '0.50'}</label>
          <input
            type="range" min="0" max="1" step="0.01"
            value={waypoint.guideInfluence ?? 0.5}
            onChange={(e) => updateCurrentWaypoint('guideInfluence', parseFloat(e.target.value))}
            className="w-full h-3 bg-background-primary rounded-lg appearance-none cursor-pointer accent-accent-primary"
          />
        </div>
      )}
    </div>
  );
};

export default WaypointEditorPopup; 