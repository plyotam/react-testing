export interface Waypoint {
  x: number;
  y: number;
  radius: number;
  targetVelocity?: number; // The robot aims for this velocity when passing through/near the waypoint
  maxVelocityConstraint?: number; // The robot must not exceed this velocity when passing through/near the waypoint
  heading?: number; // Optional heading in degrees
  stopAtWaypoint: boolean;
  stopDuration?: number; // Optional: duration in seconds to stop if stopAtWaypoint is true. Overrides global if set.
  isGuidePoint?: boolean; // New: If true, this waypoint is a suggestion, not a strict requirement.
  guideInfluence?: number; // New: How strongly a guide point pulls the path (e.g., 0 to 1).
} 