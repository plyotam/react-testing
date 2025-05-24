export const defaultConfig = {
  field: {
    width: 16.54, // meters (FRC field)
    height: 8.02, // meters
    pixelsPerMeter: 50,
    backgroundColor: '#514b42',
    backgroundImage: null as string | null, // Allow string for data URL
    showGrid: true,
    gridSpacing: 1 // meters
  },
  robot: {
    radius: 0.4, // meters
    mass: 60, // kg
    maxVelocity: 4.0, // m/s
    maxAcceleration: 3.0, // m/s²
    maxAngularVelocity: 360, // deg/s
    maxAngularAcceleration: 720, // deg/s²
    color: '#3b82f6',
    orientationLength: 0.6 // meters
  },
  waypoint: {
    defaultRadius: 0.3, // meters
    defaultTargetVelocity: 1.5, // m/s
    defaultMaxVelocityConstraint: 2.0, // m/s
    minRadius: 0.1,
    maxRadius: 2.0,
    defaultHeading: 0, // degrees
    stopAtWaypoint: false,
    defaultStopDuration: 1.0, // seconds, NEW default for per-waypoint stop, if stopAtWaypoint is true
  },
  path: {
    splineType: 'cubic', // 'cubic', 'quintic'
    lookaheadDistance: 0.5, // meters
    pathResolution: 0.05, // meters between path points
    optimizationIterations: 100,
    velocityOptimization: true,
    curvatureLimit: 2.0, // 1/meters
    color: '#ef4444',
    width: 3,
    waypointColor: '#10b981',
    waypointBorderColor: '#065f46',
    selectedColor: '#f59e0b',
    velocityVisualization: true,
    accentPrimary: '#3498db', // Default accent color (blue)
    textPrimary: '#ecf0f1'    // Default text color (light gray/white)
  },
  physics: {
    frictionCoefficient: 0.8,
    wheelbase: 0.6, // meters (for visualization)
    trackWidth: 0.5, // meters
    momentOfInertia: 5.0 // kg⋅m²
  }
};

export type Config = typeof defaultConfig; 