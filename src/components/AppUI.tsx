import React from 'react';
import {
  Download, Upload, Settings, Play, RotateCcw, Trash2, Image, Zap, Target, Square, BarChart2, GripVertical, Ruler
} from 'lucide-react';
import { Waypoint, Point, SimulationDataPoint, RobotState, OptimizedPathPoint } from '../types';
import { Config } from '../config/appConfig';
import WaypointEditorPopup from './WaypointEditorPopup';
import FloatingGraphPopup from './FloatingGraphPopup';
import ConfigInput from './ConfigInput'; // Assuming ConfigInput is also a shared component

// Props definition for AppUI
export interface AppUIProps {
  pathName: string;
  setPathName: (name: string) => void;
  waypoints: Waypoint[];
  optimizationMetrics: { totalDistance: number; totalTime: number; /* ... other metrics */ } | null;
  waypointCreationMode: 'hard' | 'guide';
  setWaypointCreationMode: (mode: 'hard' | 'guide') => void;
  isMeasuring: boolean;
  toggleMeasureMode: () => void;
  showFloatingGraphs: boolean;
  setShowFloatingGraphs: (show: boolean) => void;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  exportPath: () => void;
  isPlaying: boolean;
  stopPath: () => void;
  playPath: () => void;
  optimizedPath: OptimizedPathPoint[];
  simulationSpeedFactor: number;
  setSimulationSpeedFactor: (factor: number | ((prev: number) => number)) => void;
  clearPath: () => void;
  showConfig: boolean;
  setShowConfig: (show: boolean) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  handleCanvasMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseLeave: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  displayTime: number;
  totalPathTime: number;
  handleTimeSliderChange: (newTime: number) => void;
  setIsScrubbing: (scrubbing: boolean) => void;
  handleTimeSliderMouseUp: () => void;
  loadBackgroundImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importPath: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedWaypoint: number | null;
  setSelectedWaypoint: (index: number | null) => void;
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
  updateWaypointByIndex: (index: number, field: keyof Waypoint, value: any) => void;
  deleteWaypoint: (index: number) => void;
  editorPosition: { x: number; y: number };
  handleEditorMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  simulationHistory: SimulationDataPoint[];
  floatingGraphPosition: { x: number; y: number };
  handleFloatingGraphMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  message: { type: 'error' | 'info'; text: string } | null;
  handleWaypointDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  handleWaypointDragOver: (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => void;
  handleWaypointDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleWaypointDrop: (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => void;
  handleWaypointDragEnd: () => void;
  draggedWaypointSourceIndex: number | null;
  // Add any other props that are used directly by the JSX being moved
}

const AppUI: React.FC<AppUIProps> = (props) => {
  const {
    pathName, setPathName, waypoints, optimizationMetrics, waypointCreationMode, setWaypointCreationMode,
    isMeasuring, toggleMeasureMode, showFloatingGraphs, setShowFloatingGraphs, imageInputRef, fileInputRef,
    exportPath, isPlaying, stopPath, playPath, optimizedPath, simulationSpeedFactor, setSimulationSpeedFactor,
    clearPath, showConfig, setShowConfig, canvasRef, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp,
    handleCanvasMouseLeave, displayTime, totalPathTime, handleTimeSliderChange, setIsScrubbing, handleTimeSliderMouseUp,
    loadBackgroundImage, importPath, selectedWaypoint, setSelectedWaypoint, config, setConfig, updateWaypointByIndex,
    deleteWaypoint, editorPosition, handleEditorMouseDown, simulationHistory, floatingGraphPosition, 
    handleFloatingGraphMouseDown, message, handleWaypointDragStart, handleWaypointDragOver, handleWaypointDragLeave,
    handleWaypointDrop, handleWaypointDragEnd, draggedWaypointSourceIndex
  } = props;

  return (
    <div className="w-full h-screen bg-background-primary flex text-text-primary font-sans overflow-hidden relative">
      {/* Main Canvas Area */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="bg-gradient-background rounded-xl shadow-2xl p-1 h-full flex flex-col from-background-secondary to-background-tertiary">
          {/* Header Section */}
          <div className="flex justify-between items-center mb-4 p-4 bg-background-secondary/50 rounded-t-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 min-w-0">
              <input
                type="text"
                value={pathName}
                onChange={(e) => setPathName(e.target.value)}
                className="text-3xl font-accent bg-transparent border-none outline-none text-text-primary focus:ring-0 max-w-[16rem]"
              />
              <div className="bg-background-tertiary/70 px-3 py-1 rounded-full shadow-sm flex items-center text-sm text-text-secondary">
                <Target size={14} className="mr-2 text-accent-primary" />
                <span>{waypoints.length}</span>
                <span className="ml-1">{waypoints.length === 1 ? 'Waypoint' : 'Waypoints'}</span>
              </div>
              {optimizationMetrics && (
                <div className="bg-background-tertiary/70 px-3 py-1 rounded-full shadow-sm flex items-center text-sm text-text-secondary">
                  <Zap size={14} className="mr-2 text-accent-secondary" />
                  <span>{optimizationMetrics.totalDistance.toFixed(2)}m</span>
                  <span className="mx-1">•</span>
                  <span>{optimizationMetrics.totalTime.toFixed(2)}s</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <div className="flex shadow-md rounded-lg">
                  <button
                    onClick={() => setWaypointCreationMode('hard')}
                    title="Add Hard Waypoint"
                    className={`p-2 px-3 transform transition-colors duration-150 ease-in-out 
                                ${waypointCreationMode === 'hard' 
                                  ? 'bg-accent-primary text-white rounded-l-lg' 
                                  : 'bg-background-tertiary text-text-secondary hover:bg-background-primary rounded-l-lg'}`}
                  >
                    Waypoint
                  </button>
                  <button
                    onClick={() => setWaypointCreationMode('guide')}
                    title="Add Guide Point"
                    className={`p-2 px-3 transform transition-colors duration-150 ease-in-out border-l border-background-primary/50 
                                ${waypointCreationMode === 'guide' 
                                  ? 'bg-accent-primary text-white rounded-r-lg' 
                                  : 'bg-background-tertiary text-text-secondary hover:bg-background-primary rounded-r-lg'}`}
                  >
                    GuidePoint
                  </button>
                </div>

                <button
                  onClick={toggleMeasureMode}
                  title={isMeasuring ? "Disable Measure Tool" : "Enable Measure Tool"}
                  className={`p-2 rounded-lg hover:text-white transform hover:scale-105 shadow-md ${isMeasuring ? 'bg-accent-secondary text-white' : 'bg-background-tertiary text-text-secondary hover:bg-accent-primary'}`}
                >
                  <Ruler size={20} />
                </button>
                <button
                  onClick={() => setShowFloatingGraphs(true)}
                  title="Show Simulation Graphs"
                  className="p-2 bg-background-tertiary text-text-secondary rounded-lg hover:bg-accent-primary hover:text-white transform hover:scale-105 shadow-md"
                >
                  <BarChart2 size={20} />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  title="Load Background Image"
                  className="p-2 bg-background-tertiary text-text-secondary rounded-lg hover:bg-accent-primary hover:text-white transform hover:scale-105 shadow-md"
                >
                  <Image size={20} />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Import Path"
                  className="p-2 bg-background-tertiary text-text-secondary rounded-lg hover:bg-accent-primary hover:text-white transform hover:scale-105 shadow-md"
                >
                  <Upload size={20} />
                </button>
                <button
                  onClick={exportPath}
                  title="Export Path"
                  className="p-2 bg-background-tertiary text-text-secondary rounded-lg hover:bg-accent-primary hover:text-white transform hover:scale-105 shadow-md"
                >
                  <Download size={20} />
                </button>
                <button
                  onClick={isPlaying ? stopPath : playPath}
                  title={isPlaying ? 'Stop Simulation' : 'Simulate Path'}
                  className={`p-2 rounded-lg transform hover:scale-105 shadow-md ${isPlaying ? 'bg-error-color text-white hover:bg-red-700' : 'bg-accent-primary text-white hover:bg-accent-secondary'}`}
                  disabled={optimizedPath.length < 2 && !isPlaying}
                >
                  {isPlaying ? <Square size={20} /> : <Play size={20} />}
                </button>
                <button
                  onClick={() => {
                    setSimulationSpeedFactor(prev => {
                      if (prev === 1) return 2;
                      if (prev === 2) return 4;
                      return 1;
                    });
                  }}
                  title={`Set Simulation Speed (${simulationSpeedFactor}x)`}
                  className="p-2 bg-background-tertiary text-text-secondary rounded-lg hover:bg-accent-primary hover:text-white transform hover:scale-105 shadow-md w-16 text-center"
                >
                  {simulationSpeedFactor}x
                </button>
                <button
                  onClick={clearPath}
                  title="Clear Path"
                  className="p-2 bg-background-tertiary text-text-secondary rounded-lg hover:bg-error-color hover:text-white transform hover:scale-105 shadow-md"
                >
                  <RotateCcw size={20} />
                </button>
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  title="Toggle Configuration Panel"
                  className={`p-2 rounded-lg transform hover:scale-105 shadow-md ${showConfig ? 'bg-accent-primary text-white' : 'bg-background-tertiary text-text-secondary hover:bg-accent-secondary hover:text-white'}`}
                >
                  <Settings size={20} />
                </button>
              </div>
            </div>
          </div>
          {/* Canvas Container and Slider will go here */}
           {/* Canvas Container */}
          <div className="bg-background-primary/70 rounded-lg m-4 p-2 flex-grow flex items-center justify-center relative overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseLeave}
              className="border-2 border-border-color rounded-md cursor-crosshair object-contain"
            />
          </div>

          {/* Simulation Time Slider */}
          {optimizedPath.length > 0 && (
            <div className="m-4 p-3 bg-background-secondary/50 rounded-lg shadow-md flex items-center gap-3">
              <span className="text-sm text-text-secondary min-w-[90px]">Time: {displayTime.toFixed(2)}s / {totalPathTime.toFixed(2)}s</span>
              <input
                type="range"
                min={0}
                max={totalPathTime}
                step={0.01}
                value={displayTime}
                onChange={(e) => handleTimeSliderChange(parseFloat(e.target.value))}
                onMouseDown={() => setIsScrubbing(true)}
                onMouseUp={handleTimeSliderMouseUp}
                className="w-full h-3 bg-background-primary rounded-lg appearance-none cursor-pointer accent-accent-primary"
              />
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={loadBackgroundImage} 
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={importPath}
            className="hidden"
          />
        </div>
      </div>
      
      {/* Floating Waypoint Editor */}
      {selectedWaypoint !== null && waypoints[selectedWaypoint] && (
        <WaypointEditorPopup
          waypoint={waypoints[selectedWaypoint]}
          waypointIndex={selectedWaypoint}
          config={{
            waypoint: config.waypoint,
            robot: config.robot
          }}
          onUpdateWaypoint={updateWaypointByIndex}
          onDeleteWaypoint={deleteWaypoint}
          onClose={() => setSelectedWaypoint(null)}
          editorPosition={editorPosition}
          onDragStart={handleEditorMouseDown}
        />
      )}
      
      {/* Floating Graph Popup */}
      <FloatingGraphPopup
          history={simulationHistory}
          onClose={() => setShowFloatingGraphs(false)}
          editorPosition={floatingGraphPosition}
          onDragStart={handleFloatingGraphMouseDown}
          isVisible={showFloatingGraphs}
          currentTime={displayTime}
      />

      {/* Sidebar */}
      {showConfig && (
        <div className={`w-96 bg-background-secondary shadow-xl p-6 space-y-5 overflow-y-auto transition-all duration-300 ease-in-out ${showConfig ? 'mr-0' : '-mr-96 opacity-0'}`}>
          <div className="bg-background-tertiary/50 rounded-xl shadow-lg p-5 space-y-4 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-accent-primary">
              <Settings size={20} />
              Configuration
            </h3>
            <div className="space-y-2 pt-3 border-t border-border-color/50">
              <h4 className="font-semibold text-text-secondary mt-2">Field Settings</h4>
              <ConfigInput label="Width" value={config.field.width} onChange={(e) => setConfig(prev => ({ ...prev, field: { ...prev.field, width: parseFloat(e.target.value) } }))} unit="m" className="mb-1" />
              <ConfigInput label="Height" value={config.field.height} onChange={(e) => setConfig(prev => ({ ...prev, field: { ...prev.field, height: parseFloat(e.target.value) } }))} unit="m" className="mb-1" />
              <ConfigInput label="Pixels/Meter" value={config.field.pixelsPerMeter} onChange={(e) => setConfig(prev => ({ ...prev, field: { ...prev.field, pixelsPerMeter: parseFloat(e.target.value) } }))} unit="px/m" className="mb-1" />
              <div className="flex items-center justify-between py-1">
                <label className="text-sm text-text-secondary">Show Grid:</label>
                <input type="checkbox" checked={config.field.showGrid} onChange={(e) => setConfig(prev => ({ ...prev, field: { ...prev.field, showGrid: e.target.checked } }))} className="mr-2 h-4 w-4 text-accent-primary rounded-sm focus:ring-accent-secondary bg-text-primary border-border-color" />
              </div>
              <ConfigInput label="Grid Spacing" value={config.field.gridSpacing} onChange={(e) => setConfig(prev => ({ ...prev, field: { ...prev.field, gridSpacing: parseFloat(e.target.value) } }))} unit="m" className="mb-1" />
            </div>
            <div className="space-y-2 pt-3 border-t border-border-color/50">
              <h4 className="font-semibold text-text-secondary mt-2">Robot Settings</h4>
              <ConfigInput label="Radius" value={config.robot.radius} onChange={(e) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, radius: parseFloat(e.target.value) } }))} unit="m" className="mb-1" />
              <ConfigInput label="Mass" value={config.robot.mass} onChange={(e) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, mass: parseFloat(e.target.value) } }))} unit="kg" className="mb-1" />
              <ConfigInput label="Max Velocity" value={config.robot.maxVelocity} onChange={(e) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, maxVelocity: parseFloat(e.target.value) } }))} unit="m/s" className="mb-1" />
              <ConfigInput label="Max Acceleration" value={config.robot.maxAcceleration} onChange={(e) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, maxAcceleration: parseFloat(e.target.value) } }))} unit="m/s²" className="mb-1" />
              <ConfigInput label="Max Angular Velocity" value={config.robot.maxAngularVelocity} onChange={(e) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, maxAngularVelocity: parseFloat(e.target.value) } }))} unit="deg/s" className="mb-1" />
              <ConfigInput label="Max Angular Acceleration" value={config.robot.maxAngularAcceleration} onChange={(e) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, maxAngularAcceleration: parseFloat(e.target.value) } }))} unit="deg/s²" className="mb-1" />
            </div>
            <div className="space-y-2 pt-3 border-t border-border-color/50">
              <h4 className="font-semibold text-text-secondary mt-2">Path Settings</h4>
              <div className="flex items-center justify-between py-1">
                <label htmlFor="splineType" className="text-sm text-text-secondary">Spline Type:</label>
                <select 
                  id="splineType"
                  value={config.path.splineType}
                  onChange={(e) => setConfig(prev => ({ ...prev, path: { ...prev.path, splineType: e.target.value as 'cubic' | 'quintic' } }))}
                  className="bg-background-primary border border-border-color text-text-primary text-sm rounded-md focus:ring-accent-primary focus:border-accent-primary p-1.5 w-1/2 shadow-sm"
                >
                  <option value="cubic">Cubic</option>
                  <option value="quintic">Quintic</option>
                </select>
              </div>
              <ConfigInput label="Path Resolution" value={config.path.pathResolution} onChange={(e) => setConfig(prev => ({ ...prev, path: { ...prev.path, pathResolution: parseFloat(e.target.value) } }))} unit="m" className="mb-1" />
              <ConfigInput label="Path Color" type="color" value={config.path.color} onChange={(e) => setConfig(prev => ({ ...prev, path: { ...prev.path, color: e.target.value } }))} className="mb-1" />
              <ConfigInput label="Path Width" type="number" value={config.path.width} onChange={(e) => setConfig(prev => ({ ...prev, path: { ...prev.path, width: parseInt(e.target.value, 10) } }))} unit="px" className="mb-1" />
              <div className="flex items-center justify-between py-1">
                <label className="text-sm text-text-secondary">Velocity Visualization:</label>
                <input type="checkbox" checked={config.path.velocityVisualization} onChange={(e) => setConfig(prev => ({ ...prev, path: { ...prev.path, velocityVisualization: e.target.checked } }))} className="mr-2 h-4 w-4 text-accent-primary rounded-sm focus:ring-accent-secondary bg-text-primary border-border-color" />
              </div>
            </div>
          </div>

          <div className="bg-background-tertiary/50 rounded-xl shadow-lg p-5 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-4 text-accent-primary">Waypoint List</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {waypoints.map((wp, index) => {
                  let velocityDisplay = "Path Optimized";
                  if (wp.stopAtWaypoint) {
                    velocityDisplay = `STOP (${(wp.stopDuration !== undefined ? wp.stopDuration : config.waypoint.defaultStopDuration).toFixed(1)}s)`;
                  } else if (wp.targetVelocity !== undefined) {
                    velocityDisplay = `T: ${wp.targetVelocity.toFixed(1)} m/s`;
                    if (wp.maxVelocityConstraint !== undefined) {
                      velocityDisplay += ` M: ${wp.maxVelocityConstraint.toFixed(1)} m/s`;
                    }
                  } else if (wp.maxVelocityConstraint !== undefined) {
                    velocityDisplay = `Max: ${wp.maxVelocityConstraint.toFixed(1)} m/s`;
                  }

                  return (
                    <div 
                      key={wp.x + '-' + wp.y + '-' + index} 
                      draggable="true"
                      onDragStart={(e) => handleWaypointDragStart(e, index)}
                      onDragOver={(e) => handleWaypointDragOver(e, index)}
                      onDragLeave={handleWaypointDragLeave}
                      onDrop={(e) => handleWaypointDrop(e, index)}
                      onDragEnd={handleWaypointDragEnd}
                      onClick={() => setSelectedWaypoint(index)} 
                      className={`p-3 rounded-lg cursor-grab flex justify-between items-center group relative ${selectedWaypoint === index ? 'bg-gradient-accent text-white shadow-lg transform scale-105' : 'bg-background-primary text-text-primary hover:bg-accent-secondary hover:text-white hover:shadow-md'} ${draggedWaypointSourceIndex === index ? 'opacity-50' : ''}`}>
                        <div className="flex items-center">
                          <GripVertical size={18} className="mr-2 text-text-tertiary group-hover:text-text-secondary cursor-grab" />
                          <div>
                            <div className="font-medium">Waypoint {index + 1}</div>
                            <div className="text-xs opacity-80">
                              ({wp.x.toFixed(1)}, {wp.y.toFixed(1)}) • {velocityDisplay}
                              {wp.heading !== undefined ? ` • ${wp.heading.toFixed(0)}°` : ''}
                            </div>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteWaypoint(index); }} title="Delete Waypoint" className={`p-1 rounded-md transform group-hover:opacity-100 ${selectedWaypoint === index ? 'text-red-200 hover:text-white opacity-100' : 'text-red-400 hover:text-error-color opacity-0 group-hover:opacity-100'} hover:bg-background-secondary/50`}>
                          <Trash2 size={14} />
                        </button>
                    </div>
                  );
                })}
                {waypoints.length === 0 && (
                    <p className="text-text-secondary text-sm text-center py-4">No waypoints added yet.</p>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Message Box */}
      {message && (
        <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-xl text-white text-sm z-50 transform transition-all duration-300 ease-in-out hover:scale-105 ${message.type === 'error' ? 'bg-error-color' : 'bg-gradient-accent'}`}>
          {message.text}
        </div>
      )}
    </div> 
  );
};

export default AppUI; 