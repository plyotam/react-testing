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
  
  // Props for Event Zone Dragging
  eventZones: EventZone[];
  selectedZoneId: string | null;
  setSelectedZoneId: React.Dispatch<React.SetStateAction<string | null>>;
  draggingZoneId: string | null;
  setDraggingZoneId: React.Dispatch<React.SetStateAction<string | null>>;
  updateEventZoneCoordinates: (zoneId: string, newX: number, newY: number) => void;

  // Props for Event Zone Resizing
  resizingZoneId: string | null;
  setResizingZoneId: React.Dispatch<React.SetStateAction<string | null>>;
  updateEventZoneRadius: (zoneId: string, newRadius: number) => void;

  // Props for Command Marker Dragging
  commandMarkers: CommandMarker[]; // Add CommandMarker type
  // optimizedPath is already a prop
  selectedCommandMarkerId: string | null;
  setSelectedCommandMarkerId: React.Dispatch<React.SetStateAction<string | null>>;
  draggingCommandMarkerId: string | null;
  setDraggingCommandMarkerId: React.Dispatch<React.SetStateAction<string | null>>;
  updateCommandMarkerPosition: (markerId: string, newS: number, newTime: number) => void;
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
    setCanvasMousePosition,
    eventZones, selectedZoneId, setSelectedZoneId,
    draggingZoneId, setDraggingZoneId, updateEventZoneCoordinates,
    resizingZoneId, setResizingZoneId, updateEventZoneRadius,
    commandMarkers, selectedCommandMarkerId, setSelectedCommandMarkerId,
    draggingCommandMarkerId, setDraggingCommandMarkerId, updateCommandMarkerPosition
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
      setSelectedZoneId(null); // Deselect zone if measuring
      setIsDragging(false);
      setDraggingWaypointIndex(null);
      setDraggingZoneId(null);
      return;
    }

    if (editorMode === 'waypoints') {
      // Check for Resize Handle click first if a zone is selected
      if (selectedZoneId) {
        const zone = eventZones.find(z => z.id === selectedZoneId);
        if (zone) {
          const handleRadiusPixels = 5 + 2; // 5px drawn radius + 2px tolerance
          const zoneScreenX = args.canvasRef.current ? args.canvasRef.current.width / config.field.width * zone.x : 0; // approx metersToPixels
          const zoneScreenRadius = args.canvasRef.current ? args.canvasRef.current.width / config.field.width * zone.radius : 0; // approx metersToPixels
          
          // Approximate metersToPixels if canvasRef.current is not available or for simplicity here
          // This should ideally use the passed metersToPixels function, but it's not directly available in this scope
          // For a more robust solution, pass metersToPixels to this handler or calculate outside if possible.
          // Let's assume pixelX, pixelY are the direct click coords.
          const tempMetersToPixels = (m: number) => (canvas?.width || 0) / config.field.width * m;


          const handleScreenX = tempMetersToPixels(zone.x + zone.radius);
          const handleScreenY = tempMetersToPixels(zone.y);
          
          const distToHandleSq = (pixelX - handleScreenX)**2 + (pixelY - handleScreenY)**2;

          if (distToHandleSq <= handleRadiusPixels**2) {
            setResizingZoneId(zone.id);
            setIsDragging(true); // Use general dragging flag
            setDraggingZoneId(null); // Ensure not dragging whole zone
            setDraggingWaypointIndex(null);
            return; // Resize handle clicked
          }
        }
      }

      // Check for Event Zone Drag (if not resizing)
      for (const zone of eventZones) {
        const distanceToZoneCenter = Math.sqrt((zone.x - meterX) ** 2 + (zone.y - meterY) ** 2);
        if (distanceToZoneCenter <= zone.radius) {
          setSelectedZoneId(zone.id);
          setDraggingZoneId(zone.id);
          setIsDragging(true);
          setSelectedWaypoint(null);
          setDraggingWaypointIndex(null);
          setResizingZoneId(null); 
          setSelectedCommandMarkerId(null); // Deselect command marker
          setDraggingCommandMarkerId(null);
          return; 
        }
      }

      // Check for Command Marker click
      const markerClickRadiusInMeters = 0.15; // Adjust as needed
      for (const marker of commandMarkers) {
        if (marker.renderX !== undefined && marker.renderY !== undefined) {
          const distToMarkerSq = (marker.renderX - meterX)**2 + (marker.renderY - meterY)**2;
          if (distToMarkerSq <= markerClickRadiusInMeters**2) {
            setSelectedCommandMarkerId(marker.id);
            setDraggingCommandMarkerId(marker.id);
            setIsDragging(true);
            setSelectedWaypoint(null);
            setDraggingWaypointIndex(null);
            setSelectedZoneId(null);
            setDraggingZoneId(null);
            setResizingZoneId(null);
            return; // Command marker clicked
          }
        }
      }

      // If no zone or marker interaction, check for Waypoint click
      const clickedWaypointIndex = waypoints.findIndex(wp => {
        const distance = Math.sqrt((wp.x - meterX) ** 2 + (wp.y - meterY) ** 2);
        return distance <= wp.radius;
      });

      if (clickedWaypointIndex !== -1) {
        setSelectedWaypoint(clickedWaypointIndex);
        setDraggingWaypointIndex(clickedWaypointIndex);
        setIsDragging(true); // Use a general dragging flag
        setSelectedZoneId(null); 
        setDraggingZoneId(null);
        setResizingZoneId(null);
        setSelectedCommandMarkerId(null); // Deselect command marker
        setDraggingCommandMarkerId(null);
        return; 
      }
      
      // If nothing was clicked, deselect everything
      setSelectedWaypoint(null);
      setSelectedZoneId(null);
      setSelectedCommandMarkerId(null);
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

    if (isDragging) {
      if (draggingWaypointIndex !== null) {
        updateWaypointCoordinates(draggingWaypointIndex, meterX, meterY);
      } else if (draggingZoneId !== null) {
        updateEventZoneCoordinates(draggingZoneId, meterX, meterY);
      } else if (resizingZoneId !== null) {
        const zone = eventZones.find(z => z.id === resizingZoneId);
        if (zone) {
          const newRadius = Math.sqrt((meterX - zone.x)**2 + (meterY - zone.y)**2);
          updateEventZoneRadius(resizingZoneId, newRadius);
        }
      } else if (draggingCommandMarkerId !== null && optimizedPath && optimizedPath.length > 0) {
        let closestPathPoint: OptimizedPathPoint | null = null;
        let minDistanceSq = Infinity;
        for (const p of optimizedPath) {
          const distSq = (p.x - meterX)**2 + (p.y - meterY)**2;
          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            closestPathPoint = p;
          }
        }
        if (closestPathPoint) {
          updateCommandMarkerPosition(draggingCommandMarkerId, closestPathPoint.s, closestPathPoint.time);
        }
      }
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
      setDraggingZoneId(null); 
      setResizingZoneId(null); 
      setDraggingCommandMarkerId(null); // Reset dragging command marker ID
    } else if (mouseDownPosition && editorMode === 'waypoints') { 
      // This part is for creating waypoints on click if not dragging anything.
      // Ensure no command marker or zone was just selected for waypoint creation
      if (selectedCommandMarkerId || selectedZoneId) return; 
      const rect = canvas.getBoundingClientRect();
      // The current logic might need adjustment if a zone was just clicked (selected) without dragging.
      // For now, selectedZoneId might be set, but draggingZoneId is null here if not dragged.
      // This part seems okay, as it checks distDragged. A simple click on a zone (handled by mouseDown) would not trigger this.
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
      setDraggingZoneId(null);
      setResizingZoneId(null); 
      setDraggingCommandMarkerId(null); // Also reset dragging command marker ID
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