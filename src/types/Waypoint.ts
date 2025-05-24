export interface Waypoint {
  x: number;
  y: number;
  radius: number;
  velocity: number;
  heading?: number; // Optional heading in degrees
  stopAtWaypoint: boolean;
} 