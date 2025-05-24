import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Upload, Settings, Play, RotateCcw, Trash2, Image, Zap, Target, Square } from 'lucide-react';
import { CubicSpline } from './utils/CubicSpline';
import ConfigInput from './components/ConfigInput';
import { Waypoint } from './types/Waypoint';

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
      defaultVelocity: 2.0, // m/s
      minRadius: 0.1,
      maxRadius: 2.0,
      minVelocity: 0.1,
      maxVelocity: 4.0,
      defaultHeading: 0, // degrees
      stopAtWaypoint: false,
      stopDuration: 1.0 // seconds, new default for how long to pause at a stop waypoint
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
  const [showConfig, setShowConfig] = useState(false);
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
    
    // Calculate cumulative distances
    const distances = [0];
    for (let i = 1; i < waypoints.length; i++) {
      const dx = waypoints[i].x - waypoints[i-1].x;
      const dy = waypoints[i].y - waypoints[i-1].y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      distances.push(distances[distances.length - 1] + dist);
    }
    
    // Create splines for x and y coordinates
    const xSpline = new CubicSpline(distances, waypoints.map(wp => wp.x));
    const ySpline = new CubicSpline(distances, waypoints.map(wp => wp.y));
    
    const totalDistance = distances[distances.length - 1];
    metrics.totalDistance = totalDistance;
    
    // Generate path points with physics-based velocity profile
    const pathResolution = config.path.pathResolution;
    const numPoints = Math.ceil(totalDistance / pathResolution);
    
    let accumulatedTime = 0;

    for (let i = 0; i <= numPoints; i++) {
      const s = (i / numPoints) * totalDistance;
      const x = xSpline.interpolate(s);
      const y = ySpline.interpolate(s);
      
      // Calculate derivatives for curvature and heading
      const dx_ds = xSpline.derivative(s);
      const dy_ds = ySpline.derivative(s);
      const d2x_ds2 = xSpline.secondDerivative(s);
      const d2y_ds2 = ySpline.secondDerivative(s);
      
      // Calculate curvature κ = |x'y'' - y'x''| / (x'² + y'²)^(3/2)
      const curvature = Math.abs(dx_ds * d2y_ds2 - dy_ds * d2x_ds2) / 
                       Math.pow(dx_ds * dx_ds + dy_ds * dy_ds, 1.5);
      
      metrics.maxCurvature = Math.max(metrics.maxCurvature, curvature);
      
      // Calculate heading
      const heading = Math.atan2(dy_ds, dx_ds) * 180 / Math.PI;
      
      // Find nearest waypoint for velocity constraints
      let nearestWaypointIndex = 0;
      let minDistToWaypoint = Infinity;
      for (let j = 0; j < waypoints.length; j++) {
        const distToWp = Math.sqrt((x - waypoints[j].x)**2 + (y - waypoints[j].y)**2);
        if (distToWp < minDistToWaypoint) {
          minDistToWaypoint = distToWp;
          nearestWaypointIndex = j;
        }
      }
      
      // Physics-based velocity calculation
      let maxVelocityAtPoint = config.robot.maxVelocity;
      
      // Curvature-limited velocity: v = sqrt(a_max / κ)
      if (curvature > 0.001) {
        const curvatureVelocity = Math.sqrt(config.robot.maxAcceleration / curvature);
        maxVelocityAtPoint = Math.min(maxVelocityAtPoint, curvatureVelocity);
      }
      
      // Waypoint velocity constraints
      const nearestWaypoint = waypoints[nearestWaypointIndex];
      if (minDistToWaypoint < nearestWaypoint.radius) {
        if (nearestWaypoint.stopAtWaypoint) {
          maxVelocityAtPoint = 0;
        } else {
          maxVelocityAtPoint = Math.min(maxVelocityAtPoint, nearestWaypoint.velocity);
        }
      }
      
      let calculatedAcceleration = 0; // Renamed to avoid conflict with path point field
      let segmentTime = 0;

      if (path.length > 0) { // If not the first point
        const prevPoint = path[path.length - 1];
        const prevVelocity = prevPoint.velocity;
        const sumOfVelocities = prevVelocity + maxVelocityAtPoint;

        if (Math.abs(sumOfVelocities) < 0.002) { // If sum is very small (average velocity is < 0.001 m/s)
          segmentTime = 0.01; // Assign a small, fixed time step to prevent division by zero/tiny number.
                                // This covers (0,0) or (v_small, -v_small_opposite) cases.
          if (segmentTime > 0.0001 && Math.abs(maxVelocityAtPoint - prevVelocity) > 0.0001) {
             calculatedAcceleration = (maxVelocityAtPoint - prevVelocity) / segmentTime;
          } else {
             calculatedAcceleration = 0; // No significant velocity change or time step too small for meaningful accel.
          }
        } else { // Sum of velocities is not negligible
          segmentTime = (2 * pathResolution) / sumOfVelocities; 
          // Ensure segmentTime is positive. If sumOfVelocities is negative (moving backward overall for segment),
          // time should still be positive. The path generator should ideally ensure velocities for forward motion.
          if (segmentTime < 0) {
            // This case implies prevVelocity and maxVelocityAtPoint are such that their sum is negative,
            // and pathResolution is positive. E.g. prevV=-1, maxV=-1. sum=-2. time = 2*0.05 / -2 = -0.05.
            // This means robot is moving backward. Time should be positive. Accel direction will be handled by (Vf-Vi).
            segmentTime = Math.abs(segmentTime);
            // If segmentTime became 0 due to pathResolution being 0 (not expected), handle it.
            if (segmentTime < 0.0001) segmentTime = 0.01;
          }

          if (segmentTime > 0.0001) { // Avoid division by zero if segmentTime is effectively zero
            calculatedAcceleration = (maxVelocityAtPoint - prevVelocity) / segmentTime;
          } else if (Math.abs(maxVelocityAtPoint - prevVelocity) < 0.001) {
            calculatedAcceleration = 0; // No change in velocity, segmentTime is zero
          } else {
            // Velocity changed with (near) zero time -> infinite acceleration, so clamp
            calculatedAcceleration = (maxVelocityAtPoint > prevVelocity ? 1 : -1) * config.robot.maxAcceleration;
            if(segmentTime <= 0.0001) segmentTime = 0.01; // ensure some time passes if accel occurs
          }
        }
        
        // Clamp acceleration
        calculatedAcceleration = Math.max(-config.robot.maxAcceleration, 
                               Math.min(config.robot.maxAcceleration, calculatedAcceleration));
        metrics.maxAcceleration = Math.max(metrics.maxAcceleration, Math.abs(calculatedAcceleration));
      } else { // First point in the path
        segmentTime = 0; // No time elapsed to reach the first point itself from a conceptual previous one.
        calculatedAcceleration = 0; // Assume it starts with the first waypoint's velocity, or from rest.
                                    // If first waypoint has vel > 0, path implicitly starts there.
      }
      
      accumulatedTime += segmentTime;

      // Energy consumption estimation (simplified)
      const avgVelocityForEnergy = (maxVelocityAtPoint + (path.length > 0 ? path[path.length-1].velocity : maxVelocityAtPoint))/2;
      const power = config.robot.mass * Math.abs(calculatedAcceleration) * Math.abs(avgVelocityForEnergy) + 
                   0.5 * config.physics.frictionCoefficient * config.robot.mass * 9.81 * Math.abs(avgVelocityForEnergy);
      if (segmentTime > 0.0001) { // Only add energy if a meaningful time has passed
          metrics.energyConsumption += Math.abs(power) * segmentTime;
      }
      
      path.push({
        x, y, s,
        velocity: maxVelocityAtPoint,
        acceleration: calculatedAcceleration, // Use the correctly scoped and calculated variable
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
    } else {
      setOptimizedPath([]);
      setOptimizationMetrics(null);
    }
  }, [waypoints, generateOptimalPath]);

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
      
      // Draw waypoint label with velocity
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(`${index + 1}`, pixelX, pixelY - pixelRadius - 15);
      ctx.fillText(`${index + 1}`, pixelX, pixelY - pixelRadius - 15);
      
      ctx.font = '10px sans-serif';
      ctx.strokeText(`${waypoint.velocity.toFixed(1)}m/s`, pixelX, pixelY - pixelRadius - 5);
      ctx.fillText(`${waypoint.velocity.toFixed(1)}m/s`, pixelX, pixelY - pixelRadius - 5);
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    const wheelbasePixels = metersToPixels(config.physics.wheelbase);
    const trackWidthPixels = metersToPixels(config.physics.trackWidth);
    
    ctx.beginPath();
    ctx.rect(pixelX - wheelbasePixels/2, pixelY - trackWidthPixels/2, 
             wheelbasePixels, trackWidthPixels);
    ctx.stroke();
    
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
      const newWaypoint: Waypoint = { // Explicitly type newWaypoint
        x,
        y,
        radius: config.waypoint.defaultRadius,
        velocity: config.waypoint.defaultVelocity,
        heading: config.waypoint.defaultHeading,
        stopAtWaypoint: config.waypoint.stopAtWaypoint
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
    // Reset robot to the first point before starting simulation
    if (optimizedPath.length > 0) {
      setRobotState({
        x: optimizedPath[0].x,
        y: optimizedPath[0].y,
        rotation: optimizedPath[0].heading || 0,
        velocity: optimizedPath[0].velocity,
        angularVelocity: 0
      });
    }
    currentPathIndexRef.current = 0;
    simulatedTimeRef.current = 0; // Reset simulated time
    lastTimestampRef.current = null; // Reset last timestamp for accurate deltaTime
    setIsPlaying(true); // This will trigger the useEffect for animation
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
        newPathIndex = optimizedPath.length - 1;
        const lastPoint = optimizedPath[newPathIndex];
        setRobotState({
          x: lastPoint.x,
          y: lastPoint.y,
          rotation: lastPoint.heading || 0,
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
      
      let currentWaypointIndex = -1; // Get current waypoint actual index
      if(actualStopWaypointData) {
        currentWaypointIndex = waypoints.indexOf(actualStopWaypointData);
      }

      // Condition to trigger stop:
      if (nearStopWaypoint && 
          currentPathPoint.velocity < 0.05 && 
          actualStopWaypointData && 
          lastStoppedWaypointIndexRef.current !== currentWaypointIndex // Only stop if it's a new waypoint stop
      ) {
        lastStoppedWaypointIndexRef.current = currentWaypointIndex; // Mark this waypoint as stopped at

        setRobotState({
          x: actualStopWaypointData.x, 
          y: actualStopWaypointData.y,
          rotation: actualStopWaypointData.heading !== undefined ? actualStopWaypointData.heading : currentPathPoint.heading || 0,
          velocity: 0, 
          angularVelocity: 0
        });

        const stopWpIndex = waypoints.indexOf(actualStopWaypointData) + 1;
        showMessage('info', `Stopping at Waypoint ${stopWpIndex} for ${config.waypoint.stopDuration.toFixed(1)}s`);

        isPausedForStopPointRef.current = true;

        setTimeout(() => {
          isPausedForStopPointRef.current = false; 
          // Advance simulated time by the stop duration to ensure we move past the stop point segment
          simulatedTimeRef.current += config.waypoint.stopDuration; 
          lastTimestampRef.current = null; // Reset for accurate deltaTime on resume

          if (isPlaying) { 
            animationFrameIdRef.current = requestAnimationFrame(simulationStep);
          }
        }, config.waypoint.stopDuration * 1000);

        return; 
      }

      // If not near a stop waypoint, or if it's the same one we just stopped at, reset the last stopped index
      if (!nearStopWaypoint || lastStoppedWaypointIndexRef.current !== currentWaypointIndex) {
        lastStoppedWaypointIndexRef.current = null;
      }

      setRobotState({
        x: currentPathPoint.x,
        y: currentPathPoint.y,
        rotation: currentPathPoint.heading || 0,
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
  }, [isPlaying, optimizedPath, waypoints, config.waypoint.stopDuration, simulationSpeedFactor, showMessage]);

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
              <div>
                <label className="block text-sm font-medium mb-1 text-text-secondary">Velocity: {waypoints[selectedWaypoint].velocity.toFixed(1)} m/s</label>
                <input type="range" min={config.waypoint.minVelocity} max={config.waypoint.maxVelocity} step="0.1" value={waypoints[selectedWaypoint].velocity} onChange={(e) => updateWaypoint('velocity', parseFloat(e.target.value))} className="w-full h-3 bg-background-primary rounded-lg appearance-none cursor-pointer accent-accent-primary" />
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
                  <input type="checkbox" checked={waypoints[selectedWaypoint].stopAtWaypoint || false} onChange={(e) => updateWaypoint('stopAtWaypoint', e.target.checked)} className="mr-2 h-4 w-4 text-accent-primary rounded-sm focus:ring-accent-secondary bg-background-primary border-border-color/50" />
                  Stop at Waypoint
                </label>
              </div>
            </div>
          ) : (
            <p className="text-text-secondary text-sm">Click on a waypoint or canvas to select/add.</p>
          )}
        </div>

        {/* Waypoint List Container */}
        <div className="bg-background-tertiary/50 rounded-xl shadow-lg p-5 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-4 text-accent-primary">Waypoint List</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {waypoints.map((wp, index) => (
                <div key={index} onClick={() => setSelectedWaypoint(index)} className={`p-3 rounded-lg cursor-pointer flex justify-between items-center group ${selectedWaypoint === index ? 'bg-gradient-accent text-white shadow-lg transform scale-105' : 'bg-background-primary text-text-primary hover:bg-accent-secondary hover:text-white hover:shadow-md'}`}>
                    <div>
                      <div className="font-medium">Waypoint {index + 1}</div>
                      <div className="text-xs opacity-80"> ({wp.x.toFixed(1)}, {wp.y.toFixed(1)}) • {wp.velocity.toFixed(1)} m/s {wp.heading !== undefined ? ` • ${wp.heading.toFixed(0)}°` : ''} {wp.stopAtWaypoint && <span className="font-bold"> • STOP</span>} </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteWaypoint(index); }} title="Delete Waypoint" className={`p-1 rounded-md transform group-hover:opacity-100 ${selectedWaypoint === index ? 'text-red-200 hover:text-white opacity-100' : 'text-red-400 hover:text-error-color opacity-0 group-hover:opacity-100'} hover:bg-background-secondary/50`}>
                      <Trash2 size={14} />
                    </button>
                </div>
                ))}
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
    </div> 
  );
};

export default HolonomicPathOptimizer;
