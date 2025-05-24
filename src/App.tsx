import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Upload, Settings, Play, RotateCcw, Trash2, Image, Zap, Target, Square, BarChart2 } from 'lucide-react';
import { CubicSpline } from './utils/CubicSpline';
import { QuinticSpline } from './utils/QuinticSpline';
import ConfigInput from './components/ConfigInput';
import { Waypoint } from './types/Waypoint';
import SimulationGraphs from './components/SimulationGraphs';
import WaypointEditorPopup from './components/WaypointEditorPopup'; // Import the new component

interface SimulationDataPoint {
  time: number;
  x: number;
  y: number;
  velocity: number;
  acceleration: number;
  heading: number;
}

interface Point {
  x: number;
  y: number;
}

interface ExclusionZone {
  id: string;
  corners: [Point, Point, Point, Point];
  userInputPoints: [Point, Point, Point];
}

const HolonomicPathOptimizer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  
  const defaultConfig = {
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
      velocityVisualization: true
    },
    physics: {
      frictionCoefficient: 0.8,
      wheelbase: 0.6, // meters (for visualization)
      trackWidth: 0.5, // meters
      momentOfInertia: 5.0 // kg⋅m²
    }
  };

  const [config, setConfig] = useState(defaultConfig);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedWaypoint, setSelectedWaypoint] = useState<number | null>(null);
  const [optimizedPath, setOptimizedPath] = useState<{
    x: number;
    y: number;
    s: number;
    velocity: number;
    acceleration: number;
    curvature: number;
    heading: number;
    time: number;
  }[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [robotState, setRobotState] = useState<{ 
    x: number; y: number; rotation: number; velocity: number; angularVelocity: number 
  }>({ 
    x: 1, y: 1, rotation: 0, velocity: 0, angularVelocity: 0 
  });
  const [showConfig, setShowConfig] = useState(true);
  const [pathName, setPathName] = useState('Steamplanner');
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [optimizationMetrics, setOptimizationMetrics] = useState<{
    totalDistance: number;
    totalTime: number;
    maxCurvature: number;
    maxAcceleration: number;
    energyConsumption: number;
  } | null>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'info', text: string } | null>(null);
  const [simulationSpeedFactor, setSimulationSpeedFactor] = useState(1); // 1x, 2x, 4x
  const [waypointSHeadings, setWaypointSHeadings] = useState<{s: number, heading: number}[]>([]);
  const [simulationHistory, setSimulationHistory] = useState<SimulationDataPoint[]>([]);
  const [showGraphs, setShowGraphs] = useState(false);
  const [draggingWaypointIndex, setDraggingWaypointIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mouseDownPosition, setMouseDownPosition] = useState<{ x: number, y: number } | null>(null);
  const [waypointCreationMode, setWaypointCreationMode] = useState<'hard' | 'guide'>('hard'); // New state for creation mode

  // State for draggable waypoint editor
  const [editorPosition, setEditorPosition] = useState({ x: 50, y: 150 }); // Initial position
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });

  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const currentPathIndexRef = useRef<number>(0);
  const simulatedTimeRef = useRef<number>(0);
  const isPausedForStopPointRef = useRef<boolean>(false);
  const lastStoppedWaypointIndexRef = useRef<number | null>(null);

  const showMessage = useCallback((type: 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000); // Clear after 3 seconds
  }, []);

  const metersToPixels = useCallback((meters: number) => meters * config.field.pixelsPerMeter, [config.field.pixelsPerMeter]);
  const pixelsToMeters = useCallback((pixels: number) => pixels / config.field.pixelsPerMeter, [config.field.pixelsPerMeter]);
  
  const updateWaypointCoordinates = useCallback((index: number, newX: number, newY: number) => {
    setWaypoints(prevWaypoints => {
      if (index < 0 || index >= prevWaypoints.length) return prevWaypoints;
      const updated = [...prevWaypoints];
      updated[index] = { ...updated[index], x: newX, y: newY };
      return updated;
    });
  }, []);

  const normalizeAngleDeg = useCallback((angle: number): number => { // Normalize to [-180, 180)
    let result = angle % 360;
    if (result <= -180) result += 360;
    if (result > 180) result -= 360; 
    result = (angle % 360 + 540) % 360 - 180;
    if (result === -180 && angle > 0) return 180; 
    return result;
  }, []);

  const interpolateAngleDeg = useCallback((startAngle: number, endAngle: number, t: number): number => {
      const sa = normalizeAngleDeg(startAngle);
      const ea = normalizeAngleDeg(endAngle);
      let diff = ea - sa;

      if (diff > 180) {
          diff -= 360;
      } else if (diff < -180) {
          diff += 360;
      }
      return sa + diff * t; 
  }, [normalizeAngleDeg]);

  const addDataPointToHistory = useCallback((history: SimulationDataPoint[], newDataPoint: SimulationDataPoint): SimulationDataPoint[] => {
    if (history.length === 0 || history[history.length - 1].time < newDataPoint.time) {
      return [...history, newDataPoint];
    } else if (history[history.length - 1].time === newDataPoint.time) {
      // Optional: Update the last point if time is the same, or just keep the old one
      // For simplicity, we'll keep the old one if time hasn't advanced.
      // If updates are needed: return [...history.slice(0, -1), newDataPoint];
      return history; 
    }
    return history; // Should not be reached if time is decreasing, but as a fallback
  }, []);

  const generateOptimalPath = useCallback((waypoints: Waypoint[]) => {
    const hardWaypoints = waypoints.filter(wp => !wp.isGuidePoint);
    const guideWaypoints = waypoints.filter(wp => wp.isGuidePoint);

    if (hardWaypoints.length < 2) {
      setOptimizedPath([]);
      setOptimizationMetrics(null);
      if (waypoints.length > 0 && hardWaypoints.length < waypoints.length) { // Some points exist, but all are guides or only one hard
        showMessage('info', 'Path requires at least two non-guide waypoints. Current guides will not form a path.');
      } else if (waypoints.length > 0) { // Some points exist, but less than 2 are hard
        // showMessage('info', 'Path requires at least two waypoints to form a path.'); // Generic message if no guides involved
      }
      return [];
    }
    
    // --- A* Integration: Grid Setup ---
    // Removed A* grid setup and exclusion zone processing.
    // Path points will be directly from hardWaypoints for now.

    let pathPointsForSpline: Point[] = hardWaypoints.map(wp => ({ x: wp.x, y: wp.y }));
    console.log('[Debug] Initial pathPointsForSpline (from hardWaypoints):', JSON.parse(JSON.stringify(pathPointsForSpline)));

    // --- Guide Waypoint Path Pulling Logic ---
    if (guideWaypoints.length > 0 && pathPointsForSpline.length >= 2) {
      const attractedPathPoints: Point[] = [pathPointsForSpline[0]]; // Start with the first hard point

      for (let i = 0; i < pathPointsForSpline.length - 1; i++) {
        const p1 = pathPointsForSpline[i];
        const p2 = pathPointsForSpline[i+1];
        
        // Add p1 (which is already in attractedPathPoints or is the start of current segment)
        // Then, find guide waypoints that might influence this segment
        const segmentMidPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const segmentLength = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);

        const influentialGuides = guideWaypoints.map(gw => {
          // Distance from guide waypoint to segment midpoint (approximate check)
          const distToMid = Math.sqrt((gw.x - segmentMidPoint.x)**2 + (gw.y - segmentMidPoint.y)**2);
          // Project guide waypoint onto the line defined by p1 and p2
          const l2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
          if (l2 === 0) return { gw, distSq: Infinity, t: 0, closestPointOnSegment: {...p1} }; // p1 and p2 are the same
          let t = ((gw.x - p1.x) * (p2.x - p1.x) + (gw.y - p1.y) * (p2.y - p1.y)) / l2;
          t = Math.max(0, Math.min(1, t)); // Clamp t to be on the segment
          const closestPointOnSegment = {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
          };
          const distSq = (gw.x - closestPointOnSegment.x)**2 + (gw.y - closestPointOnSegment.y)**2;
          return { gw, distSq, t, closestPointOnSegment };
        })
        // Consider guides whose projection is on this segment or reasonably close
        // And sort them by their projection point's parameter 't' along the segment
        .filter(item => item.distSq < ( (segmentLength/2 + item.gw.radius) * (segmentLength/2 + item.gw.radius) * 2) ) // Heuristic filter
        .sort((a,b) => a.t - b.t);

        for (const { gw, closestPointOnSegment } of influentialGuides) {
          const influence = gw.guideInfluence ?? 0.5; // Default influence if undefined
          const attractedPoint = {
            x: closestPointOnSegment.x + (gw.x - closestPointOnSegment.x) * influence,
            y: closestPointOnSegment.y + (gw.y - closestPointOnSegment.y) * influence,
          };
          attractedPathPoints.push(attractedPoint);
        }
        attractedPathPoints.push(p2); // Add the end of the hard segment
      }
      
      // Filter out consecutive duplicate points that might have been added
      pathPointsForSpline = attractedPathPoints.filter((point, index, self) => 
        index === 0 || !(point.x === self[index-1].x && point.y === self[index-1].y)
      );
      console.log('[Debug] pathPointsForSpline after guide influence:', JSON.parse(JSON.stringify(pathPointsForSpline)));
    }
    // --- End Guide Waypoint Logic ---

    if (pathPointsForSpline.length < 2) {
      setOptimizationMetrics(null);
      setOptimizedPath([]);
      showMessage('error', 'Not enough points for spline path after guide influence. Try different waypoints or guides.');
      return [];
    }

    const path: {
      x: number;
      y: number;
      s: number;
      velocity: number;
      acceleration: number;
      curvature: number;
      heading: number;
      time: number;
    }[] = [];
    const metrics = {
      totalDistance: 0,
      totalTime: 0,
      maxCurvature: 0,
      maxAcceleration: 0,
      energyConsumption: 0
    };
    
    const s_coords = [0];
    for (let i = 1; i < pathPointsForSpline.length; i++) {
      const dx = pathPointsForSpline[i].x - pathPointsForSpline[i-1].x;
      const dy = pathPointsForSpline[i].y - pathPointsForSpline[i-1].y;
      s_coords.push(s_coords[s_coords.length - 1] + Math.sqrt(dx*dx + dy*dy));
    }
    
    let xSpline, ySpline;
    const splineXCoords = pathPointsForSpline.map(p => p.x);
    const splineYCoords = pathPointsForSpline.map(p => p.y);

    if (s_coords.length < 2 || splineXCoords.length < 2 || splineYCoords.length < 2) {
        console.error("[Spline Error] Not enough points for spline creation from A* path.", s_coords, splineXCoords, splineYCoords);
        setOptimizationMetrics(null);
        setOptimizedPath([]);
        showMessage('error', 'Spline creation failed due to insufficient points from A*.');
        return [];
    }

    if (config.path.splineType === 'quintic') {
      xSpline = new QuinticSpline(s_coords, splineXCoords);
      ySpline = new QuinticSpline(s_coords, splineYCoords);
    } else {
      xSpline = new CubicSpline(s_coords, splineXCoords);
      ySpline = new CubicSpline(s_coords, splineYCoords);
    }
    
    const totalDistance = s_coords.length > 1 ? s_coords[s_coords.length - 1] : 0;
    metrics.totalDistance = totalDistance;
    
    const pathResolution = config.path.pathResolution;
    const numPoints = totalDistance > 0 ? Math.ceil(totalDistance / pathResolution) : 0;
    let accumulatedTime = 0;

    if (numPoints >= 0 && pathPointsForSpline.length > 0) {
      const s0 = 0;
      const x0 = xSpline.interpolate(s0);
      const y0 = ySpline.interpolate(s0);
      const dx_ds0 = xSpline.derivative(s0);
      const dy_ds0 = ySpline.derivative(s0);
      const d2x_ds2_0 = xSpline.secondDerivative(s0);
      const d2y_ds2_0 = ySpline.secondDerivative(s0);
      const cNum0 = dx_ds0 * d2y_ds2_0 - dy_ds0 * d2x_ds2_0;
      const cDen0 = Math.pow(dx_ds0**2 + dy_ds0**2, 1.5);
      const curvature0 = cDen0 < 1e-6 ? 0 : Math.abs(cNum0) / cDen0;
      const heading0 = Math.atan2(dy_ds0, dx_ds0) * 180 / Math.PI;

      let v0 = config.robot.maxVelocity;
      if (curvature0 > 0.001) {
        v0 = Math.min(v0, Math.sqrt(config.robot.maxAcceleration / curvature0));
      }

      // Velocity constraints for the first point are based on the first HARD waypoint
      if (hardWaypoints.length > 0) {
        const firstHardWaypoint = hardWaypoints[0];
        const distToFirstHardWp = Math.sqrt((x0 - firstHardWaypoint.x)**2 + (y0 - firstHardWaypoint.y)**2);

        if (distToFirstHardWp < firstHardWaypoint.radius) {
          if (firstHardWaypoint.stopAtWaypoint) {
            const criticalStopDist = config.path.pathResolution * 2.0;
            if (distToFirstHardWp < criticalStopDist) {
              v0 = 0.0;
            } else {
              const distTarget = Math.max(0, distToFirstHardWp - 0.01);
              const decelToStopV = Math.sqrt(2 * config.robot.maxAcceleration * distTarget);
              v0 = Math.min(v0, decelToStopV);
            }
          } else {
            let wpMax = v0;
            if (firstHardWaypoint.maxVelocityConstraint !== undefined) {
              wpMax = Math.min(wpMax, firstHardWaypoint.maxVelocityConstraint);
            }
            if (firstHardWaypoint.targetVelocity !== undefined) {
              v0 = Math.min(wpMax, firstHardWaypoint.targetVelocity);
            } else {
              v0 = wpMax;
            }
          }
        }
      }
      v0 = Math.max(0, v0); 
      path.push({ x: x0, y: y0, s: s0, velocity: v0, acceleration: 0, curvature: curvature0, heading: heading0, time: 0 });
      metrics.maxCurvature = Math.max(metrics.maxCurvature, curvature0);
    }

    for (let i = 1; i <= numPoints; i++) {
      const s = (i / numPoints) * totalDistance;
      const x = xSpline.interpolate(s);
      const y = ySpline.interpolate(s);
      const dx_ds = xSpline.derivative(s);
      const dy_ds = ySpline.derivative(s);
      const d2x_ds2 = xSpline.secondDerivative(s);
      const d2y_ds2 = ySpline.secondDerivative(s);
      const curvatureNumerator = dx_ds * d2y_ds2 - dy_ds * d2x_ds2;
      const curvatureDenominator = Math.pow(dx_ds * dx_ds + dy_ds * dy_ds, 1.5);
      const curvature = curvatureDenominator < 1e-6 ? 0 : Math.abs(curvatureNumerator) / curvatureDenominator;
      metrics.maxCurvature = Math.max(metrics.maxCurvature, curvature);
      const heading = Math.atan2(dy_ds, dx_ds) * 180 / Math.PI;

      let nearestHardWaypointIndex = -1;
      let minDistToHardWaypoint = Infinity;
      for (let j = 0; j < hardWaypoints.length; j++) {
        const distSq = (x - hardWaypoints[j].x)**2 + (y - hardWaypoints[j].y)**2;
        if (distSq < minDistToHardWaypoint) { // Compare squared distances
          minDistToHardWaypoint = distSq;
          nearestHardWaypointIndex = j;
        }
      }
      minDistToHardWaypoint = Math.sqrt(minDistToHardWaypoint); // Take sqrt once after loop
      const nearestHardWaypoint = nearestHardWaypointIndex !== -1 ? hardWaypoints[nearestHardWaypointIndex] : null;

      let v_achieved;
      let currentAcceleration;
      let segmentTime;
      const prevPoint = path[path.length - 1];
      const v_prev = prevPoint.velocity;
      const segmentDx = x - prevPoint.x;
      const segmentDy = y - prevPoint.y;
      const d_s = Math.sqrt(segmentDx**2 + segmentDy**2);

      let isCurrentPointNearHardStop = false;
      if (nearestHardWaypoint) {
        const simNearDist = nearestHardWaypoint.radius * 0.70;
        const pathGenStopDist = config.path.pathResolution * 2.0;
        const effectiveStopDist = Math.min(simNearDist, pathGenStopDist);
        isCurrentPointNearHardStop = nearestHardWaypoint.stopAtWaypoint && minDistToHardWaypoint < effectiveStopDist;
      }

      if (isCurrentPointNearHardStop) {
        v_achieved = 0.0;
        if (d_s < 1e-6) { 
            currentAcceleration = 0;
            segmentTime = 0.001; 
        } else {
            currentAcceleration = (v_achieved**2 - v_prev**2) / (2 * d_s);
        }
      } else {
        let targetVelocityForKinematics = config.robot.maxVelocity;
        if (curvature > 0.001) {
          targetVelocityForKinematics = Math.min(targetVelocityForKinematics, Math.sqrt(config.robot.maxAcceleration / curvature));
        }

        if (nearestHardWaypoint && nearestHardWaypoint.stopAtWaypoint) {
          const requiredStoppingDistance = (v_prev > 0.1) ? (v_prev**2) / (2 * config.robot.maxAcceleration) : 0;
          const adaptiveLookahead = Math.min(requiredStoppingDistance * 1.5, config.robot.maxVelocity * 1.0);
          const stopInfluenceZone = Math.max(nearestHardWaypoint.radius, adaptiveLookahead);

          if (minDistToHardWaypoint < stopInfluenceZone) {
             let currentEffectiveStopDist = config.path.pathResolution * 2.0;
             if (nearestHardWaypoint) { // Should always be true here
                const simNearDist = nearestHardWaypoint.radius * 0.70;
                currentEffectiveStopDist = Math.min(simNearDist, config.path.pathResolution * 2.0);
             }
            const distanceToHardStopEdge = Math.max(0, minDistToHardWaypoint - currentEffectiveStopDist);
            const velocityToNaturallyStopAtHardStopEdge = Math.sqrt(2 * config.robot.maxAcceleration * distanceToHardStopEdge);
            targetVelocityForKinematics = Math.min(targetVelocityForKinematics, velocityToNaturallyStopAtHardStopEdge);
          }
        } else if (nearestHardWaypoint) { // Non-stop hard waypoint
          if (minDistToHardWaypoint < nearestHardWaypoint.radius) {
            if (nearestHardWaypoint.maxVelocityConstraint !== undefined) {
              targetVelocityForKinematics = Math.min(targetVelocityForKinematics, nearestHardWaypoint.maxVelocityConstraint);
            }
            if (nearestHardWaypoint.targetVelocity !== undefined) {
              targetVelocityForKinematics = Math.min(targetVelocityForKinematics, nearestHardWaypoint.targetVelocity);
            }
          }
        }
        targetVelocityForKinematics = Math.max(0, targetVelocityForKinematics);

        if (d_s < 1e-6) {
          v_achieved = v_prev;
          currentAcceleration = 0;
        } else {
          if (targetVelocityForKinematics >= v_prev) {
            const v_if_full_accel = Math.sqrt(v_prev**2 + 2 * config.robot.maxAcceleration * d_s);
            v_achieved = Math.min(targetVelocityForKinematics, v_if_full_accel);
          } else {
            const v_if_full_decel_sq = v_prev**2 - 2 * config.robot.maxAcceleration * d_s;
            const v_if_full_decel = v_if_full_decel_sq > 0 ? Math.sqrt(v_if_full_decel_sq) : 0;
            v_achieved = Math.max(targetVelocityForKinematics, v_if_full_decel);
          }
          currentAcceleration = (v_achieved**2 - v_prev**2) / (2*d_s);
        }
      }
      
      currentAcceleration = Math.max(-config.robot.maxAcceleration, Math.min(config.robot.maxAcceleration, currentAcceleration));
      metrics.maxAcceleration = Math.max(metrics.maxAcceleration, Math.abs(currentAcceleration));

      if (d_s < 1e-6) { 
          segmentTime = 0.001;
      } else if (Math.abs(currentAcceleration) > 1e-4) { 
        segmentTime = (v_achieved - v_prev) / currentAcceleration;
      } else if (Math.abs(v_achieved - v_prev) < 1e-4 && (v_achieved + v_prev > 1e-4)) { 
         segmentTime = (2 * d_s) / (v_achieved + v_prev);
      } else if (Math.abs(v_achieved) < 1e-3 && Math.abs(v_prev) < 1e-3) { 
         segmentTime = 0.02;
      } else { 
        segmentTime = 0.02;
      }
      
      if (segmentTime <= 1e-5 && d_s > 1e-6) { 
          segmentTime = 1e-5; 
          if (Math.abs(v_achieved - v_prev) > 1e-4) {
            currentAcceleration = (v_achieved - v_prev) / segmentTime;
            currentAcceleration = Math.max(-config.robot.maxAcceleration, Math.min(config.robot.maxAcceleration, currentAcceleration));
          } else {
            currentAcceleration = 0;
          }
      }
      if (segmentTime < 0) segmentTime = Math.abs(segmentTime);

      accumulatedTime += segmentTime;
      const avgVelForEnergy = (v_achieved + v_prev) / 2;
      const power = config.robot.mass * Math.abs(currentAcceleration) * Math.abs(avgVelForEnergy) + 
                   0.5 * config.physics.frictionCoefficient * config.robot.mass * 9.81 * Math.abs(avgVelForEnergy);
      if (segmentTime > 1e-5) metrics.energyConsumption += Math.abs(power) * segmentTime;

      path.push({ x, y, s, velocity: v_achieved, acceleration: currentAcceleration, curvature, heading, time: accumulatedTime });
    }
    
    metrics.totalTime = accumulatedTime;
    setOptimizationMetrics(metrics);
    return path;
  }, [config, showMessage]); // Removed waypoints, as it's passed directly. generateOptimalPath itself is a dependency for the useEffect that calls it.

  useEffect(() => {
    if (waypoints.length >= 2) {
      const newPath = generateOptimalPath(waypoints);
      setOptimizedPath(newPath);

      // Calculate waypointSHeadings
      if (newPath.length > 0) {
        const newWPSHeadings: {s: number, heading: number}[] = [];
        waypoints.forEach(wp => {
          if (wp.heading !== undefined) {
            let closestPoint = newPath[0];
            let minDistSq = Infinity;

            newPath.forEach(p => {
              const distSq = (p.x - wp.x)**2 + (p.y - wp.y)**2;
              if (distSq < minDistSq) {
                minDistSq = distSq;
                closestPoint = p;
              }
            });
            newWPSHeadings.push({ s: closestPoint.s, heading: wp.heading });
          }
        });
        // Sort by s value. If multiple waypoints map to the exact same 's' (unlikely but possible if waypoints are very close),
        // their relative order doesn't strictly matter for the current interpolation logic, but sorting helps.
        newWPSHeadings.sort((a, b) => a.s - b.s);
        setWaypointSHeadings(newWPSHeadings);
      } else {
        setWaypointSHeadings([]);
      }
    } else {
      setOptimizedPath([]);
      setOptimizationMetrics(null);
      setWaypointSHeadings([]); // Clear here too
    }
  }, [waypoints, generateOptimalPath]); // generateOptimalPath depends on config

  useEffect(() => {
    const defaultBgPath = 'fields/field25.png'; // Path relative to public folder
    const img = new window.Image();
    img.onload = () => {
      setBackgroundImage(img);
      // Convert image to data URL to store in config for persistence
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        setConfig(prev => ({
          ...prev,
          field: { ...prev.field, backgroundImage: dataUrl }
        }));
        showMessage('info', 'Default background loaded.');
      } else {
        showMessage('error', 'Could not process default background for config.');
      }
    };
    img.onerror = () => {
      showMessage('error', `Default background ${defaultBgPath} not found. Place it in public/fields/`);
    };
    img.src = defaultBgPath;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const canvasWidth = metersToPixels(config.field.width);
    const canvasHeight = metersToPixels(config.field.height);
    
    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw background
    ctx.fillStyle = config.field.backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw background image if available
    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
    }
    
    // Draw grid
    if (config.field.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      
      const gridSpacing = metersToPixels(config.field.gridSpacing);
      for (let x = 0; x <= canvasWidth; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      
      for (let y = 0; y <= canvasHeight; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }
    }
    
    // Draw optimized path with velocity visualization
    if (optimizedPath.length > 1) {
      for (let i = 0; i < optimizedPath.length - 1; i++) {
        const current = optimizedPath[i];
        const next = optimizedPath[i + 1];
        
        if (config.path.velocityVisualization) {
          // Color based on velocity (red = slow, green = fast)
          const velocityRatio = current.velocity / config.robot.maxVelocity;
          const red = Math.floor(255 * (1 - velocityRatio));
          const green = Math.floor(255 * velocityRatio);
          ctx.strokeStyle = `rgb(${red}, ${green}, 0)`;
        } else {
          ctx.strokeStyle = config.path.color;
        }
        
        ctx.lineWidth = config.path.width;
        ctx.beginPath();
        ctx.moveTo(metersToPixels(current.x), metersToPixels(current.y));
        ctx.lineTo(metersToPixels(next.x), metersToPixels(next.y));
        ctx.stroke();
      }
    }
    
    // Draw waypoints
    waypoints.forEach((waypoint, index) => {
      const isSelected = selectedWaypoint === index;
      const pixelX = metersToPixels(waypoint.x);
      const pixelY = metersToPixels(waypoint.y);
      const pixelRadius = metersToPixels(waypoint.radius);
      
      // Draw radius circle
      ctx.save(); // Save context state for potential dashed lines
      if (waypoint.isGuidePoint) {
        ctx.setLineDash([5, 5]); // Dashed line for guide points
        ctx.strokeStyle = isSelected ? config.path.selectedColor : '#8888FF'; // Lighter blue for guide border
        ctx.fillStyle = isSelected ? config.path.selectedColor + '15' : '#8888FF' + '15';
      } else {
        ctx.strokeStyle = isSelected ? config.path.selectedColor : config.path.waypointBorderColor;
        ctx.fillStyle = isSelected ? config.path.selectedColor + '20' : config.path.waypointColor + '20';
      }
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pixelX, pixelY, pixelRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore(); // Restore to solid lines if changed
      
      // Draw waypoint center
      if (waypoint.isGuidePoint) {
        ctx.fillStyle = isSelected ? config.path.selectedColor : '#AAAAFF'; // Lighter blue center for guide
      } else {
        ctx.fillStyle = isSelected ? config.path.selectedColor : config.path.waypointColor;
      }
      ctx.beginPath();
      ctx.arc(pixelX, pixelY, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw target heading if set
      if (waypoint.heading !== undefined) {
        const angle = waypoint.heading * Math.PI / 180;
        const length = metersToPixels(0.8);
        ctx.strokeStyle = isSelected ? config.path.selectedColor : config.path.waypointColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pixelX, pixelY);
        ctx.lineTo(pixelX + Math.cos(angle) * length, pixelY + Math.sin(angle) * length);
        ctx.stroke();
        
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(pixelX + Math.cos(angle) * length, pixelY + Math.sin(angle) * length);
        ctx.lineTo(pixelX + Math.cos(angle - 0.5) * (length - 12), pixelY + Math.sin(angle - 0.5) * (length - 12));
        ctx.moveTo(pixelX + Math.cos(angle) * length, pixelY + Math.sin(angle) * length);
        ctx.lineTo(pixelX + Math.cos(angle + 0.5) * (length - 12), pixelY + Math.sin(angle + 0.5) * (length - 12));
        ctx.stroke();
      }
      
      // Draw waypoint label with velocity/status
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(`${index + 1}`, pixelX, pixelY - pixelRadius - 15);
      ctx.fillText(`${index + 1}`, pixelX, pixelY - pixelRadius - 15);
      
      ctx.font = '10px sans-serif';
      let velocityStatusText = "Path Optimized";
      if (waypoint.stopAtWaypoint) {
        const duration = waypoint.stopDuration !== undefined ? waypoint.stopDuration : config.waypoint.defaultStopDuration;
        velocityStatusText = `STOP (${duration.toFixed(1)}s)`;
      } else if (waypoint.targetVelocity !== undefined) {
        velocityStatusText = `T: ${waypoint.targetVelocity.toFixed(1)}m/s`;
        if (waypoint.maxVelocityConstraint !== undefined) {
          velocityStatusText += ` M: ${waypoint.maxVelocityConstraint.toFixed(1)}m/s`;
        }
      } else if (waypoint.maxVelocityConstraint !== undefined) {
        velocityStatusText = `Max: ${waypoint.maxVelocityConstraint.toFixed(1)}m/s`;
      }
      // else it remains "Path Optimized" or could be an empty string if preferred

      ctx.strokeText(velocityStatusText, pixelX, pixelY - pixelRadius - 5);
      ctx.fillText(velocityStatusText, pixelX, pixelY - pixelRadius - 5);
    });
    
    // Draw robot
    const robot = robotState;
    const pixelX = metersToPixels(robot.x);
    const pixelY = metersToPixels(robot.y);
    const pixelRadius = metersToPixels(config.robot.radius);
    
    ctx.fillStyle = config.robot.color;
    ctx.beginPath();
    ctx.arc(pixelX, pixelY, pixelRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw robot orientation
    const angle = robot.rotation * Math.PI / 180;
    const orientationLength = metersToPixels(config.robot.orientationLength);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pixelX, pixelY);
    ctx.lineTo(pixelX + Math.cos(angle) * orientationLength, 
               pixelY + Math.sin(angle) * orientationLength);
    ctx.stroke();
    
    // Draw robot frame (wheelbase visualization)
    ctx.save(); // Save current context state
    ctx.translate(pixelX, pixelY); // Move to robot's center
    ctx.rotate(angle); // Rotate by robot's angle

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    const wheelbasePixels = metersToPixels(config.physics.wheelbase);
    const trackWidthPixels = metersToPixels(config.physics.trackWidth);
    
    ctx.beginPath();
    // Draw rectangle centered at (0,0) in the new rotated context
    ctx.rect(-wheelbasePixels / 2, -trackWidthPixels / 2, 
             wheelbasePixels, trackWidthPixels);
    ctx.stroke();
    
    ctx.restore(); // Restore context to pre-transformation state
    
  }, [config, waypoints, selectedWaypoint, robotState, optimizedPath, backgroundImage, metersToPixels]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    
    setMouseDownPosition({ x: pixelX, y: pixelY });

    const meterX = pixelsToMeters(pixelX);
    const meterY = pixelsToMeters(pixelY);

    const clickedWaypointIndex = waypoints.findIndex(wp => {
      const distance = Math.sqrt((wp.x - meterX) ** 2 + (wp.y - meterY) ** 2);
      return distance <= wp.radius;
    });

    if (clickedWaypointIndex !== -1) {
      setSelectedWaypoint(clickedWaypointIndex);
      setDraggingWaypointIndex(clickedWaypointIndex);
      setIsDragging(true);
    } else {
      setSelectedWaypoint(null); // Click on empty space deselects
      // Potentially set a flag here if you want to allow dragging to create new waypoints,
      // but for now, dragging only moves existing ones.
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || draggingWaypointIndex === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    const meterX = pixelsToMeters(pixelX);
    const meterY = pixelsToMeters(pixelY);

    updateWaypointCoordinates(draggingWaypointIndex, meterX, meterY);
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging) {
      setIsDragging(false);
      setDraggingWaypointIndex(null);
    } else if (mouseDownPosition) {
      // This was a click, not a drag. Check if it was a "simple" click to add a new waypoint.
      const rect = canvas.getBoundingClientRect();
      const upPixelX = e.clientX - rect.left;
      const upPixelY = e.clientY - rect.top;
      
      const distDragged = Math.sqrt(
        (upPixelX - mouseDownPosition.x)**2 + 
        (upPixelY - mouseDownPosition.y)**2
      );

      // If mouse didn't move much and no waypoint was selected on mousedown (meaning click on empty space)
      if (distDragged < 5 && selectedWaypoint === null) {
        const meterX = pixelsToMeters(mouseDownPosition.x);
        const meterY = pixelsToMeters(mouseDownPosition.y);
        const isGuide = waypointCreationMode === 'guide';
        const newWaypoint: Waypoint = {
          x: meterX,
          y: meterY,
          radius: config.waypoint.defaultRadius,
          targetVelocity: config.waypoint.defaultTargetVelocity,
          maxVelocityConstraint: config.waypoint.defaultMaxVelocityConstraint,
          heading: config.waypoint.defaultHeading,
          stopAtWaypoint: config.waypoint.stopAtWaypoint,
          stopDuration: config.waypoint.stopAtWaypoint ? config.waypoint.defaultStopDuration : undefined,
          isGuidePoint: isGuide,
          guideInfluence: isGuide ? 0.5 : undefined, // Default influence for guide points
        };
        
        setWaypoints(prevWaypoints => {
          const newWaypoints = [...prevWaypoints, newWaypoint];
          setSelectedWaypoint(newWaypoints.length - 1); // Select the newly added waypoint
          return newWaypoints;
        });
      }
    }
    setMouseDownPosition(null);
  };
  
  const handleCanvasMouseLeave = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);
      setDraggingWaypointIndex(null);
      setMouseDownPosition(null); // Reset mouse down position as drag is cancelled
    }
  };

  const updateWaypoint = (field: keyof Waypoint, value: any) => {
    if (selectedWaypoint === null) return;
    const updated = [...waypoints];
    updated[selectedWaypoint] = { ...updated[selectedWaypoint], [field]: value }; 
    setWaypoints(updated);
  };

  const deleteWaypoint = (index: number) => {
    const updated = waypoints.filter((_, i) => i !== index);
    setWaypoints(updated);
    setSelectedWaypoint(null);
  };

  const clearPath = () => {
    setWaypoints([]);
    setSelectedWaypoint(null);
    setIsPlaying(false);
    setOptimizedPath([]);
    setOptimizationMetrics(null);
  };

  const exportPath = () => {
    const pathData = {
      name: pathName,
      waypoints,
      optimizedPath,
      config,
      metrics: optimizationMetrics,
      metadata: {
        created: new Date().toISOString(),
        version: '2.0',
        type: 'holonomic_optimal_path'
      }
    };
    
    const blob = new Blob([JSON.stringify(pathData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pathName.replace(/\s+/g, '_')}_optimal.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importPath = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (!event.target) {
        return;
      }
      try {
        if (typeof event.target.result === 'string') {
          const pathData = JSON.parse(event.target.result);
          setPathName(pathData.name || 'Imported Path');
          setWaypoints(pathData.waypoints || []);
          if (pathData.config) {
            // Merge imported config with default to ensure all properties exist
            setConfig(prevConfig => ({ 
              ...defaultConfig, 
              ...pathData.config,
              field: { ...defaultConfig.field, ...pathData.config.field },
              robot: { ...defaultConfig.robot, ...pathData.config.robot },
              waypoint: { ...defaultConfig.waypoint, ...pathData.config.waypoint },
              path: { ...defaultConfig.path, ...pathData.config.path },
              physics: { ...defaultConfig.physics, ...pathData.config.physics },
            }));
            // If background image was part of the imported config, load it
            if (pathData.config.field.backgroundImage) {
              const img = new window.Image();
              img.onload = () => setBackgroundImage(img);
              img.src = pathData.config.field.backgroundImage;
            } else {
              setBackgroundImage(null);
            }
          }
          setSelectedWaypoint(null);
          showMessage('info', 'Path imported successfully!');
        }
      } catch (error) {
        showMessage('error', 'Error importing path: Invalid file format');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Clear the file input
  };

  const loadBackgroundImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (!event.target) {
        return;
      }
      const img = new window.Image();
      img.onload = () => {
        setBackgroundImage(img);
        if (typeof event.target!.result === 'string') {
          setConfig(prev => ({
            ...prev,
            field: { ...prev.field, backgroundImage: event.target!.result as string }
          }));
          showMessage('info', 'Background image loaded!');
        }
      };

      if (typeof event.target.result === 'string') {
        img.src = event.target.result;
      } else if (event.target.result instanceof ArrayBuffer) {
        // Handle ArrayBuffer case if necessary, or log an error
        console.error("Image loaded as ArrayBuffer, expected string data URL");
        showMessage('error', 'Failed to load image: Invalid format.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Clear the file input
  };

  const playPath = () => {
    if (optimizedPath.length < 2) {
      showMessage('error', 'Path must have at least 2 points to simulate.');
      return;
    }
    setSimulationHistory([]); // Clear previous history
    
    let initialRotation = 0; 
    if (optimizedPath.length > 0) {
        const firstPathPointS = optimizedPath[0].s;
        
        const firstApplicableTarget = waypointSHeadings.find(wh => wh.s >= firstPathPointS);
        
        if (waypoints.length > 0 && waypoints[0].heading !== undefined) {
            initialRotation = waypoints[0].heading;
        } else if (firstApplicableTarget) {
            initialRotation = firstApplicableTarget.heading;
        } else if (waypointSHeadings.length > 0) {
            // If all targets are before path starts (edge case) or no targets after start, use last known target
            initialRotation = waypointSHeadings[waypointSHeadings.length - 1].heading;
        } else {
            // No waypoint headings at all, default to 0 for holonomic robot
            initialRotation = 0; 
        }
    }

    // Reset robot to the first point before starting simulation
    if (optimizedPath.length > 0) {
      const firstPoint = optimizedPath[0];
      const initialDataPoint: SimulationDataPoint = {
        time: 0,
        x: firstPoint.x,
        y: firstPoint.y,
        velocity: firstPoint.velocity, // Use velocity from path itself
        acceleration: firstPoint.acceleration, // Use acceleration from path itself
        heading: initialRotation, 
      };
      setSimulationHistory([initialDataPoint]);
      setRobotState({
        x: firstPoint.x,
        y: firstPoint.y,
        rotation: initialRotation,
        velocity: firstPoint.velocity,
        angularVelocity: 0
      });
    }
    currentPathIndexRef.current = 0;
    simulatedTimeRef.current = 0;
    lastTimestampRef.current = null;
    setIsPlaying(true);
  };

  const stopPath = () => {
    setIsPlaying(false); // This will trigger cleanup in useEffect
  };

  useEffect(() => {
    if (!isPlaying || optimizedPath.length < 2) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      isPausedForStopPointRef.current = false; 
      return;
    }

    const simulationStep = (timestamp: number) => {
      if (isPausedForStopPointRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(simulationStep); // Keep requesting frame even if paused to allow resume
        return;
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
        animationFrameIdRef.current = requestAnimationFrame(simulationStep);
        return;
      }

      const deltaTime = ((timestamp - lastTimestampRef.current) / 1000) * simulationSpeedFactor;
      lastTimestampRef.current = timestamp;
      simulatedTimeRef.current += deltaTime;

      let newPathIndex = optimizedPath.findIndex(p => p.time >= simulatedTimeRef.current);

      if (newPathIndex === -1 && optimizedPath.length > 0 && simulatedTimeRef.current > optimizedPath[optimizedPath.length - 1].time) {
        newPathIndex = optimizedPath.length - 1; // Clamp to the last point
        const lastPoint = optimizedPath[newPathIndex];
        const finalDataPoint: SimulationDataPoint = {
          time: lastPoint.time, // Use actual last point time
          x: lastPoint.x,
          y: lastPoint.y,
          velocity: 0, // Assume 0 velocity at the very end
          acceleration: 0, // Assume 0 acceleration at the very end
          heading: lastPoint.heading || robotState.rotation, // Use path heading or last robot rotation
        };
        setSimulationHistory(prevHistory => addDataPointToHistory(prevHistory, finalDataPoint));
        setRobotState({
          x: lastPoint.x,
          y: lastPoint.y,
          rotation: finalDataPoint.heading,
          velocity: 0, 
          angularVelocity: 0
        });
        setIsPlaying(false);
        showMessage('info', 'Simulation finished!');
        return;
      }
      
      if (newPathIndex === -1) newPathIndex = 0; 

      currentPathIndexRef.current = newPathIndex;
      const currentPathPoint = optimizedPath[newPathIndex];

      if (!currentPathPoint) {
        setIsPlaying(false);
        showMessage('error', 'Error during simulation: Path point not found.');
        return;
      }

      let newRobotRotation = robotState.rotation;
      if (waypointSHeadings.length > 0) {
        const currentS = currentPathPoint.s;
        let prevTarget: {s: number, heading: number} | null = null;
        for (let i = waypointSHeadings.length - 1; i >= 0; i--) {
            if (waypointSHeadings[i].s <= currentS) {
                prevTarget = waypointSHeadings[i];
                break;
            }
        }
        let nextTarget: {s: number, heading: number} | null = null;
        for (let i = 0; i < waypointSHeadings.length; i++) {
            if (waypointSHeadings[i].s > currentS) {
                nextTarget = waypointSHeadings[i];
                break;
            }
        }
        if (prevTarget && nextTarget) {
            if (prevTarget.s < nextTarget.s && currentS >= prevTarget.s && currentS <= nextTarget.s) {
               const t = (currentS - prevTarget.s) / (nextTarget.s - prevTarget.s);
               newRobotRotation = interpolateAngleDeg(prevTarget.heading, nextTarget.heading, Math.max(0, Math.min(1, t)));
            } else { 
               newRobotRotation = prevTarget.heading;
            }
        } else if (prevTarget) {
            newRobotRotation = prevTarget.heading;
        } else if (nextTarget) { 
            newRobotRotation = nextTarget.heading;
        }
    }

      const liveDataPoint: SimulationDataPoint = {
        time: simulatedTimeRef.current,
        x: currentPathPoint.x,
        y: currentPathPoint.y,
        velocity: currentPathPoint.velocity,
        acceleration: currentPathPoint.acceleration,
        heading: newRobotRotation,
      };
      setSimulationHistory(prevHistory => addDataPointToHistory(prevHistory, liveDataPoint));

      let nearStopWaypoint = false;
      let actualStopWaypointData: Waypoint | undefined = undefined;

      if (waypoints.length > 0) {
        for (const wp of waypoints) {
          const distToWp = Math.sqrt((currentPathPoint.x - wp.x)**2 + (currentPathPoint.y - wp.y)**2);
          if (wp.stopAtWaypoint && distToWp < (wp.radius * 0.75)) { 
            nearStopWaypoint = true;
            actualStopWaypointData = wp;
            break; 
          }
        }
      }
      
      let currentWaypointIndex = -1;
      if(actualStopWaypointData) {
        currentWaypointIndex = waypoints.indexOf(actualStopWaypointData);
      }

      if (nearStopWaypoint && 
          currentPathPoint.velocity < 0.05 && 
          actualStopWaypointData && 
          lastStoppedWaypointIndexRef.current !== currentWaypointIndex
      ) {
        lastStoppedWaypointIndexRef.current = currentWaypointIndex;

        const stopStateHeading = actualStopWaypointData.heading !== undefined ? actualStopWaypointData.heading : currentPathPoint.heading || 0;
        setRobotState({
          x: currentPathPoint.x, 
          y: currentPathPoint.y,
          rotation: stopStateHeading,
          velocity: 0, 
          angularVelocity: 0
        });

        const stopDataPoint: SimulationDataPoint = {
          time: simulatedTimeRef.current,
          x: currentPathPoint.x,
          y: currentPathPoint.y,
          velocity: 0,
          acceleration: 0, 
          heading: stopStateHeading,
        };
        setSimulationHistory(prevHistory => addDataPointToHistory(prevHistory, stopDataPoint));
        
        const stopDurationToUse = actualStopWaypointData.stopDuration !== undefined 
                                  ? actualStopWaypointData.stopDuration 
                                  : config.waypoint.defaultStopDuration; // Fallback to global default

        const stopWpIndex = waypoints.indexOf(actualStopWaypointData) + 1;
        showMessage('info', `Stopping at Waypoint ${stopWpIndex} for ${stopDurationToUse.toFixed(1)}s`);
        isPausedForStopPointRef.current = true;
        setTimeout(() => {
          isPausedForStopPointRef.current = false; 
          lastTimestampRef.current = null; 
          if (isPlaying) { 
            animationFrameIdRef.current = requestAnimationFrame(simulationStep);
          }
        }, stopDurationToUse * 1000);
        return; 
      }

      if (!nearStopWaypoint || lastStoppedWaypointIndexRef.current !== currentWaypointIndex) {
        lastStoppedWaypointIndexRef.current = null;
      }

      setRobotState({ 
        x: currentPathPoint.x,
        y: currentPathPoint.y,
        rotation: newRobotRotation, 
        velocity: currentPathPoint.velocity,
        angularVelocity: 0
      });
      
      animationFrameIdRef.current = requestAnimationFrame(simulationStep);
    };

    if (isPlaying && !isPausedForStopPointRef.current) { 
      animationFrameIdRef.current = requestAnimationFrame(simulationStep);
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      lastTimestampRef.current = null; 
    };
  }, [isPlaying, optimizedPath, waypoints, config.waypoint.defaultStopDuration, simulationSpeedFactor, showMessage, interpolateAngleDeg, robotState.rotation, waypointSHeadings, config.robot.maxAcceleration, addDataPointToHistory]); // Added missing dependencies

  // Modified to take index directly for the new component
  const updateWaypointByIndex = (index: number, field: keyof Waypoint, value: any) => {
    if (index < 0 || index >= waypoints.length) return;
    const updated = [...waypoints];
    updated[index] = { ...updated[index], [field]: value };
    setWaypoints(updated);
  };

  // Drag handlers for the Waypoint Editor Popup
  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingEditor(true);
    setDragStartOffset({
      x: e.clientX - editorPosition.x,
      y: e.clientY - editorPosition.y,
    });
    e.preventDefault();
  };

  const handleEditorMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingEditor) return;
    setEditorPosition({
      x: e.clientX - dragStartOffset.x,
      y: e.clientY - dragStartOffset.y,
    });
  }, [isDraggingEditor, dragStartOffset]);

  const handleEditorMouseUp = useCallback(() => {
    setIsDraggingEditor(false);
  }, []);

  useEffect(() => {
    if (isDraggingEditor) {
      window.addEventListener('mousemove', handleEditorMouseMove);
      window.addEventListener('mouseup', handleEditorMouseUp);
    } else {
      window.removeEventListener('mousemove', handleEditorMouseMove);
      window.removeEventListener('mouseup', handleEditorMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleEditorMouseMove);
      window.removeEventListener('mouseup', handleEditorMouseUp);
    };
  }, [isDraggingEditor, handleEditorMouseMove, handleEditorMouseUp]);

  return (
    <div className="w-full h-screen bg-background-primary flex text-text-primary font-sans overflow-hidden relative"> {/* Added relative for positioning context */}
      {/* Main Canvas Area */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="bg-gradient-background rounded-xl shadow-2xl p-1 h-full flex flex-col from-background-secondary to-background-tertiary">
          {/* Header Section */}
          <div className="flex justify-between items-center mb-4 p-4 bg-background-secondary/50 rounded-t-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 min-w-0"> {/* Added min-w-0 here */}
              <input
                type="text"
                value={pathName}
                onChange={(e) => setPathName(e.target.value)}
                className="text-3xl font-accent bg-transparent border-none outline-none text-text-primary focus:ring-0 max-w-[16rem]" // Changed to max-w-[16rem]
              />
              {/* Waypoint counter and metrics are now direct children, inheriting gap-2 from parent */}
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
            
            <div className="flex gap-2"> {/* Removed flex-wrap here */}
              <div className="flex items-center gap-2"> {/* Reduced gap for closer button grouping */} 
                {/* Waypoint/Guide Point Toggle Segmented Control */}
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
                  onClick={() => setShowGraphs(true)}
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
             {/* Grid lines overlay could be added here if needed, or drawn on canvas itself */}
          </div>

          {/* Hidden file inputs for background image and path import */}
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
          onUpdateWaypoint={updateWaypointByIndex} // Pass the new handler
          onDeleteWaypoint={deleteWaypoint}
          onClose={() => setSelectedWaypoint(null)}
          editorPosition={editorPosition}
          onDragStart={handleEditorMouseDown}
        />
      )}

      {/* Sidebar */} 
      <div className={`w-96 bg-background-secondary shadow-xl p-6 space-y-5 overflow-y-auto transition-all duration-300 ease-in-out ${showConfig ? 'mr-0' : '-mr-96 opacity-0'}`}>
        
        {/* Config Editor */} 
        <div className="bg-background-tertiary/50 rounded-xl shadow-lg p-5 space-y-4 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-accent-primary">
              <Settings size={20} />
              Configuration
            </h3>
            
            {/* Field Config */}
            <div className="space-y-2 pt-3 border-t border-border-color/50">
              <h4 className="font-semibold text-text-secondary mt-2">Field Settings</h4>
              <ConfigInput label="Width" value={config.field.width} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, field: { ...prev.field, width: parseFloat(e.target.value) } }))} unit="m" className="mb-1" />
              <ConfigInput label="Height" value={config.field.height} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, field: { ...prev.field, height: parseFloat(e.target.value) } }))} unit="m" className="mb-1" />
              <ConfigInput label="Pixels/Meter" value={config.field.pixelsPerMeter} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, field: { ...prev.field, pixelsPerMeter: parseFloat(e.target.value) } }))} unit="px/m" className="mb-1" />
              <div className="flex items-center justify-between py-1">
                <label className="text-sm text-text-secondary">Show Grid:</label>
                <input type="checkbox" checked={config.field.showGrid} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, field: { ...prev.field, showGrid: e.target.checked } }))} className="mr-2 h-4 w-4 text-accent-primary rounded-sm focus:ring-accent-secondary bg-text-primary border-border-color" />
              </div>
              <ConfigInput label="Grid Spacing" value={config.field.gridSpacing} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, field: { ...prev.field, gridSpacing: parseFloat(e.target.value) } }))} unit="m" className="mb-1" />
            </div>

            {/* Robot Config */}
            <div className="space-y-2 pt-3 border-t border-border-color/50">
              <h4 className="font-semibold text-text-secondary mt-2">Robot Settings</h4>
              <ConfigInput label="Radius" value={config.robot.radius} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, radius: parseFloat(e.target.value) } }))} unit="m" className="mb-1" />
              <ConfigInput label="Mass" value={config.robot.mass} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, mass: parseFloat(e.target.value) } }))} unit="kg" className="mb-1" />
              <ConfigInput label="Max Velocity" value={config.robot.maxVelocity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, maxVelocity: parseFloat(e.target.value) } }))} unit="m/s" className="mb-1" />
              <ConfigInput label="Max Acceleration" value={config.robot.maxAcceleration} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, maxAcceleration: parseFloat(e.target.value) } }))} unit="m/s²" className="mb-1" />
              <ConfigInput label="Max Angular Velocity" value={config.robot.maxAngularVelocity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, maxAngularVelocity: parseFloat(e.target.value) } }))} unit="deg/s" className="mb-1" />
              <ConfigInput label="Max Angular Acceleration" value={config.robot.maxAngularAcceleration} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, robot: { ...prev.robot, maxAngularAcceleration: parseFloat(e.target.value) } }))} unit="deg/s²" className="mb-1" />
            </div>
          </div>

        {/* Waypoint List Container */}
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
                    <div key={index} onClick={() => setSelectedWaypoint(index)} className={`p-3 rounded-lg cursor-pointer flex justify-between items-center group ${selectedWaypoint === index ? 'bg-gradient-accent text-white shadow-lg transform scale-105' : 'bg-background-primary text-text-primary hover:bg-accent-secondary hover:text-white hover:shadow-md'}`}>
                        <div>
                          <div className="font-medium">Waypoint {index + 1}</div>
                          <div className="text-xs opacity-80">
                            ({wp.x.toFixed(1)}, {wp.y.toFixed(1)}) • {velocityDisplay}
                            {wp.heading !== undefined ? ` • ${wp.heading.toFixed(0)}°` : ''}
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

      </div> {/* Closes the sidebar div */}

      {/* Message Box */}
      {message && (
        <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-xl text-white text-sm z-50 transform transition-all duration-300 ease-in-out hover:scale-105 ${message.type === 'error' ? 'bg-error-color' : 'bg-gradient-accent'}`}>
          {message.text}
        </div>
      )}

      {/* Simulation Graphs Pop-out */}
      {showGraphs && <SimulationGraphs history={simulationHistory} onClose={() => setShowGraphs(false)} />}
    </div> 
  );
};

export default HolonomicPathOptimizer;
