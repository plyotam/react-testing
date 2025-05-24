// import React from 'react'; // Removed: Required for JSX, even if not directly used in this file
import { Waypoint, Point, RobotState, OptimizedPathPoint, EventZone, CommandMarker } from '../../types';
import { Config } from '../../config/appConfig';

// Helper function to convert hex to rgba
function hexToRgba(hex: string, alpha: number = 1): string {
  // Remove # if present
  hex = hex.startsWith('#') ? hex.slice(1) : hex;

  // Handle short hex (e.g., #RGB)
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    // Fallback for invalid hex - could return a default color or throw error
    console.warn(`Invalid hex color: ${hex}. Using default fallback.`);
    return `rgba(255, 165, 0, ${alpha})`; // Default to orange with specified alpha
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


// import { Point } from '../../types'; // Ensure Point is imported // REMOVED DUPLICATE

interface DrawCanvasArgs {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  config: Config;
  waypoints: Waypoint[];
  selectedWaypoint: number | null;
  robotState: RobotState;
  optimizedPath: OptimizedPathPoint[];
  backgroundImage: HTMLImageElement | null;
  metersToPixels: (meters: number) => number;
  isMeasuring: boolean;
  measurePoints: Point[];
  measuredDistance: number | null;
  measurePreviewPoint: Point | null;
  eventZones: EventZone[];
  commandMarkers: CommandMarker[];
  editorMode: 'waypoints' | 'addEventZoneCenter' | 'addCommandMarker';
  canvasMousePosition: Point | null; // x, y in meters - RENAMED from currentMousePosition
  selectedZoneId: string | null; // For highlighting selected zone
  selectedCommandMarkerId: string | null; // For highlighting selected command marker
}

export const drawCanvasContent = ({
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
  editorMode,
  canvasMousePosition, // RENAMED from currentMousePosition
  selectedZoneId,
  selectedCommandMarkerId,
}: DrawCanvasArgs) => {
  const canvasWidth = metersToPixels(config.field.width);
  const canvasHeight = metersToPixels(config.field.height);

  // Set canvas size (already done in App.tsx effect, but good for clarity if this function were standalone)
  // canvas.width = canvasWidth; 
  // canvas.height = canvasHeight;
  
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Draw background
  ctx.fillStyle = config.field.backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  if (backgroundImage) {
    ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
  }
  
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
  
  if (optimizedPath.length > 1) {
    for (let i = 0; i < optimizedPath.length - 1; i++) {
      const current = optimizedPath[i];
      const next = optimizedPath[i + 1];
      if (config.path.velocityVisualization) {
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
  
  waypoints.forEach((waypoint, index) => {
    const isSelected = selectedWaypoint === index;
    const pixelX = metersToPixels(waypoint.x);
    const pixelY = metersToPixels(waypoint.y);
    const pixelRadius = metersToPixels(waypoint.radius);
    
    ctx.save();
    if (waypoint.isGuidePoint) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = isSelected ? config.path.selectedColor : '#8888FF';
      ctx.fillStyle = isSelected ? `${config.path.selectedColor}15` : '#8888FF15';
    } else {
      ctx.strokeStyle = isSelected ? config.path.selectedColor : config.path.waypointBorderColor;
      ctx.fillStyle = isSelected ? `${config.path.selectedColor}20` : `${config.path.waypointColor}20`;
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pixelX, pixelY, pixelRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    
    if (waypoint.isGuidePoint) {
      ctx.fillStyle = isSelected ? config.path.selectedColor : '#AAAAFF';
    } else {
      ctx.fillStyle = isSelected ? config.path.selectedColor : config.path.waypointColor;
    }
    ctx.beginPath();
    ctx.arc(pixelX, pixelY, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    if (waypoint.heading !== undefined) {
      const angle = waypoint.heading * Math.PI / 180;
      const length = metersToPixels(0.8);
      ctx.strokeStyle = isSelected ? config.path.selectedColor : config.path.waypointColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pixelX, pixelY);
      ctx.lineTo(pixelX + Math.cos(angle) * length, pixelY + Math.sin(angle) * length);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(pixelX + Math.cos(angle) * length, pixelY + Math.sin(angle) * length);
      ctx.lineTo(pixelX + Math.cos(angle - 0.5) * (length - 12), pixelY + Math.sin(angle - 0.5) * (length - 12));
      ctx.moveTo(pixelX + Math.cos(angle) * length, pixelY + Math.sin(angle) * length);
      ctx.lineTo(pixelX + Math.cos(angle + 0.5) * (length - 12), pixelY + Math.sin(angle + 0.5) * (length - 12));
      ctx.stroke();
    }
    
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
    ctx.strokeText(velocityStatusText, pixelX, pixelY - pixelRadius - 5);
    ctx.fillText(velocityStatusText, pixelX, pixelY - pixelRadius - 5);
  });
  
  const robot = robotState;
  const pixelX = metersToPixels(robot.x);
  const pixelY = metersToPixels(robot.y);
  const pixelRadiusRob = metersToPixels(config.robot.radius);
  
  ctx.fillStyle = config.robot.color;
  ctx.beginPath();
  ctx.arc(pixelX, pixelY, pixelRadiusRob, 0, 2 * Math.PI);
  ctx.fill();
  
  const robotAngle = robot.rotation * Math.PI / 180;
  const orientationLength = metersToPixels(config.robot.orientationLength);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pixelX, pixelY);
  ctx.lineTo(pixelX + Math.cos(robotAngle) * orientationLength, 
             pixelY + Math.sin(robotAngle) * orientationLength);
  ctx.stroke();
  
  ctx.save();
  ctx.translate(pixelX, pixelY);
  ctx.rotate(robotAngle);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  const wheelbasePixels = metersToPixels(config.physics.wheelbase);
  const trackWidthPixels = metersToPixels(config.physics.trackWidth);
  ctx.beginPath();
  ctx.rect(-wheelbasePixels / 2, -trackWidthPixels / 2, 
           wheelbasePixels, trackWidthPixels);
  ctx.stroke();
  ctx.restore();
  
  // Draw Event Zones
  eventZones.forEach(zone => {
    const zoneX = metersToPixels(zone.x);
    const zoneY = metersToPixels(zone.y);
    const zoneRadius = metersToPixels(zone.radius);
    const isSelected = zone.id === selectedZoneId;
    const baseColor = zone.color || '#FFA500'; // Default to orange, matches EventZoneEditor
    const fillAlpha = 0.4; 
    const borderAlpha = 0.8;
    const selectedBorderAlpha = 0.9; // More opaque for selected border
    const selectedFillAlpha = 0.5; // Slightly more opaque fill for selected

    let fillStyle: string;
    let strokeStyle: string;

    if (baseColor.startsWith('#')) {
      fillStyle = hexToRgba(baseColor, isSelected ? selectedFillAlpha : fillAlpha);
      strokeStyle = hexToRgba(baseColor, isSelected ? selectedBorderAlpha : borderAlpha);
    } else if (baseColor.startsWith('rgba')) {
      // Attempt to parse and reconstruct RGBA to ensure correct alpha
      try {
        const parts = baseColor.match(/[\d\.]+/g);
        if (parts && parts.length >= 3) {
          const r = parts[0];
          const g = parts[1];
          const b = parts[2];
          fillStyle = `rgba(${r}, ${g}, ${b}, ${isSelected ? selectedFillAlpha : fillAlpha})`;
          strokeStyle = `rgba(${r}, ${g}, ${b}, ${isSelected ? selectedBorderAlpha : borderAlpha})`;
        } else {
          throw new Error('Invalid RGBA string');
        }
      } catch (e) {
        console.warn(`Error parsing RGBA string ${baseColor}:`, e);
        fillStyle = hexToRgba('#FFA500', isSelected ? selectedFillAlpha : fillAlpha); // Fallback
        strokeStyle = hexToRgba('#FFA500', isSelected ? selectedBorderAlpha : borderAlpha); // Fallback
      }
    } else { 
      // Fallback for unknown formats
      fillStyle = hexToRgba('#FFA500', isSelected ? selectedFillAlpha : fillAlpha);
      strokeStyle = hexToRgba('#FFA500', isSelected ? selectedBorderAlpha : borderAlpha);
    }
    
    ctx.save();
    // If selected, the gold border takes precedence for stroke
    ctx.strokeStyle = isSelected ? hexToRgba('#FFD700', selectedBorderAlpha) : strokeStyle;
    ctx.fillStyle = fillStyle;
    ctx.lineWidth = isSelected ? 3 : 2; // Thicker border if selected
    ctx.beginPath();
    ctx.arc(zoneX, zoneY, zoneRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Draw resize handle if selected
    if (isSelected) {
      const handleRadiusPixels = 5; // Pixel size for the handle
      const handleX = zoneX + zoneRadius; // Right edge of the circle in pixels
      const handleY = zoneY; // Middle of the circle in pixels

      ctx.fillStyle = '#FFD700'; // Gold, same as selection
      ctx.strokeStyle = '#000000'; // Black border for handle
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(handleX, handleY, handleRadiusPixels, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    
    // Draw command name with improved legibility
    const minPixelRadiusForText = 20; // Only draw text if zone radius is at least 20 pixels
    if (zoneRadius >= minPixelRadiusForText) {
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Text outline for better contrast
      ctx.strokeStyle = '#000000'; // Black outline
      ctx.lineWidth = 3; // Outline width
      ctx.strokeText(zone.commandName, zoneX, zoneY);
      
      // Actual text
      ctx.fillStyle = '#FFFFFF'; // White text
      ctx.fillText(zone.commandName, zoneX, zoneY);
    }
    ctx.restore();
  });

  // Draw Command Markers
  if (commandMarkers.length > 0) {
    commandMarkers.forEach(marker => {
      if (marker.renderX !== undefined && marker.renderY !== undefined) {
        const markerX = metersToPixels(marker.renderX);
        const markerY = metersToPixels(marker.renderY);
        const isSelected = marker.id === selectedCommandMarkerId;
        
        ctx.save();
        // New style for command markers: filled circle with border
        const markerRadius = isSelected ? 7 : 5; // Larger if selected
        ctx.fillStyle = '#FFFF00'; // Bright Yellow
        ctx.strokeStyle = isSelected ? '#FF00FF' : '#000000'; // Magenta border if selected, else black
        ctx.lineWidth = isSelected ? 2 : 1; // Thicker border if selected
        
        ctx.beginPath();
        ctx.arc(markerX, markerY, markerRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Draw command name text next to it
        ctx.fillStyle = '#FFFFFF'; // White text
        ctx.strokeStyle = '#000000'; // Black outline for text
        ctx.lineWidth = 2; // Text outline width
        ctx.font = 'bold 9px sans-serif'; // Slightly bolder font
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        const textX = markerX + markerRadius + 4; // Position text to the right of the circle
        const textY = markerY;

        ctx.strokeText(marker.commandName, textX, textY);
        ctx.fillText(marker.commandName, textX, textY);

        ctx.restore();
      }
    });
  }

  if (isMeasuring) {
    const orangeAccent = config.path.selectedColor || '#f59e0b';
    const lightGreyText = config.path.textPrimary || '#ecf0f1';
    const textBackgroundColor = 'rgba(75, 75, 75, 0.75)'; 
    const pointRadius = 6;
    const crosshairSize = 4;

    measurePoints.forEach((point, index) => {
      const mx = metersToPixels(point.x);
      const my = metersToPixels(point.y);
      ctx.strokeStyle = orangeAccent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, pointRadius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.strokeStyle = lightGreyText; 
      ctx.lineWidth = 1; 
      ctx.beginPath();
      ctx.moveTo(mx - crosshairSize, my);
      ctx.lineTo(mx + crosshairSize, my);
      ctx.moveTo(mx, my - crosshairSize);
      ctx.lineTo(mx, my + crosshairSize);
      ctx.stroke();
      ctx.fillStyle = lightGreyText; 
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${index + 1}`, mx, my - pointRadius - 4);
    });

    const drawDistanceText = (text: string, midX: number, midY: number) => {
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = 13; 
      const padding = 5;
      ctx.fillStyle = textBackgroundColor;
      ctx.beginPath();
      ctx.rect(midX - textWidth / 2 - padding, midY - textHeight - padding, textWidth + padding * 2, textHeight + padding * 2);
      ctx.fill();
      ctx.fillStyle = lightGreyText; 
      ctx.fillText(text, midX, midY);
    };

    if (measurePoints.length === 1 && measurePreviewPoint) {
      const p1 = {x: metersToPixels(measurePoints[0].x), y: metersToPixels(measurePoints[0].y)};
      const pPreview = {x: metersToPixels(measurePreviewPoint.x), y: metersToPixels(measurePreviewPoint.y)};
      ctx.strokeStyle = orangeAccent;
      ctx.lineWidth = 1.5; 
      ctx.setLineDash([4, 4]); 
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(pPreview.x, pPreview.y);
      ctx.stroke();
      ctx.setLineDash([]); 
      const midX = (p1.x + pPreview.x) / 2;
      const midY = (p1.y + pPreview.y) / 2 - 10; 
      const dx = measurePreviewPoint.x - measurePoints[0].x;
      const dy = measurePreviewPoint.y - measurePoints[0].y;
      const currentPreviewDistance = Math.sqrt(dx*dx + dy*dy);
      drawDistanceText(`${currentPreviewDistance.toFixed(2)} m`, midX, midY);
    } 
    else if (measurePoints.length === 2 && measuredDistance !== null) {
      const p1m = {x: metersToPixels(measurePoints[0].x), y: metersToPixels(measurePoints[0].y)};
      const p2m = {x: metersToPixels(measurePoints[1].x), y: metersToPixels(measurePoints[1].y)};
      ctx.strokeStyle = orangeAccent;
      ctx.lineWidth = 2; 
      ctx.beginPath();
      ctx.moveTo(p1m.x, p1m.y);
      ctx.lineTo(p2m.x, p2m.y);
      ctx.stroke();
      const midXDist = (p1m.x + p2m.x) / 2;
      const midYDist = (p1m.y + p2m.y) / 2 - 10; 
      drawDistanceText(`${measuredDistance.toFixed(2)} m`, midXDist, midYDist);
    }
  }

  // Draw visual cues for editor modes
  if (canvasMousePosition) { // RENAMED from currentMousePosition
    if (editorMode === 'addEventZoneCenter') {
      const radiusInPixels = metersToPixels(config.waypoint.defaultRadius); // Using waypoint defaultRadius as a proxy for event zone default, adjust if specific config exists
      const zoneX = metersToPixels(canvasMousePosition.x); // RENAMED
      const zoneY = metersToPixels(canvasMousePosition.y); // RENAMED
      
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)'; // Semi-transparent orange
      ctx.fillStyle = 'rgba(255, 165, 0, 0.15)';   // Very transparent orange fill
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // Dashed line for preview
      
      ctx.beginPath();
      ctx.arc(zoneX, zoneY, radiusInPixels, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    } else if (editorMode === 'addCommandMarker' && optimizedPath && optimizedPath.length > 0) {
      let closestPathPoint: OptimizedPathPoint | null = null;
      let minDistanceSq = Infinity;

      // Find closest point on path to mouse (in meters)
      for (const p of optimizedPath) {
        const distSq = (p.x - canvasMousePosition.x) ** 2 + (p.y - canvasMousePosition.y) ** 2; // RENAMED
        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          closestPathPoint = p;
        }
      }

      if (closestPathPoint) {
        const markerX = metersToPixels(closestPathPoint.x);
        const markerY = metersToPixels(closestPathPoint.y);
        
        ctx.save();
        const markerRadius = 5; 
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; // Semi-transparent Yellow
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';   // Semi-transparent Black border
        ctx.lineWidth = 1; 
        
        ctx.beginPath();
        ctx.arc(markerX, markerY, markerRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }
};