import { Waypoint, Point, SimulationDataPoint } from '../../types';
import { Config } from '../../config/appConfig'; // Corrected import path
import { CubicSpline } from '../../utils/CubicSpline';
import { QuinticSpline } from '../../utils/QuinticSpline';

export const generateOptimalPath = (
    waypoints: Waypoint[],
    config: Config,
    showMessage: (type: 'error' | 'info', text: string) => void
  ): {
    path: SimulationDataPoint[];
    metrics: {
        totalDistance: number;
        totalTime: number;
        maxCurvature: number;
        maxAcceleration: number;
        energyConsumption: number;
    } | null;
} => {
    const hardWaypoints = waypoints.filter(wp => !wp.isGuidePoint);
    const guideWaypoints = waypoints.filter(wp => wp.isGuidePoint);

    if (hardWaypoints.length < 2) {
      if (waypoints.length > 0 && hardWaypoints.length < waypoints.length) { 
        showMessage('info', 'Path requires at least two non-guide waypoints. Current guides will not form a path.');
      } else if (waypoints.length > 0) { 
        // showMessage('info', 'Path requires at least two waypoints to form a path.'); 
      }
      return { path: [], metrics: null };
    }
    
    let pathPointsForSpline: Point[] = hardWaypoints.map(wp => ({ x: wp.x, y: wp.y }));
    console.log('[Debug] Initial pathPointsForSpline (from hardWaypoints):', JSON.parse(JSON.stringify(pathPointsForSpline)));

    if (guideWaypoints.length > 0 && pathPointsForSpline.length >= 2) {
      const attractedPathPoints: Point[] = [pathPointsForSpline[0]];

      for (let i = 0; i < pathPointsForSpline.length - 1; i++) {
        const p1 = pathPointsForSpline[i];
        const p2 = pathPointsForSpline[i+1];
        
        const segmentLength = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);

        const influentialGuides = guideWaypoints.map(gw => {
          const l2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
          if (l2 === 0) return { gw, distSq: Infinity, t: 0, closestPointOnSegment: {...p1} }; 
          let t = ((gw.x - p1.x) * (p2.x - p1.x) + (gw.y - p1.y) * (p2.y - p1.y)) / l2;
          t = Math.max(0, Math.min(1, t)); 
          const closestPointOnSegment = {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
          };
          const distSq = (gw.x - closestPointOnSegment.x)**2 + (gw.y - closestPointOnSegment.y)**2;
          return { gw, distSq, t, closestPointOnSegment };
        })
        .filter(item => item.distSq < ( (segmentLength/2 + item.gw.radius) * (segmentLength/2 + item.gw.radius) * 2) ) 
        .sort((a,b) => a.t - b.t);

        for (const { gw, closestPointOnSegment } of influentialGuides) {
          const influence = gw.guideInfluence ?? 0.5; 
          const attractedPoint = {
            x: closestPointOnSegment.x + (gw.x - closestPointOnSegment.x) * influence,
            y: closestPointOnSegment.y + (gw.y - closestPointOnSegment.y) * influence,
          };
          attractedPathPoints.push(attractedPoint);
        }
        attractedPathPoints.push(p2); 
      }
      
      pathPointsForSpline = attractedPathPoints.filter((point, index, self) => 
        index === 0 || !(point.x === self[index-1].x && point.y === self[index-1].y)
      );
      console.log('[Debug] pathPointsForSpline after guide influence:', JSON.parse(JSON.stringify(pathPointsForSpline)));
    }

    if (pathPointsForSpline.length < 2) {
      showMessage('error', 'Not enough points for spline path after guide influence. Try different waypoints or guides.');
      return { path: [], metrics: null };
    }

    const path: SimulationDataPoint[] = [];
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
        showMessage('error', 'Spline creation failed due to insufficient points from A*.');
        return { path: [], metrics: null };
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
        if (distSq < minDistToHardWaypoint) { 
          minDistToHardWaypoint = distSq;
          nearestHardWaypointIndex = j;
        }
      }
      minDistToHardWaypoint = Math.sqrt(minDistToHardWaypoint); 
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
             if (nearestHardWaypoint) { 
                const simNearDist = nearestHardWaypoint.radius * 0.70;
                currentEffectiveStopDist = Math.min(simNearDist, config.path.pathResolution * 2.0);
             }
            const distanceToHardStopEdge = Math.max(0, minDistToHardWaypoint - currentEffectiveStopDist);
            const velocityToNaturallyStopAtHardStopEdge = Math.sqrt(2 * config.robot.maxAcceleration * distanceToHardStopEdge);
            targetVelocityForKinematics = Math.min(targetVelocityForKinematics, velocityToNaturallyStopAtHardStopEdge);
          }
        } else if (nearestHardWaypoint) { 
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
    return { path, metrics };
}; 