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

  // Event Zone selection
  eventZones: EventZone[];
  selectedEventZoneId: string | null;
  setSelectedEventZoneId: (id: string | null) => void;

  // Event Zone dragging
  isDraggingEventZone: boolean;
  setIsDraggingEventZone: React.Dispatch<React.SetStateAction<boolean>>;
  dragOffset: { x: number; y: number } | null;
  setDragOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  onUpdateEventZone: (zone: EventZone) => void;

  // Event Zone resizing
  isResizingEventZone: boolean;
  setIsResizingEventZone: React.Dispatch<React.SetStateAction<boolean>>;

  // Command Marker interaction
  commandMarkers: CommandMarker[];
  selectedCommandMarkerId: string | null;
  setSelectedCommandMarkerId: React.Dispatch<React.SetStateAction<string | null>>;
  isRepositioningCommandMarker: boolean;
  setIsRepositioningCommandMarker: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdateCommandMarker: (marker: CommandMarker) => void;
  // pixelsToMeters and optimizedPath are already in args
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
    eventZones, selectedEventZoneId, setSelectedEventZoneId, // Destructure selection args
    // Destructure dragging args
    isDraggingEventZone, setIsDraggingEventZone,
    dragOffset, setDragOffset, onUpdateEventZone,
    // Destructure resizing args
    isResizingEventZone, setIsResizingEventZone,
    // Destructure command marker args
    commandMarkers, selectedCommandMarkerId, setSelectedCommandMarkerId,
    isRepositioningCommandMarker, setIsRepositioningCommandMarker, onUpdateCommandMarker
  } = args;

  const RESIZE_HANDLE_RADIUS_PIXELS = 8;
  const MIN_EVENT_ZONE_RADIUS_METERS = 0.2;
  const COMMAND_MARKER_CLICK_RADIUS_METERS = 0.1; // Define constant
  const metersToPixels = args.metersToPixels; 

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    const meterX = pixelsToMeters(pixelX);
    const meterY = pixelsToMeters(pixelY);
    
    setMouseDownPosition({ x: pixelX, y: pixelY });

    // Part 1: Handling Repositioning Click for Command Marker (if active)
    if (isRepositioningCommandMarker && selectedCommandMarkerId && optimizedPath.length > 0) {
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
        const currentMarker = commandMarkers.find(m => m.id === selectedCommandMarkerId);
        if (currentMarker) {
          onUpdateCommandMarker({ 
            ...currentMarker, 
            s: closestPathPoint.s, 
            time: closestPathPoint.time, 
            renderX: closestPathPoint.x, 
            renderY: closestPathPoint.y 
          });
        }
      }
      setIsRepositioningCommandMarker(false);
      setSelectedCommandMarkerId(null);
      return; // Action complete
    }
    // Reset repositioning state if we clicked away or it was not a repositioning action
    setIsRepositioningCommandMarker(false); 
    // setSelectedCommandMarkerId(null); // Will be set if another entity is not clicked

    // Check for Event Zone Resize Handle click
    if (selectedEventZoneId && !isDraggingEventZone && !isResizingEventZone) { // Added !isResizingEventZone to prevent re-triggering
      const selectedZone = eventZones.find(z => z.id === selectedEventZoneId);
      if (selectedZone) {
        const handlePixelX = metersToPixels(selectedZone.x + selectedZone.radius);
        const handlePixelY = metersToPixels(selectedZone.y);
        const distanceToHandle = Math.sqrt((pixelX - handlePixelX)**2 + (pixelY - handlePixelY)**2);
        if (distanceToHandle <= RESIZE_HANDLE_RADIUS_PIXELS) {
          setIsResizingEventZone(true);
          // Clear other states
          setSelectedWaypoint(null);
          setSelectedCommandMarkerId(null);
          setIsDraggingEventZone(false);
          setIsDragging(false);
          return; // Resize initiated
        }
      }
    }
    
    // Event Zone Selection & Dragging Logic
    for (const zone of eventZones) {
      const distanceToZoneCenter = Math.sqrt((zone.x - meterX)**2 + (zone.y - meterY)**2);
      if (distanceToZoneCenter <= zone.radius) {
        if (zone.id !== selectedEventZoneId) {
          setSelectedEventZoneId(zone.id);
          setSelectedWaypoint(null);
          setSelectedCommandMarkerId(null);
        }
        setIsDraggingEventZone(true);
        setDragOffset({ x: meterX - zone.x, y: meterY - zone.y });
        // Clear other states
        setIsResizingEventZone(false);
        setIsDragging(false);
        return; // Zone interaction
      }
    }

    // Part 2: Handling Initial Command Marker Selection
    let foundMarkerClick = false;
    if (optimizedPath.length > 0) { // Markers depend on path
        for (const marker of commandMarkers) {
            if (marker.renderX !== undefined && marker.renderY !== undefined) {
                const distance = Math.sqrt((meterX - marker.renderX)**2 + (meterY - marker.renderY)**2);
                if (distance < COMMAND_MARKER_CLICK_RADIUS_METERS) {
                    setSelectedCommandMarkerId(marker.id);
                    setIsRepositioningCommandMarker(true); // Activate repositioning mode
                    // Clear other selections/modes
                    setSelectedWaypoint(null);
                    setSelectedEventZoneId(null);
                    setIsDraggingEventZone(false);
                    setIsResizingEventZone(false);
                    setIsDragging(false);
                    foundMarkerClick = true;
                    break; 
                }
            }
        }
    }
    if (foundMarkerClick) return;


    // Waypoint Interaction (Selection/Dragging)
    const clickedWaypointIndex = waypoints.findIndex(wp => {
      const distance = Math.sqrt((wp.x - meterX)**2 + (wp.y - meterY)**2);
      return distance <= wp.radius;
    });

    if (clickedWaypointIndex !== -1) {
      setSelectedWaypoint(clickedWaypointIndex);
      setDraggingWaypointIndex(clickedWaypointIndex);
      setIsDragging(true);
      // Clear other selections/modes
      setSelectedEventZoneId(null);
      setSelectedCommandMarkerId(null);
      setIsRepositioningCommandMarker(false);
      setIsDraggingEventZone(false);
      setIsResizingEventZone(false);
      return;
    }

    // Special Editor Modes (Add Event Zone / Add Command Marker via UI button)
    if (editorMode === 'addEventZoneCenter') {
      if (initiatePendingEventZone) {
        initiatePendingEventZone(meterX, meterY);
        setSelectedEventZoneId(null); 
        setSelectedWaypoint(null);
        setSelectedCommandMarkerId(null);
      }
      return;
    }
    if (editorMode === 'addCommandMarker') {
      if (optimizedPath && optimizedPath.length > 0 && initiatePendingCommandMarker) {
        // ... (logic for finding closest path point and initiating marker creation) ...
        // This logic is already present and seems fine.
        // Ensure other selections are cleared if needed
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

    // Measuring Tool Logic
    if (isMeasuring) {
      // ... (measuring logic is present and seems fine) ...
      // Ensure other selections are cleared
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
      setSelectedEventZoneId(null);
      setSelectedCommandMarkerId(null);
      setIsDragging(false);
      setIsDraggingEventZone(false);
      setIsResizingEventZone(false);
      setIsRepositioningCommandMarker(false);
      return;
    }
    
    // If clicked on empty space (no entity clicked, not in special mode)
    setSelectedWaypoint(null);
    setSelectedEventZoneId(null);
    setSelectedCommandMarkerId(null); // Clear selected command marker
    setIsRepositioningCommandMarker(false); // Ensure repositioning is off
    setIsDragging(false);
    setIsDraggingEventZone(false);
    setIsResizingEventZone(false);
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
    } else if (isDraggingEventZone && selectedEventZoneId && dragOffset) {
      const selectedZone = eventZones.find(z => z.id === selectedEventZoneId);
      if (selectedZone) {
        const newX = meterX - dragOffset.x;
        const newY = meterY - dragOffset.y;
        onUpdateEventZone({ ...selectedZone, x: newX, y: newY });
      }
    } else if (isResizingEventZone && selectedEventZoneId) {
      const selectedZone = eventZones.find(z => z.id === selectedEventZoneId);
      if (selectedZone) {
        let newRadius = Math.sqrt((meterX - selectedZone.x)**2 + (meterY - selectedZone.y)**2);
        newRadius = Math.max(newRadius, MIN_EVENT_ZONE_RADIUS_METERS);
        onUpdateEventZone({ ...selectedZone, radius: newRadius });
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
    }
    if (isDraggingEventZone) {
      setIsDraggingEventZone(false);
      setDragOffset(null);
    }
    if (isResizingEventZone) {
      setIsResizingEventZone(false);
    }
    if (isRepositioningCommandMarker) { // Finalize repositioning on mouse up
        // The actual update happens on the next click in handleCanvasMouseDown
        // Here, we just turn off the mode. Alternatively, update could happen here
        // but current spec implies a two-click process.
        // For now, just turn off the mode. If a marker was selected, it remains selected until
        // the next click either repositions it or deselects it.
        // The prompt's Part 1 of handleCanvasMouseDown does the update on the *second* click.
        // So, if isRepositioningCommandMarker is true on mouseUp, it means the user is still in that mode
        // and hasn't made the second click yet. We should probably keep it true.
        // OR, if mouseUp means "commit current preview", then update here.
        // Given the prompt, the update happens on the *next mousedown*.
        // So, we don't set isRepositioningCommandMarker to false here.
        // However, if no marker is selected, then it should be false.
        if (!selectedCommandMarkerId) {
             setIsRepositioningCommandMarker(false);
        }
    }
    
    // Waypoint creation logic (should not trigger if a drag was just completed)
    // The check for selectedWaypoint === null and selectedEventZoneId === null handles this
    if (mouseDownPosition && editorMode === 'waypoints') {
      const rect = canvas.getBoundingClientRect();
      const upPixelX = e.clientX - rect.left;
      const upPixelY = e.clientY - rect.top;
      
      const distDragged = Math.sqrt(
        (upPixelX - mouseDownPosition.x)**2 + 
        (upPixelY - mouseDownPosition.y)**2
      );

      if (distDragged < 5 && selectedWaypoint === null && selectedEventZoneId === null && !isMeasuring) { 
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
    if (isDraggingEventZone) { 
      setIsDraggingEventZone(false);
      setDragOffset(null);
      // setMouseDownPosition(null); // Optional: reset if drag should fully cancel
    }
    if (isResizingEventZone) {
      setIsResizingEventZone(false);
    }
    if (isRepositioningCommandMarker) {
      // If mouse leaves canvas during repositioning, cancel it.
      setIsRepositioningCommandMarker(false);
      setSelectedCommandMarkerId(null); // Also deselect
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