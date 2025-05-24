import React, { useState, useRef, useEffect, useCallback } from 'react';
import AppUI, { AppUIProps } from './components/AppUI'; // Import the new UI component
import { defaultConfig } from './config/appConfig';
import { SimulationDataPoint, Point, Waypoint, RobotState, OptimizedPathPoint, CommandMarker, EventZone } from './types';
import { interpolateAngleDeg, addDataPointToHistory } from './utils/helpers';
import { generateOptimalPath as generateOptimalPathUtil } from './features/pathfinding/generateOptimalPath';
import { drawCanvasContent } from './features/canvas/drawCanvas';
import { createCanvasEventHandlers } from './features/canvas/canvasEventHandlers';
import { v4 as uuidv4 } from 'uuid'; // Import uuid

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
  const [message, setMessage] = useState<{ type: 'error' | 'info' | 'warn', text: string } | null>(null);
  const [simulationSpeedFactor, setSimulationSpeedFactor] = useState(1); // 1x, 2x, 4x
  const [waypointSHeadings, setWaypointSHeadings] = useState<{s: number, heading: number}[]>([]);
  const [simulationHistory, setSimulationHistory] = useState<SimulationDataPoint[]>([]);
  const [draggingWaypointIndex, setDraggingWaypointIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mouseDownPosition, setMouseDownPosition] = useState<{ x: number, y: number } | null>(null);
  const [waypointCreationMode, setWaypointCreationMode] = useState<'hard' | 'guide'>('hard');
  const [commandMarkers, setCommandMarkers] = useState<CommandMarker[]>([]);
  const [eventZones, setEventZones] = useState<EventZone[]>([]);
  const [triggeredEnterZones, setTriggeredEnterZones] = useState<Set<string>>(new Set());
  const [activeWhileInZones, setActiveWhileInZones] = useState<Set<string>>(new Set());
  const [editorMode, setEditorMode] = useState<'waypoints' | 'addEventZoneCenter' | 'addCommandMarker'>('waypoints');
  const [pendingEventZoneCreation, setPendingEventZoneCreation] = useState<{ x: number, y: number } | null>(null);
  const [pendingCommandMarkerCreation, setPendingCommandMarkerCreation] = useState<{ s: number, time: number, x: number, y: number } | null>(null);
  const [canvasMousePosition, setCanvasMousePosition] = useState<Point | null>(null);
  const [selectedEventZoneId, setSelectedEventZoneId] = useState<string | null>(null);
  const [isDraggingEventZone, setIsDraggingEventZone] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [isResizingEventZone, setIsResizingEventZone] = useState<boolean>(false);
  const [selectedCommandMarkerId, setSelectedCommandMarkerId] = useState<string | null>(null);
  const [isRepositioningCommandMarker, setIsRepositioningCommandMarker] = useState<boolean>(false);

  const [editorPosition, setEditorPosition] = useState({ x: 50, y: 150 });
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });

  const [showFloatingGraphs, setShowFloatingGraphs] = useState(false);
  const [floatingGraphPosition, setFloatingGraphPosition] = useState({ x: window.innerWidth - 500, y: 150 });
  const [isDraggingFloatingGraphs, setIsDraggingFloatingGraphs] = useState(false);
  const [floatingGraphsDragStartOffset, setFloatingGraphsDragStartOffset] = useState({ x: 0, y: 0 });

  const [displayTime, setDisplayTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [draggedWaypointSourceIndex, setDraggedWaypointSourceIndex] = useState<number | null>(null);

  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const [measurePreviewPoint, setMeasurePreviewPoint] = useState<Point | null>(null);

  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const currentPathIndexRef = useRef<number>(0);
  const simulatedTimeRef = useRef<number>(0);
  const isPausedForStopPointRef = useRef<boolean>(false);
  const lastStoppedWaypointIndexRef = useRef<number | null>(null);

  // ALL HANDLER FUNCTIONS TO BE GROUPED HERE
  const showMessage = useCallback((type: 'error' | 'info' | 'warn', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
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

  const addCommandMarker = (markerData: Omit<CommandMarker, 'id'>) => {
    const newMarker: CommandMarker = {
      ...markerData,
      id: uuidv4(),
    };
    setCommandMarkers(prev => [...prev, newMarker].sort((a,b) => a.s - b.s));
  };

  const updateCommandMarker = (updatedMarker: CommandMarker) => {
    setCommandMarkers(prev => 
      prev.map(marker => marker.id === updatedMarker.id ? updatedMarker : marker)
        .sort((a,b) => a.s - b.s)
    );
  };

  const deleteCommandMarker = (markerId: string) => {
    setCommandMarkers(prev => prev.filter(marker => marker.id !== markerId));
  };

  const addEventZone = (zoneData: Omit<EventZone, 'id'>) => {
    const newZone: EventZone = {
      ...zoneData,
      id: uuidv4(),
    };
    setEventZones(prev => [...prev, newZone]);
  };

  const updateEventZone = (updatedZone: EventZone) => {
    setEventZones(prev => prev.map(zone => zone.id === updatedZone.id ? updatedZone : zone));
  };

  const deleteEventZone = (zoneId: string) => {
    setEventZones(prev => prev.filter(zone => zone.id !== zoneId));
  };

  const initiatePendingEventZone = (x: number, y: number) => {
    setPendingEventZoneCreation({ x, y });
    setEditorMode('waypoints');
    setShowConfig(true);
    if (showMessage) showMessage('info', 'Click on the canvas placed Event Zone. Now edit details in the sidebar.');
  };

  const initiatePendingCommandMarker = (s: number, time: number, x: number, y: number) => {
    setPendingCommandMarkerCreation({ s, time, x, y });
    setEditorMode('waypoints');
    setShowConfig(true);
    if (showMessage) showMessage('info', `Clicked path at s=${s.toFixed(2)}m, t=${time.toFixed(2)}s. Edit marker details.`);
  };
  // END OF HANDLER FUNCTIONS GROUP

  // useEffect for path generation (depends on waypoints, config, showMessage)
  useEffect(() => {
    if (waypoints.length >= 2) {
      const { path: newPath, metrics: newMetrics } = generateOptimalPathUtil(waypoints, config, showMessage);
      setOptimizedPath(newPath);
      setOptimizationMetrics(newMetrics);

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
        newWPSHeadings.sort((a, b) => a.s - b.s);
        setWaypointSHeadings(newWPSHeadings);
      } else {
        setWaypointSHeadings([]);
      }
    } else {
      setOptimizedPath([]);
      setOptimizationMetrics(null);
      setWaypointSHeadings([]);
    }
  }, [waypoints, config, showMessage]); // showMessage is a dependency here

  const { 
    handleCanvasMouseDown, 
    handleCanvasMouseMove, 
    handleCanvasMouseUp, 
    handleCanvasMouseLeave 
  } = createCanvasEventHandlers({
    canvasRef,
    pixelsToMeters,
    isMeasuring,
    measurePoints,
    setMeasurePoints,
    measuredDistance,
    setMeasuredDistance,
    measurePreviewPoint,
    setMeasurePreviewPoint,
    setSelectedWaypoint,
    setIsDragging,
    setDraggingWaypointIndex,
    waypoints,
    updateWaypointCoordinates,
    isDragging,
    draggingWaypointIndex,
    mouseDownPosition,
    setMouseDownPosition,
    selectedWaypoint,
    waypointCreationMode, 
    config,
    setWaypoints,
    editorMode, 
    initiatePendingEventZone,
    showMessage,
    optimizedPath,
    initiatePendingCommandMarker,
    setCanvasMousePosition, // Pass setter to event handlers
    eventZones, // Pass eventZones for selection logic
    selectedEventZoneId, // Pass current selected zone ID
    setSelectedEventZoneId, // Pass setter for selected zone ID
    isDraggingEventZone, // Pass dragging state for event zones
    setIsDraggingEventZone, // Pass setter for dragging state
    dragOffset, // Pass drag offset
    setDragOffset, // Pass setter for drag offset
    onUpdateEventZone, // Pass update function
    isResizingEventZone, // Pass resizing state
    setIsResizingEventZone, // Pass setter for resizing state
    metersToPixels, 
    pixelsToMeters,
    // Command Marker specific props
    commandMarkers, // Pass command markers list
    selectedCommandMarkerId,
    setSelectedCommandMarkerId,
    isRepositioningCommandMarker,
    setIsRepositioningCommandMarker,
    onUpdateCommandMarker, // Pass update function for command markers
  });

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
    resetSimulationState();
    setSimulationHistory([]);
    setEventZones([]);
    setCommandMarkers([]);
    setTriggeredEnterZones(new Set());
    setActiveWhileInZones(new Set());
  };

  const exportPath = () => {
    const pathData = {
      name: pathName,
      waypoints,
      optimizedPath,
      commandMarkers,
      eventZones,
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
      if (!event.target) return;
      try {
        if (typeof event.target.result === 'string') {
          const pathData = JSON.parse(event.target.result);
          setPathName(pathData.name || 'Imported Path');
          setWaypoints(pathData.waypoints || []);
          if (pathData.config) {
            setConfig(prevConfig => ({ 
              ...defaultConfig, 
              ...pathData.config,
              field: { ...defaultConfig.field, ...pathData.config.field },
              robot: { ...defaultConfig.robot, ...pathData.config.robot },
              waypoint: { ...defaultConfig.waypoint, ...pathData.config.waypoint },
              path: { ...defaultConfig.path, ...pathData.config.path },
              physics: { ...defaultConfig.physics, ...pathData.config.physics },
            }));
            if (pathData.config.field.backgroundImage) {
              const img = new window.Image();
              img.onload = () => setBackgroundImage(img);
              img.src = pathData.config.field.backgroundImage;
            } else {
              setBackgroundImage(null);
            }
          }
          setSelectedWaypoint(null);
          resetSimulationState();
          setSimulationHistory([]);
          if (pathData.commandMarkers) {
            setCommandMarkers(pathData.commandMarkers);
          } else {
            setCommandMarkers([]);
          }
          if (pathData.eventZones) {
            setEventZones(pathData.eventZones);
          } else {
            setEventZones([]);
          }
          setTriggeredEnterZones(new Set());
          showMessage('info', 'Path imported successfully!');
        }
      } catch (error) {
        showMessage('error', 'Error importing path: Invalid file format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const loadBackgroundImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (!event.target) return;
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
        console.error("Image loaded as ArrayBuffer, expected string data URL");
        showMessage('error', 'Failed to load image: Invalid format.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const playPath = () => {
    if (optimizedPath.length < 2) {
      showMessage('error', 'Path must have at least 2 points to simulate.');
      return;
    }
    setSimulationHistory([]);
    setTriggeredEnterZones(new Set());
    setActiveWhileInZones(new Set());
    
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
    isPausedForStopPointRef.current = false;
    setIsPlaying(true);
  };

  const stopPath = () => {
    setIsPlaying(false);
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
        animationFrameIdRef.current = requestAnimationFrame(simulationStep);
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
      if (!isScrubbing) setDisplayTime(simulatedTimeRef.current);

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
                                  : config.waypoint.defaultStopDuration;

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
      
      // --- Event Zone Logic ---
      const currentRobotX = currentPathPoint.x;
      const currentRobotY = currentPathPoint.y;

      eventZones.forEach(zone => {
        const distanceToZoneCenter = Math.sqrt(
          (currentRobotX - zone.x) ** 2 + (currentRobotY - zone.y) ** 2
        );
        const robotIsInsideZone = distanceToZoneCenter <= zone.radius;
        const wasActiveInZone = activeWhileInZones.has(zone.id);

        if (robotIsInsideZone) {
          if (zone.triggerType === 'onEnter') {
            if (!triggeredEnterZones.has(zone.id)) {
              showMessage('info', `EVENT (onEnter): ${zone.commandName}`);
              setTriggeredEnterZones(prev => new Set(prev).add(zone.id));
            }
          } else if (zone.triggerType === 'whileInZone') {
            if (!wasActiveInZone) {
              setActiveWhileInZones(prev => new Set(prev).add(zone.id));
              showMessage('info', `EVENT (whileIn - ENTER): ${zone.commandName}`);
            }
          }
        } else {
          if (zone.triggerType === 'whileInZone' && wasActiveInZone) {
            setActiveWhileInZones(prev => {
              const newSet = new Set(prev);
              newSet.delete(zone.id);
              return newSet;
            });
            if (zone.onExitCommandName) {
              showMessage('info', `EVENT (whileIn - EXIT): ${zone.onExitCommandName}`);
            } else {
              showMessage('info', `EVENT (whileIn - EXIT IMPLIED): Stop ${zone.commandName}`);
            }
          }
        }
      });
      // --- End Event Zone Logic ---
      
      animationFrameIdRef.current = requestAnimationFrame(simulationStep);
    };

    if (isPlaying && !isPausedForStopPointRef.current && !isScrubbing) { 
      animationFrameIdRef.current = requestAnimationFrame(simulationStep);
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      lastTimestampRef.current = null; 
    };
  }, [
    isPlaying, 
    optimizedPath, 
    waypoints, 
    config.waypoint.defaultStopDuration, 
    simulationSpeedFactor, 
    showMessage, 
    robotState.rotation, 
    waypointSHeadings, 
    isScrubbing, 
    activeWhileInZones,
    eventZones,
    triggeredEnterZones
  ]);

  const updateWaypointByIndex = (index: number, field: keyof Waypoint, value: any) => {
    if (index < 0 || index >= waypoints.length) return;
    const updated = [...waypoints];
    updated[index] = { ...updated[index], [field]: value };
    setWaypoints(updated);
  };

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
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingEditor) handleEditorMouseMove(e);
      if (isDraggingFloatingGraphs) handleFloatingGraphMouseMove(e);
    };
    const handleGlobalMouseUp = () => {
      if (isDraggingEditor) handleEditorMouseUp();
      if (isDraggingFloatingGraphs) handleFloatingGraphMouseUp();
    };

    if (isDraggingEditor || isDraggingFloatingGraphs) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    } else {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [
    isDraggingEditor, handleEditorMouseMove, handleEditorMouseUp, 
    isDraggingFloatingGraphs, handleFloatingGraphMouseMove, handleFloatingGraphMouseUp
  ]);

  const handleTimeSliderChange = (newTime: number) => {
    if (isPlaying && !isPausedForStopPointRef.current) {
        // Pause simulation if playing and user starts scrubbing
        // setIsPlaying(false); // Decided against this for now to allow live update then resume
    }
    setIsScrubbing(true);
    
    simulatedTimeRef.current = newTime;
    setDisplayTime(newTime);

    let newPathIndex = optimizedPath.findIndex(p => p.time >= newTime);
    if (newPathIndex === -1 && optimizedPath.length > 0) {
      newPathIndex = optimizedPath.length - 1;
    }
    if (newPathIndex === -1) newPathIndex = 0;

    currentPathIndexRef.current = newPathIndex;
    const currentPathPoint = optimizedPath[newPathIndex];

    if (currentPathPoint) {
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
               const t = (nextTarget.s - prevTarget.s === 0) ? 1 : (currentS - prevTarget.s) / (nextTarget.s - prevTarget.s);
               newRobotRotation = interpolateAngleDeg(prevTarget.heading, nextTarget.heading, Math.max(0, Math.min(1, t)));
            } else { 
               newRobotRotation = prevTarget.heading;
            }
        } else if (prevTarget) {
            newRobotRotation = prevTarget.heading;
        } else if (nextTarget) { 
            newRobotRotation = nextTarget.heading;
        } else if (optimizedPath.length > 0 && optimizedPath[0].heading !== undefined) {
            newRobotRotation = optimizedPath[0].heading;
        }
    }
      setRobotState({
        x: currentPathPoint.x,
        y: currentPathPoint.y,
        rotation: newRobotRotation,
        velocity: currentPathPoint.velocity,
        angularVelocity: 0
      });
    } else if (optimizedPath.length > 0) {
        setRobotState({
            x: optimizedPath[0].x,
            y: optimizedPath[0].y,
            rotation: optimizedPath[0].heading || 0,
            velocity: optimizedPath[0].velocity,
            angularVelocity: 0
        });
    } else {
         setRobotState({ x: 1, y: 1, rotation: 0, velocity: 0, angularVelocity: 0 });
    }
  };

  const handleTimeSliderMouseUp = () => {
    setIsScrubbing(false);
    // If simulation was playing and user scrubbed, it might have been paused or continued.
    // For now, if it was playing, we ensure lastTimestampRef is null so it picks up correctly if it auto-resumes or user presses play.
    if (isPlaying && !isPausedForStopPointRef.current) {
        lastTimestampRef.current = null; 
    }
  };

  const totalPathTime = optimizedPath.length > 0 ? optimizedPath[optimizedPath.length - 1].time : 0;

  const handleWaypointDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedWaypointSourceIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleWaypointDragOver = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
  };

  const handleWaypointDragLeave = (e: React.DragEvent<HTMLDivElement>) => {};

  const handleWaypointDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedWaypointSourceIndex === null || draggedWaypointSourceIndex === targetIndex) {
      setDraggedWaypointSourceIndex(null);
      return;
    }

    setWaypoints(prevWaypoints => {
      const newWaypoints = [...prevWaypoints];
      const [draggedItem] = newWaypoints.splice(draggedWaypointSourceIndex, 1);
      newWaypoints.splice(targetIndex, 0, draggedItem);

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
      setMeasurePoints([]);
      setMeasuredDistance(null);
      setMeasurePreviewPoint(null);
      
      if (nextIsMeasuring) {
        setSelectedWaypoint(null);
      }
      return nextIsMeasuring;
    });
  };

  const resetSimulationState = () => {
    setIsPlaying(false);
    currentPathIndexRef.current = 0;
    simulatedTimeRef.current = 0;
    setDisplayTime(0);
    lastTimestampRef.current = null;
    isPausedForStopPointRef.current = false;
    lastStoppedWaypointIndexRef.current = null;
    setTriggeredEnterZones(new Set());
    setActiveWhileInZones(new Set());
  };

  // useEffect for loading default background image
  useEffect(() => {
    const defaultBgPath = 'fields/field25.png'; // Ensure this path is correct relative to your public folder
    const img = new window.Image();
    img.onload = () => {
      setBackgroundImage(img);
      // Create a data URL to store in config, only if it wasn't loaded from config initially
      // This part might need refinement based on how backgroundImage interacts with config.field.backgroundImage
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        // Only update config if the background wasn't already set from an import
        if (!config.field.backgroundImage || config.field.backgroundImage === 'fields/field25.png') {
            setConfig(prev => ({
                ...prev,
                field: { ...prev.field, backgroundImage: dataUrl }
            }));
        }
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
  }, [showMessage]); // Keep minimal dependencies, setConfig is stable if not included

  // useEffect to pre-calculate renderX and renderY for commandMarkers
  useEffect(() => {
    if (optimizedPath && optimizedPath.length > 0 && commandMarkers.length > 0) {
      let didUpdate = false;
      const updatedCommandMarkers = commandMarkers.map(marker => {
        if (!optimizedPath || optimizedPath.length === 0) return marker;

        let closestPathPoint: OptimizedPathPoint | null = null;
        let minDiff = Infinity;

        for (const point of optimizedPath) {
          const diff = Math.abs(point.s - marker.s);
          if (diff < minDiff) {
            minDiff = diff;
            closestPathPoint = point;
          }
          // Optimization: if diff starts increasing, we've passed the closest point for sorted 's' values
          // This assumes optimizedPath points are somewhat ordered by 's', which they should be.
          // However, to be safe, we might need to iterate through all if 's' is not strictly monotonic.
          // For now, let's assume it's good enough for finding a close point.
          // A more robust approach would be a binary search if 's' is strictly monotonic and sorted.
        }

        if (closestPathPoint) {
          if (marker.renderX !== closestPathPoint.x || marker.renderY !== closestPathPoint.y) {
            didUpdate = true;
            return { ...marker, renderX: closestPathPoint.x, renderY: closestPathPoint.y };
          }
        }
        return marker;
      });

      if (didUpdate) {
        setCommandMarkers(updatedCommandMarkers);
      }
    }
  }, [optimizedPath, commandMarkers]);

  // useEffect for drawing canvas content
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
      eventZones, 
      commandMarkers,
    editorMode, // Add editorMode as a dependency
    currentMousePosition: canvasMousePosition,
    selectedEventZoneId, // Pass selectedEventZoneId
    });
  }, [
    config, 
    waypoints, 
    selectedWaypoint, 
    robotState, 
    optimizedPath, 
    backgroundImage, 
    metersToPixels, // This is a useCallback, stable if its own deps are stable
    isMeasuring, 
    measurePoints, 
    measuredDistance, 
    measurePreviewPoint,
    eventZones, 
    commandMarkers,
    editorMode,
    canvasMousePosition,
    selectedEventZoneId, // Add selectedEventZoneId to dependency array
    canvasRef // Though canvasRef itself doesn't change, its availability might gate the effect
  ]);

  // Prepare props for AppUI
  const appUIProps: AppUIProps = {
    pathName, setPathName,
    waypoints, optimizationMetrics,
    waypointCreationMode, setWaypointCreationMode,
    editorMode, setEditorMode,
    pendingEventZoneCreation,
    clearPendingEventZoneCreation: () => setPendingEventZoneCreation(null),
    pendingCommandMarkerCreation,
    clearPendingCommandMarkerCreation: () => setPendingCommandMarkerCreation(null),
    isMeasuring, toggleMeasureMode,
    showFloatingGraphs, setShowFloatingGraphs,
    imageInputRef, fileInputRef,
    exportPath, isPlaying, stopPath, playPath,
    optimizedPath, simulationSpeedFactor, setSimulationSpeedFactor,
    clearPath, showConfig, setShowConfig,
    canvasRef, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasMouseLeave,
    displayTime, totalPathTime, handleTimeSliderChange, setIsScrubbing, handleTimeSliderMouseUp,
    loadBackgroundImage, importPath,
    selectedWaypoint, setSelectedWaypoint,
    config, setConfig,
    updateWaypointByIndex, deleteWaypoint,
    editorPosition, handleEditorMouseDown,
    simulationHistory, floatingGraphPosition, handleFloatingGraphMouseDown,
    message,
    handleWaypointDragStart, handleWaypointDragOver, handleWaypointDragLeave, handleWaypointDrop, handleWaypointDragEnd,
    draggedWaypointSourceIndex,
    commandMarkers, setCommandMarkers,
    eventZones, setEventZones,
    onAddCommandMarker: addCommandMarker,
    onUpdateCommandMarker: updateCommandMarker,
    onDeleteCommandMarker: deleteCommandMarker,
    onAddEventZone: addEventZone,
    onUpdateEventZone: updateEventZone,
    onDeleteEventZone: deleteEventZone,
    selectedEventZoneId, // Pass to AppUI
    setSelectedEventZoneId, // Pass to AppUI
    // Dragging event zone props for AppUI (though handlers are in App.tsx)
    isDraggingEventZone,
    setIsDraggingEventZone,
    dragOffset,
    setDragOffset,
    // Resizing event zone props for AppUI
    isResizingEventZone,
    setIsResizingEventZone,
    // Command Marker props for AppUI (though handlers are in App.tsx)
    selectedCommandMarkerId,
    setSelectedCommandMarkerId,
    isRepositioningCommandMarker,
    setIsRepositioningCommandMarker,
  };

  return <AppUI {...appUIProps} />;
};

export default HolonomicPathOptimizer;
