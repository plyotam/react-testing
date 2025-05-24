import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Upload, Settings, Play, RotateCcw, Trash2, Image, Zap, Target, Square, BarChart2 } from 'lucide-react';
import { CubicSpline } from './utils/CubicSpline';
import { QuinticSpline } from './utils/QuinticSpline';
import ConfigInput from './components/ConfigInput';
import { Waypoint } from './types/Waypoint';
import SimulationGraphs from './components/SimulationGraphs';

// Add this interface
interface SimulationDataPoint {
  time: number;
  x: number;
  y: number;
  velocity: number;
  acceleration: number;
  heading: number;
}

const HolonomicPathOptimizer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  
  // Enhanced default configuration with physics parameters
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
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]); // Use the Waypoint interface
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

  // Animation frame ID ref
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const currentPathIndexRef = useRef<number>(0);
  const simulatedTimeRef = useRef<number>(0);
  const isPausedForStopPointRef = useRef<boolean>(false);
  const lastStoppedWaypointIndexRef = useRef<number | null>(null);

  // Function to display temporary messages (replaces alert)
  const showMessage = useCallback((type: 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000); // Clear after 3 seconds
  }, []);

  // Convert between meters and pixels
  const metersToPixels = useCallback((meters: number) => meters * config.field.pixelsPerMeter, [config.field.pixelsPerMeter]);
  const pixelsToMeters = useCallback((pixels: number) => pixels / config.field.pixelsPerMeter, [config.field.pixelsPerMeter]);
  
  // Helper functions for angle interpolation
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

  // Generate optimal spline path with physics constraints
  const generateOptimalPath = useCallback((waypoints: Waypoint[]) => {
    if (waypoints.length < 2) return [];
    
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
    
    // Calculate cumulative distances (s_coords for splines)
    const s_coords = [0];
    for (let i = 1; i < waypoints.length; i++) {
      const dx = waypoints[i].x - waypoints[i-1].x;
      const dy = waypoints[i].y - waypoints[i-1].y;
      s_coords.push(s_coords[s_coords.length - 1] + Math.sqrt(dx*dx + dy*dy));
    }
    
    let xSpline, ySpline;
    const waypointXCoords = waypoints.map(wp => wp.x);
    const waypointYCoords = waypoints.map(wp => wp.y);

    if (config.path.splineType === 'quintic') {
      xSpline = new QuinticSpline(s_coords, waypointXCoords);
      ySpline = new QuinticSpline(s_coords, waypointYCoords);
    } else {
      xSpline = new CubicSpline(s_coords, waypointXCoords);
      ySpline = new CubicSpline(s_coords, waypointYCoords);
    }
    
    const totalDistance = s_coords[s_coords.length - 1];
    metrics.totalDistance = totalDistance;
    
    const pathResolution = config.path.pathResolution;
    const numPoints = totalDistance > 0 ? Math.ceil(totalDistance / pathResolution) : 0;
    
    let accumulatedTime = 0;

    // Generate first point (s=0)
    if (numPoints >= 0) { // Should always be true if totalDistance >= 0
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

      if (waypoints.length > 0) { // Check if waypoints exist before accessing waypoints[0]
        const firstWaypoint = waypoints[0];
        const distToFirstWp = Math.sqrt((x0 - firstWaypoint.x)**2 + (y0 - firstWaypoint.y)**2);

        if (distToFirstWp < firstWaypoint.radius) { // Only apply waypoint constraints if s=0 is within its radius
          if (firstWaypoint.stopAtWaypoint) {
            const criticalStopDist = config.path.pathResolution * 2.0; // Increased critical distance
            if (distToFirstWp < criticalStopDist) {
              v0 = 0.0; // Force stop if critically close
            } else {
              const distTarget = Math.max(0, distToFirstWp - 0.01); // Aim to stop slightly before center
              const decelToStopV = Math.sqrt(2 * config.robot.maxAcceleration * distTarget);
              v0 = Math.min(v0, decelToStopV);
            }
          } else {
            let wpMax = v0; // Start with curvature-limited/robot max velocity
            if (firstWaypoint.maxVelocityConstraint !== undefined) {
              wpMax = Math.min(wpMax, firstWaypoint.maxVelocityConstraint);
            }
            if (firstWaypoint.targetVelocity !== undefined) {
              v0 = Math.min(wpMax, firstWaypoint.targetVelocity);
            } else {
              v0 = wpMax; // Use the constrained max if no target
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

      let nearestWaypointIndex = 0;
      let minDistToWaypoint = Infinity;
      for (let j = 0; j < waypoints.length; j++) {
        const distSq = (x - waypoints[j].x)**2 + (y - waypoints[j].y)**2;
        if (distSq < minDistToWaypoint**2) {
          minDistToWaypoint = Math.sqrt(distSq);
          nearestWaypointIndex = j;
        }
      }
      const nearestWaypoint = waypoints[nearestWaypointIndex];

      // Step 1: Preemptive Hard Stop Check
      // Ensure the hard stop is generated within a zone the simulation will also recognize.
      const simNearDist = nearestWaypoint.radius * 0.70; // Simulation checks < wp.radius * 0.75
      const pathGenStopDist = config.path.pathResolution * 2.0;
      const effectiveStopDist = Math.min(simNearDist, pathGenStopDist);

      const isHardStopPoint = 
        nearestWaypoint.stopAtWaypoint &&
        minDistToWaypoint < effectiveStopDist;

      let v_achieved;
      let currentAcceleration;
      let segmentTime;

      const prevPoint = path[path.length - 1];
      const v_prev = prevPoint.velocity;
      const segmentDx = x - prevPoint.x;
      const segmentDy = y - prevPoint.y;
      const d_s = Math.sqrt(segmentDx**2 + segmentDy**2);

      if (isHardStopPoint) {
        v_achieved = 0.0;
        // Acceleration and time to achieve this hard stop from v_prev over d_s
        if (d_s < 1e-6) { // No distance to change velocity
            currentAcceleration = 0;
            // If v_prev was also 0, time is arbitrary small, else if v_prev non-zero, means infinite accel (will be clamped)
            segmentTime = 0.001; 
        } else {
            // a = (v_f^2 - v_i^2) / (2d)
            currentAcceleration = (v_achieved**2 - v_prev**2) / (2 * d_s);
        }
      } else {
        // Not a hard stop point, calculate kinematically
        let targetVelocityForKinematics = config.robot.maxVelocity;
        if (curvature > 0.001) {
          targetVelocityForKinematics = Math.min(targetVelocityForKinematics, Math.sqrt(config.robot.maxAcceleration / curvature));
        }

        if (nearestWaypoint.stopAtWaypoint) {
          // For stop waypoints, calculate a zone of influence for deceleration.
          const requiredStoppingDistance = (v_prev > 0.1) ? (v_prev * v_prev) / (2 * config.robot.maxAcceleration) : 0; // Dist needed to stop from v_prev
          const adaptiveLookahead = Math.min(requiredStoppingDistance * 1.5, config.robot.maxVelocity * 1.0);
          const stopInfluenceZone = Math.max(nearestWaypoint.radius, adaptiveLookahead);

          if (minDistToWaypoint < stopInfluenceZone) { // Apply this decel logic only if within the broader influence zone
            // Calculate the distance from the current point to the edge of the "hard stop" zone.
            // effectiveStopDist is defined near the start of the loop for isHardStopPoint check.
            const distanceToHardStopEdge = Math.max(0, minDistToWaypoint - effectiveStopDist);
            
            // Calculate the velocity the robot should have at the current point
            // to be able to decelerate to zero by the time it reaches the hard stop zone's edge.
            const velocityToNaturallyStopAtHardStopEdge = Math.sqrt(2 * config.robot.maxAcceleration * distanceToHardStopEdge);
            
            targetVelocityForKinematics = Math.min(targetVelocityForKinematics, velocityToNaturallyStopAtHardStopEdge);
          }
        } else { // It's a non-stop waypoint
          if (minDistToWaypoint < nearestWaypoint.radius) { // Apply constraints only if within the waypoint's radius
            if (nearestWaypoint.maxVelocityConstraint !== undefined) {
              targetVelocityForKinematics = Math.min(targetVelocityForKinematics, nearestWaypoint.maxVelocityConstraint);
            }
            if (nearestWaypoint.targetVelocity !== undefined) {
              targetVelocityForKinematics = Math.min(targetVelocityForKinematics, nearestWaypoint.targetVelocity);
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
          // Recalculate acceleration based on v_achieved
          currentAcceleration = (v_achieved**2 - v_prev**2) / (2*d_s);
        }
      }
      
      // Clamp acceleration for all cases (hard stop or kinematic)
      currentAcceleration = Math.max(-config.robot.maxAcceleration, Math.min(config.robot.maxAcceleration, currentAcceleration));
      metrics.maxAcceleration = Math.max(metrics.maxAcceleration, Math.abs(currentAcceleration));

      // Calculate segmentTime for all cases
      if (d_s < 1e-6) { // Points effectively coincident
          segmentTime = 0.001; // Minimal time
      } else if (Math.abs(currentAcceleration) > 1e-4) { // Normal case: accelerate/decelerate
        segmentTime = (v_achieved - v_prev) / currentAcceleration;
      } else if (Math.abs(v_achieved - v_prev) < 1e-4 && (v_achieved + v_prev > 1e-4)) { // Constant non-zero speed (or negligible change at non-zero speed)
         segmentTime = (2 * d_s) / (v_achieved + v_prev);
      } else if (Math.abs(v_achieved) < 1e-3 && Math.abs(v_prev) < 1e-3) { // Both current and previous points are effectively stopped
         segmentTime = 0.02; // Small fixed time for a "stopped" segment, prevents huge times if d_s is pathResolution
      } else { // Fallback for other near-zero velocity/acceleration cases. 
               // E.g. v_prev is non-zero, v_achieved is zero (hard stop), but accel calc was already ~0 (implies v_prev was already ~0).
               // Or v_prev is zero, v_achieved is non-zero, but accel calc was ~0 (should not happen if d_s > 0).
        segmentTime = 0.02; // Default to a small fixed time if in an ambiguous low-speed, low-accel state.
      }
      
      // Cleanup segmentTime
      if (segmentTime <= 1e-5 && d_s > 1e-6) { // Prevent extremely small/zero time if distance was covered
          segmentTime = 1e-5; 
          if (Math.abs(v_achieved - v_prev) > 1e-4) {
            currentAcceleration = (v_achieved - v_prev) / segmentTime;
            currentAcceleration = Math.max(-config.robot.maxAcceleration, Math.min(config.robot.maxAcceleration, currentAcceleration));
          } else {
            currentAcceleration = 0;
            // v_achieved = v_prev; // Velocity wouldn't change if no accel over forced tiny time
          }
      }
      // Ensure time is not negative if velocities cause issues with (vf-vi)/a calculation
      if (segmentTime < 0) segmentTime = Math.abs(segmentTime);


      accumulatedTime += segmentTime;
      
      const avgVelForEnergy = (v_achieved + v_prev) / 2;
      const power = config.robot.mass * Math.abs(currentAcceleration) * Math.abs(avgVelForEnergy) + 
                   0.5 * config.physics.frictionCoefficient * config.robot.mass * 9.81 * Math.abs(avgVelForEnergy);
      if (segmentTime > 1e-5) metrics.energyConsumption += Math.abs(power) * segmentTime;

      path.push({
        x, y, s,
        velocity: v_achieved,
        acceleration: currentAcceleration,
        curvature,
        heading,
        time: accumulatedTime
      });
    }
    
    metrics.totalTime = accumulatedTime;
    setOptimizationMetrics(metrics);
    
    return path;
  }, [config]);

  // Update optimized path when waypoints or config change
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

  // Effect to load default background image on mount
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

  // Draw everything on canvas
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
      ctx.strokeStyle = isSelected ? config.path.selectedColor : config.path.waypointBorderColor;
      ctx.fillStyle = isSelected ? config.path.selectedColor + '20' : config.path.waypointColor + '20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pixelX, pixelY, pixelRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Draw waypoint center
      ctx.fillStyle = isSelected ? config.path.selectedColor : config.path.waypointColor;
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

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    const x = pixelsToMeters(pixelX);
    const y = pixelsToMeters(pixelY);
    
    // Check if clicking on existing waypoint
    const clickedWaypoint = waypoints.findIndex(wp => {
      const distance = Math.sqrt((wp.x - x) ** 2 + (wp.y - y) ** 2);
      return distance <= wp.radius;
    });
    
    if (clickedWaypoint !== -1) {
      setSelectedWaypoint(clickedWaypoint);
    } else {
      // Add new waypoint
      const newWaypoint: Waypoint = {
        x,
        y,
        radius: config.waypoint.defaultRadius,
        targetVelocity: config.waypoint.defaultTargetVelocity,
        heading: config.waypoint.defaultHeading,
        stopAtWaypoint: config.waypoint.stopAtWaypoint,
        stopDuration: config.waypoint.stopAtWaypoint ? config.waypoint.defaultStopDuration : undefined,
      };
      setWaypoints([...waypoints, newWaypoint]);
      setSelectedWaypoint(waypoints.length);
    }
  };

  // Update selected waypoint
  const updateWaypoint = (field: keyof Waypoint, value: Waypoint[keyof Waypoint]) => {
    if (selectedWaypoint === null) return;
    
    const updated = [...waypoints];
    // Type assertion to bypass potential TypeScript strictness on dynamic key access
    updated[selectedWaypoint] = { ...updated[selectedWaypoint], [field]: value as any }; 
    setWaypoints(updated);
  };

  // Delete waypoint
  const deleteWaypoint = (index: number) => {
    const updated = waypoints.filter((_, i) => i !== index);
    setWaypoints(updated);
    setSelectedWaypoint(null);
  };

  // Clear all waypoints
  const clearPath = () => {
    setWaypoints([]);
    setSelectedWaypoint(null);
    setIsPlaying(false);
    setOptimizedPath([]);
    setOptimizationMetrics(null);
  };

  // Export path
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

  // Import path
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

  // Load background image
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

  // Play animation with physics simulation
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

  // Stop animation
  const stopPath = () => {
    setIsPlaying(false); // This will trigger cleanup in useEffect
  };

  // Animation Loop managed by useEffect
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
  }, [isPlaying, optimizedPath, waypoints, config.waypoint.defaultStopDuration, simulationSpeedFactor, showMessage, interpolateAngleDeg, robotState.rotation, waypointSHeadings, config.robot.maxAcceleration]); // Added missing dependencies

  // Helper function to add data points to history without duplicates by time
  const addDataPointToHistory = (history: SimulationDataPoint[], newDataPoint: SimulationDataPoint): SimulationDataPoint[] => {
    if (history.length === 0 || history[history.length - 1].time < newDataPoint.time) {
      return [...history, newDataPoint];
    } else if (history[history.length - 1].time === newDataPoint.time) {
      // Optional: Update the last point if time is the same, or just keep the old one
      // For simplicity, we'll keep the old one if time hasn't advanced.
      // If updates are needed: return [...history.slice(0, -1), newDataPoint];
      return history; 
    }
    return history; // Should not be reached if time is decreasing, but as a fallback
  };

  return (
    <div className="w-full h-screen bg-background-primary flex text-text-primary font-sans overflow-hidden">
      {/* Main Canvas Area */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="bg-gradient-background rounded-xl shadow-2xl p-1 h-full flex flex-col from-background-secondary to-background-tertiary">
          {/* Header Section */}
          <div className="flex justify-between items-center mb-4 p-4 bg-background-secondary/50 rounded-t-lg backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={pathName}
                onChange={(e) => setPathName(e.target.value)}
                className="text-3xl font-accent bg-transparent border-none outline-none text-text-primary focus:ring-0"
              />
              <div className="text-sm text-text-secondary">
                {waypoints.length} waypoints
                {optimizationMetrics && (
                  <span className="ml-2">
                    • {optimizationMetrics.totalDistance.toFixed(2)}m 
                    • {optimizationMetrics.totalTime.toFixed(2)}s
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowGraphs(true)}
                title="Show Simulation Graphs"
                className="p-2 bg-background-tertiary text-text-secondary rounded-lg hover:bg-accent-primary hover:text-white transform hover:scale-105 shadow-md"
              >
                <BarChart2 size={20} />
              </button>
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
          
          {/* Canvas Container */}
          <div className="bg-background-primary/70 rounded-lg m-4 p-2 flex-grow flex items-center justify-center relative overflow-hidden">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
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

            {/* Path Config */}
            <div className="space-y-2 pt-3 border-t border-border-color/50">
              <h4 className="font-semibold text-text-secondary mt-2">Path Settings</h4>
              <div className="flex items-center justify-between py-1">
                <label className="text-sm text-text-secondary">Spline Type:</label>
                <select 
                  value={config.path.splineType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConfig(prev => ({ ...prev, path: { ...prev.path, splineType: e.target.value as 'cubic' | 'quintic' } }))}
                  className="px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none"
                >
                  <option value="cubic">Cubic</option>
                  <option value="quintic">Quintic</option>
                </select>
              </div>
              <ConfigInput label="Path Resolution" value={config.path.pathResolution} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, path: { ...prev.path, pathResolution: parseFloat(e.target.value) } }))} unit="m" step={0.01} className="mb-1" />
              <ConfigInput label="Optimization Iterations" value={config.path.optimizationIterations} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, path: { ...prev.path, optimizationIterations: parseInt(e.target.value) } }))} type="number" step="1" min={1} className="mb-1" />
              <div className="flex items-center justify-between py-1">
                <label className="text-sm text-text-secondary">Velocity Optimization:</label>
                <input type="checkbox" checked={config.path.velocityOptimization} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, path: { ...prev.path, velocityOptimization: e.target.checked } }))} className="mr-2 h-4 w-4 text-accent-primary rounded-sm focus:ring-accent-secondary bg-text-primary border-border-color" />
              </div>
              <ConfigInput label="Curvature Limit" value={config.path.curvatureLimit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, path: { ...prev.path, curvatureLimit: parseFloat(e.target.value) } }))} unit="1/m" step={0.1} min={0.1} className="mb-1" />
              <div className="flex items-center justify-between py-1">
                <label className="text-sm text-text-secondary">Velocity Viz.:</label>
                <input type="checkbox" checked={config.path.velocityVisualization} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, path: { ...prev.path, velocityVisualization: e.target.checked } }))} className="mr-2 h-4 w-4 text-accent-primary rounded-sm focus:ring-accent-secondary bg-text-primary border-border-color" />
              </div>
            </div>

            {/* Physics Config */}
            <div className="space-y-2 pt-3 border-t border-border-color/50">
              <h4 className="font-semibold text-text-secondary mt-2">Physics Settings</h4>
              <ConfigInput label="Friction Coefficient" value={config.physics.frictionCoefficient} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, physics: { ...prev.physics, frictionCoefficient: parseFloat(e.target.value) } }))} step="0.01" min={0} max={1} className="mb-1" />
              <ConfigInput label="Wheelbase" value={config.physics.wheelbase} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, physics: { ...prev.physics, wheelbase: parseFloat(e.target.value) } }))} unit="m" step={0.01} min={0.1} className="mb-1" />
              <ConfigInput label="Track Width" value={config.physics.trackWidth} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setConfig(prev => ({ ...prev, physics: { ...prev.physics, trackWidth: parseFloat(e.target.value) } })); }} unit="m" step={0.01} min={0.1} className="mb-1" />
              <ConfigInput label="Moment of Inertia" value={config.physics.momentOfInertia} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setConfig(prev => ({ ...prev, physics: { ...prev.physics, momentOfInertia: parseFloat(e.target.value) } })); }} unit="kg⋅m²" step={0.1} min={0.1} className="mb-1" />
            </div>
        </div> 

        {/* Optimization Metrics */}
        {optimizationMetrics && (
          <div className="bg-background-tertiary/50 rounded-xl shadow-lg p-5 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-accent-primary">
              <Zap size={20} />
              Path Optimization
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary">Total Distance:</span><span className="text-text-primary">{optimizationMetrics.totalDistance.toFixed(2)} m</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Total Time:</span><span className="text-text-primary">{optimizationMetrics.totalTime.toFixed(2)} s</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Avg Speed:</span><span className="text-text-primary">{(optimizationMetrics.totalDistance / (optimizationMetrics.totalTime || 1)).toFixed(2)} m/s</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Max Curvature:</span><span className="text-text-primary">{optimizationMetrics.maxCurvature.toFixed(3)} 1/m</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Max Acceleration:</span><span className="text-text-primary">{optimizationMetrics.maxAcceleration.toFixed(2)} m/s²</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Energy Est.:</span><span className="text-text-primary">{optimizationMetrics.energyConsumption.toFixed(1)} J</span></div>
            </div>
          </div>
        )}
        
        {/* Waypoint Editor */}
        <div className="bg-background-tertiary/50 rounded-xl shadow-lg p-5 backdrop-blur-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-accent-primary">
            <Target size={20} />
            Waypoint Editor
          </h3>
          {selectedWaypoint !== null && waypoints[selectedWaypoint] ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-text-primary">Waypoint {selectedWaypoint + 1}</span>
                <button onClick={() => deleteWaypoint(selectedWaypoint)} title="Delete Waypoint" className="text-red-400 hover:text-error-color p-1 rounded-md hover:bg-background-primary/50 transform hover:scale-110">
                  <Trash2 size={20} />
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-text-secondary">Position (m)</label>
                <div className="flex gap-2">
                  <input type="number" step="0.1" value={waypoints[selectedWaypoint].x.toFixed(2)} onChange={(e) => updateWaypoint('x', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none" />
                  <input type="number" step="0.1" value={waypoints[selectedWaypoint].y.toFixed(2)} onChange={(e) => updateWaypoint('y', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-text-secondary">Radius: {waypoints[selectedWaypoint].radius.toFixed(2)}m</label>
                <input type="range" min={config.waypoint.minRadius} max={config.waypoint.maxRadius} step="0.1" value={waypoints[selectedWaypoint].radius} onChange={(e) => updateWaypoint('radius', parseFloat(e.target.value))} className="w-full h-3 bg-background-primary rounded-lg appearance-none cursor-pointer accent-accent-primary" />
              </div>

              {/* New Velocity Inputs */}
              <div>
                <label className="block text-sm font-medium mb-1 text-text-secondary">Target Velocity (m/s)</label>
                <input 
                  type="number" step="0.1" 
                  value={waypoints[selectedWaypoint].targetVelocity !== undefined ? waypoints[selectedWaypoint].targetVelocity!.toFixed(1) : ''} 
                  onChange={(e) => updateWaypoint('targetVelocity', e.target.value ? parseFloat(e.target.value) : undefined)} 
                  className="w-full px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none"
                  placeholder="Optional (e.g., 1.5)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-text-secondary">Max Velocity Constraint (m/s)</label>
                <input 
                  type="number" step="0.1" 
                  value={waypoints[selectedWaypoint].maxVelocityConstraint !== undefined ? waypoints[selectedWaypoint].maxVelocityConstraint!.toFixed(1) : ''} 
                  onChange={(e) => updateWaypoint('maxVelocityConstraint', e.target.value ? parseFloat(e.target.value) : undefined)} 
                  className="w-full px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none"
                  placeholder={`Optional (e.g., ${config.robot.maxVelocity.toFixed(1)})`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-text-secondary">Target Heading (°)</label>
                <div className="flex gap-2">
                  <input type="number" value={waypoints[selectedWaypoint].heading !== undefined ? waypoints[selectedWaypoint].heading : ''} onChange={(e) => updateWaypoint('heading', e.target.value ? parseFloat(e.target.value) : undefined)} className="flex-1 px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none" placeholder="Optional" min="-180" max="180" />
                  <button onClick={() => updateWaypoint('heading', undefined)} className="px-3 py-1.5 bg-accent-secondary rounded-md text-sm hover:bg-accent-primary text-text-primary shadow-sm transform hover:scale-105"> Clear </button>
                </div>
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-text-secondary">
                  <input type="checkbox" checked={waypoints[selectedWaypoint].stopAtWaypoint || false} onChange={(e) => {
                    const checked = e.target.checked;
                    updateWaypoint('stopAtWaypoint', checked);
                    if (checked && waypoints[selectedWaypoint].stopDuration === undefined) {
                      updateWaypoint('stopDuration', config.waypoint.defaultStopDuration);
                    } else if (!checked) {
                      // Optionally clear stopDuration when unchecked
                      // updateWaypoint('stopDuration', undefined); 
                    }
                  }} className="mr-2 h-4 w-4 text-accent-primary rounded-sm focus:ring-accent-secondary bg-background-primary border-border-color/50" />
                  Stop at Waypoint
                </label>
              </div>

              {waypoints[selectedWaypoint].stopAtWaypoint && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-text-secondary">Stop Duration (s)</label>
                  <input 
                    type="number" step="0.1" min="0" 
                    value={waypoints[selectedWaypoint].stopDuration !== undefined ? waypoints[selectedWaypoint].stopDuration!.toFixed(1) : config.waypoint.defaultStopDuration.toFixed(1)} 
                    onChange={(e) => updateWaypoint('stopDuration', e.target.value ? parseFloat(e.target.value) : config.waypoint.defaultStopDuration)} 
                    className="w-full px-3 py-2 border border-border-color/50 rounded-md text-sm bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none" 
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-text-secondary text-sm">Click on a waypoint or canvas to select/add.</p>
          )}
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
