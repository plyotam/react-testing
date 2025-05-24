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