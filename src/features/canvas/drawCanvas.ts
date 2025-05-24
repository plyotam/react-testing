// import React from 'react'; // Removed: Required for JSX, even if not directly used in this file
import { Waypoint, Point, RobotState, OptimizedPathPoint, EventZone, CommandMarker } from '../../types';
import { Config } from '../../config/appConfig';

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
    
    ctx.save();
    ctx.strokeStyle = zone.color || 'rgba(255, 165, 0, 0.7)'; // Default orange-ish
    ctx.fillStyle = zone.color ? zone.color.replace(/[^,]+$/, '0.3)') : 'rgba(255, 165, 0, 0.3)'; // Lighter fill
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(zoneX, zoneY, zoneRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    // Optional: Draw command name or ID
    ctx.fillStyle = zone.color || 'rgba(255, 165, 0, 1)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(zone.commandName, zoneX, zoneY);
    ctx.restore();
  });

  // Draw Command Markers
  if (optimizedPath.length > 0 && commandMarkers.length > 0) {
    commandMarkers.forEach(marker => {
      // Find the closest point on the optimizedPath for this marker's 's' value
      let closestPathPoint: OptimizedPathPoint | null = null;
      let minSDiff = Infinity;

      for (const p of optimizedPath) {
        const sDiff = Math.abs(p.s - marker.s);
        if (sDiff < minSDiff) {
          minSDiff = sDiff;
          closestPathPoint = p;
        }
        // Optimization: if path.s exceeds marker.s significantly, can break early if path is dense enough
        // For simplicity, we iterate through all points or until path.s is much larger.
        if (p.s > marker.s + config.path.pathResolution * 5 && sDiff > minSDiff) { // Heuristic break
            // break; // Disabling break for now to ensure we find the true closest for sparse paths
        }
      }

      if (closestPathPoint) {
        const markerX = metersToPixels(closestPathPoint.x);
        const markerY = metersToPixels(closestPathPoint.y);
        
        ctx.save();
        // Style for command markers (e.g., a small diamond or specific icon)
        ctx.fillStyle = '#FFD700'; // Gold color
        ctx.strokeStyle = '#DAA520'; // Darker gold for border
        ctx.lineWidth = 1.5;
        
        // Draw a small diamond shape
        const size = 6; // pixels
        ctx.beginPath();
        ctx.moveTo(markerX, markerY - size);
        ctx.lineTo(markerX + size, markerY);
        ctx.lineTo(markerX, markerY + size);
        ctx.lineTo(markerX - size, markerY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Optional: Draw command name text next to it
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        // Simple shadow for text
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 2;
        ctx.fillText(marker.commandName, markerX + size + 3, markerY);
        ctx.shadowBlur = 0; // Reset shadow

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
}; 