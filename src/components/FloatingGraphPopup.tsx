import React, { useState } from 'react';
import { BarChart2, X, LineChart, AreaChart } from 'lucide-react';
import VelocityTimeChart from './charts/VelocityTimeChart';
import AccelerationTimeChart from './charts/AccelerationTimeChart';
import { TriggeredEvent } from '../types';

interface SimulationDataPoint {
  time: number;
  x: number; // Keep full data for potential future use, though charts only use specific fields
  y: number;
  velocity: number;
  acceleration: number;
  heading: number;
}

interface FloatingGraphPopupProps {
  history: SimulationDataPoint[];
  onClose: () => void;
  editorPosition: { x: number; y: number };
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
  isVisible: boolean;
  currentTime: number;
  triggeredEvents: TriggeredEvent[];
}

const FloatingGraphPopup: React.FC<FloatingGraphPopupProps> = ({
  history,
  onClose,
  editorPosition,
  onDragStart,
  isVisible,
  currentTime,
  triggeredEvents
}) => {
  const [showVelocityGraph, setShowVelocityGraph] = useState(true);
  const [showAccelerationGraph, setShowAccelerationGraph] = useState(true);

  if (!isVisible) {
    return null;
  }

  // Filter history for the specific charts to avoid passing unused data
  const velocityHistory = history.map(p => ({ time: p.time, velocity: p.velocity }));
  const accelerationHistory = history.map(p => ({ time: p.time, acceleration: p.acceleration }));

  return (
    <div
      className="absolute bg-background-tertiary/80 rounded-xl shadow-2xl p-5 backdrop-blur-md space-y-3 z-20 flex flex-col"
      style={{ top: editorPosition.y, left: editorPosition.x, width: '450px', maxHeight: '500px' }}
    >
      <div
        className="font-bold text-lg mb-2 flex items-center justify-between gap-2 text-accent-primary cursor-move"
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-2">
          <BarChart2 size={20} />
          <span>Simulation Graphs</span>
        </div>
        <button
          onClick={onClose}
          title="Close Graphs"
          className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-background-primary/50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div className="flex gap-4 mb-3 border-b border-border-color/30 pb-3">
        <label className="flex items-center text-sm font-medium text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={showVelocityGraph}
            onChange={() => setShowVelocityGraph(!showVelocityGraph)}
            className="mr-2 h-4 w-4 text-accent-primary rounded-sm focus:ring-accent-secondary bg-background-primary border-border-color/50"
          />
          Velocity vs. Time
        </label>
        <label className="flex items-center text-sm font-medium text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={showAccelerationGraph}
            onChange={() => setShowAccelerationGraph(!showAccelerationGraph)}
            className="mr-2 h-4 w-4 text-accent-primary rounded-sm focus:ring-accent-secondary bg-background-primary border-border-color/50"
          />
          Acceleration vs. Time
        </label>
      </div>

      <div className="flex-grow overflow-y-auto space-y-4 pr-1">
        {showVelocityGraph && (
          <div className="bg-background-primary/50 p-3 rounded-lg shadow-inner min-h-[200px]">
            <div className="relative h-[180px] sm:h-[200px]">
                <VelocityTimeChart history={velocityHistory} currentTime={currentTime} triggeredEvents={triggeredEvents} />
            </div>
          </div>
        )}
        {showAccelerationGraph && (
          <div className="bg-background-primary/50 p-3 rounded-lg shadow-inner min-h-[200px]">
             <div className="relative h-[180px] sm:h-[200px]">
                <AccelerationTimeChart history={accelerationHistory} currentTime={currentTime} triggeredEvents={triggeredEvents} />
            </div>
          </div>
        )}
        {!showVelocityGraph && !showAccelerationGraph && (
            <p className="text-center text-text-secondary py-10">Select a graph to display.</p>
        )}
      </div>
    </div>
  );
};

export default FloatingGraphPopup; 