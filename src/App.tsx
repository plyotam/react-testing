import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Upload, Settings, Play, RotateCcw, Trash2, Image, Zap, Target, Square, BarChart2, GripVertical, Ruler } from 'lucide-react';
import { CubicSpline } from './utils/CubicSpline';
import { QuinticSpline } from './utils/QuinticSpline';
import ConfigInput from './components/ConfigInput';
import SimulationGraphs from './components/SimulationGraphs';
import WaypointEditorPopup from './components/WaypointEditorPopup'; // Import the new component
import FloatingGraphPopup from './components/FloatingGraphPopup'; // Import the new graph popup
import { defaultConfig } from './config/appConfig'; // Import defaultConfig
import { SimulationDataPoint, Point, Waypoint, RobotState, OptimizedPathPoint } from './types'; // Import interfaces including Waypoint and RobotState
import { normalizeAngleDeg, interpolateAngleDeg, addDataPointToHistory } from './utils/helpers'; // Import utility functions
import { generateOptimalPath as generateOptimalPathUtil } from './features/pathfinding/generateOptimalPath'; // Import the utility
import { drawCanvasContent } from './features/canvas/drawCanvas'; // Import the new drawing function

const HolonomicPathOptimizer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  
  const [config, setConfig] = useState(defaultConfig);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedWaypoint, setSelectedWaypoint] = useState<number | null>(null);
  const [optimizedPath, setOptimizedPath] = useState<OptimizedPathPoint[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [robotState, setRobotState] = useState<RobotState>({ 
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

  // State for draggable graph popup
  const [showFloatingGraphs, setShowFloatingGraphs] = useState(false);
  const [floatingGraphPosition, setFloatingGraphPosition] = useState({ x: window.innerWidth - 500, y: 150 });
  const [isDraggingFloatingGraphs, setIsDraggingFloatingGraphs] = useState(false);
  const [floatingGraphsDragStartOffset, setFloatingGraphsDragStartOffset] = useState({ x: 0, y: 0 });

  // State for simulation time slider
  const [displayTime, setDisplayTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // State for waypoint drag-and-drop reordering
  const [draggedWaypointSourceIndex, setDraggedWaypointSourceIndex] = useState<number | null>(null);

  // State for measuring tool
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const [measurePreviewPoint, setMeasurePreviewPoint] = useState<Point | null>(null); // For live preview

  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const currentPathIndexRef = useRef<number>(0);
  const simulatedTimeRef = useRef<number>(0);
  const isPausedForStopPointRef = useRef<boolean>(false);
  const lastStoppedWaypointIndexRef = useRef<number | null>(null);

  const resetSimulationState = () => {
    setIsPlaying(false);
    currentPathIndexRef.current = 0;
    simulatedTimeRef.current = 0;
    setDisplayTime(0);
    lastTimestampRef.current = null;
    isPausedForStopPointRef.current = false;
    lastStoppedWaypointIndexRef.current = null;
    // Do not clear robot state here if we want it to remain at the end of path
    // Do not clear simulation history here if we want graphs to persist
  };

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

  useEffect(() => {
    if (waypoints.length >= 2) {
      // Call the utility function, passing necessary state/callbacks
      const { path: newPath, metrics: newMetrics } = generateOptimalPathUtil(waypoints, config, showMessage);
      setOptimizedPath(newPath);
      setOptimizationMetrics(newMetrics); // Set metrics from the result

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
  }, [waypoints, config, showMessage]); // Add config and showMessage to dependencies

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

  useEffect(() => {
    // New drawCanvas useEffect using the imported function
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure canvas dimensions are set based on config before drawing
    // This was implicitly handled by the old drawCanvas, ensure it's explicit now
    const canvasWidth = metersToPixels(config.field.width);
    const canvasHeight = metersToPixels(config.field.height);
    if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
    if (canvas.height !== canvasHeight) canvas.height = canvasHeight;

    drawCanvasContent({
      canvas,
      ctx,
      config,
      waypoints,
      selectedWaypoint,
      robotState,
      optimizedPath,
      backgroundImage,
      metersToPixels,
      isMeasuring,
      measurePoints,
      measuredDistance,
      measurePreviewPoint,
    });
  }, [
    config, 
    waypoints, 
    selectedWaypoint, 
    robotState, 
    optimizedPath, 
    backgroundImage, 
    metersToPixels, 
    isMeasuring, 
    measurePoints, 
    measuredDistance, 
    measurePreviewPoint,
    canvasRef // Add canvasRef as dependency as it's used to get the canvas element
  ]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    const meterX = pixelsToMeters(pixelX);
    const meterY = pixelsToMeters(pixelY);
    
    setMouseDownPosition({ x: pixelX, y: pixelY });

    if (isMeasuring) {
      setMeasurePoints(prevPoints => {
        if (prevPoints.length === 0) { // First click for a new measurement
          setMeasuredDistance(null); 
          setMeasurePreviewPoint(null); // Reset preview explicitly
          return [{ x: meterX, y: meterY }];
        } else if (prevPoints.length === 1) { // Second click, finalizing measurement
          const newPoints = [...prevPoints, { x: meterX, y: meterY }];
          const dx = newPoints[1].x - newPoints[0].x;
          const dy = newPoints[1].y - newPoints[0].y;
          setMeasuredDistance(Math.sqrt(dx*dx + dy*dy));
          setMeasurePreviewPoint(null); // Finalized measurement, clear preview
          return newPoints;
        } else { // prevPoints.length === 2, effectively a first click for a new measurement
          setMeasuredDistance(null);
          setMeasurePreviewPoint(null); // Reset preview explicitly
          return [{ x: meterX, y: meterY }];
        }
      });
      setSelectedWaypoint(null);
      setIsDragging(false);
      setDraggingWaypointIndex(null);
      return; 
    }

    // Existing waypoint interaction logic (only if not measuring)
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
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return; // Ensure canvas is available

    const rect = canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    const meterX = pixelsToMeters(pixelX);
    const meterY = pixelsToMeters(pixelY);

    if (isMeasuring && measurePoints.length === 1) {
      setMeasurePreviewPoint({ x: meterX, y: meterY });
    } else if (measurePreviewPoint !== null) {
      // If not in the specific state for live preview (isMeasuring=true and 1 point set),
      // but a preview point exists, clear it.
      // This handles cases like toggling off isMeasuring, or after the 2nd point is clicked.
      setMeasurePreviewPoint(null);
    }

    // Waypoint dragging logic (should only run if not actively setting measurePreviewPoint, but isDragging is the primary guard)
    if (isDragging && draggingWaypointIndex !== null) {
      updateWaypointCoordinates(draggingWaypointIndex, meterX, meterY);
    }
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
      // AND not in measuring mode.
      if (distDragged < 5 && selectedWaypoint === null && !isMeasuring) { 
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
            initialRotation = waypointSHeadings[waypointSHeadings.length - 1].heading;
        } else {
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
        s: firstPoint.s, 
        velocity: firstPoint.velocity, 
        acceleration: firstPoint.acceleration, 
        heading: initialRotation, 
        curvature: firstPoint.curvature,
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
      // Only set isPausedForStopPointRef to false, don't reset other sim state here
      // if we want scrubbing to work when paused.
      // resetSimulationState(); // Keep history and robot position for scrubbing
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
      setDisplayTime(simulatedTimeRef.current); // Update slider display time

      let newPathIndex = optimizedPath.findIndex(p => p.time >= simulatedTimeRef.current);

      if (newPathIndex === -1 && optimizedPath.length > 0 && simulatedTimeRef.current > optimizedPath[optimizedPath.length - 1].time) {
        newPathIndex = optimizedPath.length - 1; 
        const lastPoint = optimizedPath[newPathIndex];
        const finalDataPoint: SimulationDataPoint = {
          time: lastPoint.time, 
          x: lastPoint.x,
          y: lastPoint.y,
          s: lastPoint.s, 
          velocity: 0, 
          acceleration: 0, 
          heading: lastPoint.heading || robotState.rotation, 
          curvature: lastPoint.curvature !== undefined ? lastPoint.curvature : 0,
        };
        setSimulationHistory(prevHistory => addDataPointToHistory(prevHistory, finalDataPoint));
        setRobotState({
          x: lastPoint.x,
          y: lastPoint.y,
          rotation: finalDataPoint.heading,
          velocity: 0, 
          angularVelocity: 0
        });
        setIsPlaying(false); // Simulation ends
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
        s: currentPathPoint.s,
        velocity: currentPathPoint.velocity,
        acceleration: currentPathPoint.acceleration,
        heading: newRobotRotation,
        curvature: currentPathPoint.curvature,
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
          s: currentPathPoint.s,
          velocity: 0,
          acceleration: 0, 
          heading: stopStateHeading,
          curvature: currentPathPoint.curvature !== undefined ? currentPathPoint.curvature : 0,
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
  }, [isPlaying, optimizedPath, waypoints, config.waypoint.defaultStopDuration, simulationSpeedFactor, showMessage, interpolateAngleDeg, robotState.rotation, waypointSHeadings, config.robot.maxAcceleration, addDataPointToHistory, isScrubbing]); // Added missing dependencies

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

  // Drag handlers for the Floating Graph Popup
  const handleFloatingGraphMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingFloatingGraphs(true);
    setFloatingGraphsDragStartOffset({
      x: e.clientX - floatingGraphPosition.x,
      y: e.clientY - floatingGraphPosition.y,
    });
    e.preventDefault();
  };

  const handleFloatingGraphMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingFloatingGraphs) return;
    setFloatingGraphPosition({
      x: e.clientX - floatingGraphsDragStartOffset.x,
      y: e.clientY - floatingGraphsDragStartOffset.y,
    });
  }, [isDraggingFloatingGraphs, floatingGraphsDragStartOffset]);

  const handleFloatingGraphMouseUp = useCallback(() => {
    setIsDraggingFloatingGraphs(false);
  }, []);

  useEffect(() => {
    if (isDraggingEditor) {
      window.addEventListener('mousemove', handleEditorMouseMove);
      window.addEventListener('mouseup', handleEditorMouseUp);
    } else if (isDraggingFloatingGraphs) {
      window.addEventListener('mousemove', handleFloatingGraphMouseMove);
      window.addEventListener('mouseup', handleFloatingGraphMouseUp);
    } else {
      window.removeEventListener('mousemove', handleEditorMouseMove);
      window.removeEventListener('mouseup', handleEditorMouseUp);
      window.removeEventListener('mousemove', handleFloatingGraphMouseMove);
      window.removeEventListener('mouseup', handleFloatingGraphMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleEditorMouseMove);
      window.removeEventListener('mouseup', handleEditorMouseUp);
      window.removeEventListener('mousemove', handleFloatingGraphMouseMove);
      window.removeEventListener('mouseup', handleFloatingGraphMouseUp);
    };
  }, [isDraggingEditor, handleEditorMouseMove, handleEditorMouseUp, isDraggingFloatingGraphs, handleFloatingGraphMouseMove, handleFloatingGraphMouseUp]);

  // Simulation Time Slider Handler
  const handleTimeSliderChange = (newTime: number) => {
    if (isPlaying) {
      // If user scrubs while playing, pause the simulation first
      // Consider if this is desired behavior or if scrubbing should just take over
      // setIsPlaying(false); 
    }
    setIsScrubbing(true); // Indicate scrubbing is active
    
    simulatedTimeRef.current = newTime;
    setDisplayTime(newTime);

    let newPathIndex = optimizedPath.findIndex(p => p.time >= newTime);
    if (newPathIndex === -1 && optimizedPath.length > 0) {
      newPathIndex = optimizedPath.length - 1; // Go to last point if scrubbed past end
    }
    if (newPathIndex === -1) newPathIndex = 0; // Default to first if no path

    currentPathIndexRef.current = newPathIndex;
    const currentPathPoint = optimizedPath[newPathIndex];

    if (currentPathPoint) {
      // Logic to interpolate robot rotation based on scrubbed time (similar to simulationStep)
      let newRobotRotation = robotState.rotation; // Default to current if no heading info
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
               const t = (nextTarget.s - prevTarget.s === 0) ? 1 : (currentS - prevTarget.s) / (nextTarget.s - prevTarget.s); // Avoid div by zero
               newRobotRotation = interpolateAngleDeg(prevTarget.heading, nextTarget.heading, Math.max(0, Math.min(1, t)));
            } else { 
               newRobotRotation = prevTarget.heading;
            }
        } else if (prevTarget) {
            newRobotRotation = prevTarget.heading;
        } else if (nextTarget) { 
            newRobotRotation = nextTarget.heading;
        } else if (optimizedPath.length > 0 && optimizedPath[0].heading !== undefined) {
            // Fallback to initial path point heading if no waypoint headings apply
            newRobotRotation = optimizedPath[0].heading;
        }
    }

      setRobotState({
        x: currentPathPoint.x,
        y: currentPathPoint.y,
        rotation: newRobotRotation,
        velocity: currentPathPoint.velocity,
        angularVelocity: 0 // Or derive if needed from path data
      });
    } else if (optimizedPath.length > 0) {
        // If scrubbed before start, reset to first point state
        setRobotState({
            x: optimizedPath[0].x,
            y: optimizedPath[0].y,
            rotation: optimizedPath[0].heading,
            velocity: optimizedPath[0].velocity,
            angularVelocity: 0
        });
    } else {
        // No path, reset to default initial state
         setRobotState({ x: 1, y: 1, rotation: 0, velocity: 0, angularVelocity: 0 });
    }
    // drawCanvas(); // drawCanvas is called via useEffect on robotState change
  };

  const handleTimeSliderMouseUp = () => {
    setIsScrubbing(false);
    // If simulation was paused by scrubbing, user might expect it to stay paused.
    // Or, if it was playing, it could resume. For now, keep it paused.
    if (isPlaying) {
        // setIsPlaying(false); // Ensures it stays paused after scrubbing
    }
  };

  const totalPathTime = optimizedPath.length > 0 ? optimizedPath[optimizedPath.length - 1].time : 0;

  // Added drag-and-drop handlers for waypoint reordering
  const handleWaypointDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedWaypointSourceIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Minimal data transfer, actual data comes from state
    e.dataTransfer.setData('text/plain', String(index));
    // Optional: Add a class to the dragged item for styling
    // e.currentTarget.classList.add('dragging-waypoint');
  };

  const handleWaypointDragOver = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault(); // Necessary to allow dropping
    // Optional: Add visual feedback for where the item will be dropped
    // if (draggedWaypointSourceIndex !== null && draggedWaypointSourceIndex !== targetIndex) {
    //   e.currentTarget.classList.add('waypoint-drop-target');
    // }
  };

  const handleWaypointDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Optional: Remove visual feedback
    // e.currentTarget.classList.remove('waypoint-drop-target');
  };

  const handleWaypointDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    // e.currentTarget.classList.remove('waypoint-drop-target');
    if (draggedWaypointSourceIndex === null || draggedWaypointSourceIndex === targetIndex) {
      setDraggedWaypointSourceIndex(null);
      return;
    }

    setWaypoints(prevWaypoints => {
      const newWaypoints = [...prevWaypoints];
      const [draggedItem] = newWaypoints.splice(draggedWaypointSourceIndex, 1);
      newWaypoints.splice(targetIndex, 0, draggedItem);

      // Update selectedWaypoint index
      if (selectedWaypoint === draggedWaypointSourceIndex) {
        setSelectedWaypoint(targetIndex);
      } else if (selectedWaypoint !== null) {
        if (draggedWaypointSourceIndex < selectedWaypoint && targetIndex >= selectedWaypoint) {
          setSelectedWaypoint(selectedWaypoint - 1);
        } else if (draggedWaypointSourceIndex > selectedWaypoint && targetIndex <= selectedWaypoint) {
          setSelectedWaypoint(selectedWaypoint + 1);
        }
      }
      return newWaypoints;
    });
    setDraggedWaypointSourceIndex(null);
  };

  const handleWaypointDragEnd = () => {
    setDraggedWaypointSourceIndex(null);
  };

  const toggleMeasureMode = () => {
    setIsMeasuring(prevIsMeasuring => {
      const nextIsMeasuring = !prevIsMeasuring;
      // Always reset measurement state when toggling
      setMeasurePoints([]);
      setMeasuredDistance(null);
      setMeasurePreviewPoint(null);
      
      if (nextIsMeasuring) { // Turning ON measuring mode
        setSelectedWaypoint(null); // Deselect waypoints to avoid confusion
      }
      return nextIsMeasuring;
    });
  };

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

          {/* Simulation Time Slider */}
          {optimizedPath.length > 0 && (
            <div className="m-4 p-3 bg-background-secondary/50 rounded-lg shadow-md flex items-center gap-3">
              <span className="text-sm text-text-secondary min-w-[90px]">Time: {displayTime.toFixed(2)}s / {totalPathTime.toFixed(2)}s</span>
              <input
                type="range"
                min={0}
                max={totalPathTime}
                step={0.01} // Or a larger step for performance on very long paths
                value={displayTime}
                onChange={(e) => handleTimeSliderChange(parseFloat(e.target.value))}
                onMouseDown={() => setIsScrubbing(true)} // Also set isScrubbing on direct interaction start
                onMouseUp={handleTimeSliderMouseUp}
                className="w-full h-3 bg-background-primary rounded-lg appearance-none cursor-pointer accent-accent-primary"
              />
            </div>
          )}

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
      
      {/* Floating Graph Popup */}
      <FloatingGraphPopup
          history={simulationHistory}
          onClose={() => setShowFloatingGraphs(false)}
          editorPosition={floatingGraphPosition}
          onDragStart={handleFloatingGraphMouseDown}
          isVisible={showFloatingGraphs}
          currentTime={displayTime} // Pass displayTime here
      />

      {/* Sidebar */}
      {showConfig && (
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
              <ConfigInput label="Path Resolution" value={config.path.pathResolution} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, path: { ...prev.path, pathResolution: parseFloat(e.target.value) } }))} unit="m" className="mb-1" />
              <ConfigInput label="Path Color" type="color" value={config.path.color} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, path: { ...prev.path, color: e.target.value } }))} className="mb-1" />
              <ConfigInput label="Path Width" type="number" value={config.path.width} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, path: { ...prev.path, width: parseInt(e.target.value, 10) } }))} unit="px" className="mb-1" />
              <div className="flex items-center justify-between py-1">
                <label className="text-sm text-text-secondary">Velocity Visualization:</label>
                <input type="checkbox" checked={config.path.velocityVisualization} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, path: { ...prev.path, velocityVisualization: e.target.checked } }))} className="mr-2 h-4 w-4 text-accent-primary rounded-sm focus:ring-accent-secondary bg-text-primary border-border-color" />
              </div>
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
                    <div 
                      key={wp.x + '-' + wp.y + '-' + index} // More robust key for reordering
                      draggable="true"
                      onDragStart={(e) => handleWaypointDragStart(e, index)}
                      onDragOver={(e) => handleWaypointDragOver(e, index)}
                      onDragLeave={handleWaypointDragLeave}
                      onDrop={(e) => handleWaypointDrop(e, index)}
                      onDragEnd={handleWaypointDragEnd}
                      onClick={() => setSelectedWaypoint(index)} 
                      className={`p-3 rounded-lg cursor-grab flex justify-between items-center group relative ${selectedWaypoint === index ? 'bg-gradient-accent text-white shadow-lg transform scale-105' : 'bg-background-primary text-text-primary hover:bg-accent-secondary hover:text-white hover:shadow-md'} ${draggedWaypointSourceIndex === index ? 'opacity-50' : ''}`}
                    >
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

      </div> /* Closes the sidebar div */
      )}

      {/* Message Box */}
      {message && (
        <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-xl text-white text-sm z-50 transform transition-all duration-300 ease-in-out hover:scale-105 ${message.type === 'error' ? 'bg-error-color' : 'bg-gradient-accent'}`}>
          {message.text}
        </div>
      )}

      {/* Simulation Graphs Pop-out (Old one, can be removed or kept) */}
      {/* {showGraphs && <SimulationGraphs history={simulationHistory} onClose={() => setShowGraphs(false)} />} */}
    </div> 
  );
};

export default HolonomicPathOptimizer;
