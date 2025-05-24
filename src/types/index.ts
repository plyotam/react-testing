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
  x: number;
  y: number;
  s: number;
  velocity: number;
  acceleration: number;
  curvature: number;
  heading: number;
  time: number;
} 