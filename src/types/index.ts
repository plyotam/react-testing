import { Waypoint } from './Waypoint';

export interface SimulationDataPoint {
  time: number;
  x: number;
  y: number;
  s: number;
  velocity: number;
  acceleration: number;
  heading: number;
  curvature: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ExclusionZone {
  id: string;
  corners: [Point, Point, Point, Point];
  userInputPoints: [Point, Point, Point];
}

// Re-export Waypoint to make it available from src/types/index.ts
export type { Waypoint };

// New type definitions based on App.tsx state
export interface RobotState {
  x: number;
  y: number;
  rotation: number;
  velocity: number;
  angularVelocity: number;
}

export interface OptimizedPathPoint {
  time: number;
  x: number;
  y: number;
  s: number; // distance along path
  velocity: number;
  acceleration: number;
  curvature: number;
  heading?: number; // Optional: target robot heading at this point
  // Other path-specific properties as needed
}

export interface CommandMarker {
  id: string; // Unique ID for the marker
  s: number; // Distance along the path where the command should trigger
  time: number; // Corresponding time on the path
  commandName: string; // User-defined name for the command (e.g., "OPEN_CLAW")
  commandParams?: any; // Optional parameters for the command (UNCOMMENTED)
  renderX?: number;
  renderY?: number;
}

export interface EventZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  commandName: string;
  triggerType: 'onEnter' | 'whileInZone';
  onExitCommandName?: string; // New: Command to trigger on exiting a 'whileInZone' zone
  color?: string; // Optional: for display
  // For 'onEnter' logic during simulation/robot execution
  // This state might be managed transiently rather than stored directly in the base object
  // hasBeenTriggeredThisSession?: boolean;
}

// Argument type for the main canvas drawing function
export interface DrawCanvasArgsBase { // Renaming existing to avoid direct conflict if imported elsewhere, though not strictly necessary
  // ... existing fields from drawCanvas.ts will be here
  // For now, let's assume we'll add the new fields to the existing DrawCanvasArgs in drawCanvas.ts directly
  // or that the type for drawCanvasContent's props object will be updated there.
  // The prompt implies DrawCanvasArgs is in drawCanvas.ts, but often types are central.
  // For this step, I'll assume DrawCanvasArgs is defined in drawCanvas.ts and will be updated there.
  // However, if it were defined in types/index.ts, this is where it would go:
  editorMode?: 'waypoints' | 'addEventZoneCenter' | 'addCommandMarker'; // Optional for now, will be made mandatory in drawCanvas.ts
  currentMousePosition?: Point | null; // Point is already defined as {x: number, y: number}
}

export interface TriggeredEvent {
  time: number;
  name: string;
  type: 'marker' | 'zoneEnter' | 'zoneExit' | 'zoneActiveStart';
}