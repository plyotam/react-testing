import { SimulationDataPoint } from '../types';

export const normalizeAngleDeg = (angle: number): number => { // Normalize to [-180, 180)
    let result = angle % 360;
    if (result <= -180) result += 360;
    if (result > 180) result -= 360; 
    result = (angle % 360 + 540) % 360 - 180;
    if (result === -180 && angle > 0) return 180; 
    return result;
};

export const interpolateAngleDeg = (startAngle: number, endAngle: number, t: number): number => {
    const sa = normalizeAngleDeg(startAngle);
    const ea = normalizeAngleDeg(endAngle);
    let diff = ea - sa;

    if (diff > 180) {
        diff -= 360;
    } else if (diff < -180) {
        diff += 360;
    }
    return sa + diff * t; 
};

export const addDataPointToHistory = (history: SimulationDataPoint[], newDataPoint: SimulationDataPoint): SimulationDataPoint[] => {
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