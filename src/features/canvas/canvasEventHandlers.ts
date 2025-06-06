import React from 'react';
import { Waypoint, Point, OptimizedPathPoint } from '../../types';
import { Config } from '../../config/appConfig';

export interface CanvasEventHandlersArgs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  pixelsToMeters: (pixels: number) => number;
  isMeasuring: boolean;
  measurePoints: Point[];
  setMeasurePoints: React.Dispatch<React.SetStateAction<Point[]>>;
  measuredDistance: number | null;
  setMeasuredDistance: React.Dispatch<React.SetStateAction<number | null>>;
  setMeasurePreviewPoint: React.Dispatch<React.SetStateAction<Point | null>>;
  setSelectedWaypoint: React.Dispatch<React.SetStateAction<number | null>>;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  setDraggingWaypointIndex: React.Dispatch<React.SetStateAction<number | null>>;
  waypoints: Waypoint[];
  updateWaypointCoordinates: (index: number, newX: number, newY: number) => void;
  isDragging: boolean;
  draggingWaypointIndex: number | null;
  mouseDownPosition: { x: number; y: number } | null;
  setMouseDownPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  selectedWaypoint: number | null;
  waypointCreationMode: 'hard' | 'guide';
  config: Config; // For default waypoint properties
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  measurePreviewPoint: Point | null;

  // New props for editor modes and entity creation
  editorMode: 'waypoints' | 'addEventZoneCenter' | 'addCommandMarker';
  initiatePendingEventZone?: (x: number, y: number) => void;
  showMessage?: (type: 'error' | 'info' | 'warn', text: string) => void;
  optimizedPath: OptimizedPathPoint[];
  initiatePendingCommandMarker?: (s: number, time: number, x: number, y: number) => void;
  setCanvasMousePosition: React.Dispatch<React.SetStateAction<Point | null>>;
}

export const createCanvasEventHandlers = (args: CanvasEventHandlersArgs) => {
  const { 
    canvasRef, pixelsToMeters, isMeasuring, 
    measurePoints, setMeasurePoints, 
    setMeasuredDistance, 
    measurePreviewPoint, setMeasurePreviewPoint, 
    setSelectedWaypoint, setIsDragging, setDraggingWaypointIndex, 
    waypoints, updateWaypointCoordinates, isDragging, draggingWaypointIndex, 
    mouseDownPosition, setMouseDownPosition, selectedWaypoint, waypointCreationMode, 
    config, setWaypoints, 
    editorMode, initiatePendingEventZone, showMessage,
    optimizedPath, initiatePendingCommandMarker,
    setCanvasMousePosition
  } = args;

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    const meterX = pixelsToMeters(pixelX);
    const meterY = pixelsToMeters(pixelY);
    
    setMouseDownPosition({ x: pixelX, y: pixelY });

    if (editorMode === 'addEventZoneCenter') {
      if (initiatePendingEventZone) {
        initiatePendingEventZone(meterX, meterY); 
      }
      return; 
    }

    if (editorMode === 'addCommandMarker') {
      if (optimizedPath && optimizedPath.length > 0 && initiatePendingCommandMarker) {
        let closestPoint: OptimizedPathPoint | null = null;
        let minDistanceSq = Infinity;

        for (const p of optimizedPath) {
          const distSq = (p.x - meterX) ** 2 + (p.y - meterY) ** 2;
          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            closestPoint = p;
          }
        }

        if (closestPoint) {
          initiatePendingCommandMarker(closestPoint.s, closestPoint.time, closestPoint.x, closestPoint.y);
        }
      } else if (showMessage) {
        showMessage('warn', 'Optimized path must exist to add a command marker.');
      }
      return;
    }

    if (isMeasuring) {
      setMeasurePoints(prevPoints => {
        if (prevPoints.length === 0) { 
          setMeasuredDistance(null); 
          setMeasurePreviewPoint(null); 
          return [{ x: meterX, y: meterY }];
        } else if (prevPoints.length === 1) { 
          const newPoints = [...prevPoints, { x: meterX, y: meterY }];
          const dx = newPoints[1].x - newPoints[0].x;
          const dy = newPoints[1].y - newPoints[0].y;
          setMeasuredDistance(Math.sqrt(dx*dx + dy*dy));
          setMeasurePreviewPoint(null); 
          return newPoints;
        } else { 
          setMeasuredDistance(null);
          setMeasurePreviewPoint(null); 
          return [{ x: meterX, y: meterY }];
        }
      });
      setSelectedWaypoint(null);
      setIsDragging(false);
      setDraggingWaypointIndex(null);
      return; 
    }

    const clickedWaypointIndex = waypoints.findIndex(wp => {
      const distance = Math.sqrt((wp.x - meterX) ** 2 + (wp.y - meterY) ** 2);
      return distance <= wp.radius;
    });

    if (clickedWaypointIndex !== -1) {
      setSelectedWaypoint(clickedWaypointIndex);
      setDraggingWaypointIndex(clickedWaypointIndex);
      setIsDragging(true);
    } else {
      setSelectedWaypoint(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    const meterX = pixelsToMeters(pixelX);
    const meterY = pixelsToMeters(pixelY);

    if (isMeasuring && measurePoints.length === 1) {
      setMeasurePreviewPoint({ x: meterX, y: meterY });
    } else if (measurePreviewPoint !== null) {
      setMeasurePreviewPoint(null);
    }

    if (isDragging && draggingWaypointIndex !== null) {
      updateWaypointCoordinates(draggingWaypointIndex, meterX, meterY);
    }
    // Update mouse position for visual cues
    setCanvasMousePosition({ x: meterX, y: meterY });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging) {
      setIsDragging(false);
      setDraggingWaypointIndex(null);
    } else if (mouseDownPosition && editorMode === 'waypoints') {
      const rect = canvas.getBoundingClientRect();
      const upPixelX = e.clientX - rect.left;
      const upPixelY = e.clientY - rect.top;
      
      const distDragged = Math.sqrt(
        (upPixelX - mouseDownPosition.x)**2 + 
        (upPixelY - mouseDownPosition.y)**2
      );

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
          guideInfluence: isGuide ? 0.5 : undefined,
        };
        
        setWaypoints(prevWaypoints => {
          const newWaypoints = [...prevWaypoints, newWaypoint];
          setSelectedWaypoint(newWaypoints.length - 1);
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
      setMouseDownPosition(null); 
    }
    // Clear mouse position when mouse leaves canvas
    setCanvasMousePosition(null);
  };

  return {
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasMouseLeave,
  };
}; 