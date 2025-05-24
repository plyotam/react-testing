import { CubicSpline } from './CubicSpline';

const EPSILON = 1e-6; // For handling very small segment lengths

export class QuinticSpline {
  private s_coords: number[];
  private y_coords: number[]; // Original y-coordinates (or x-coordinates of the path)
  private v_coords: number[] = []; // Derivatives at knots (from internal cubic spline)
  private acc_coords: number[] = []; // Second derivatives at knots (from internal cubic spline)
  
  private coeffs: {a: number, b: number, c: number, d: number, e: number, f: number}[] = [];
  private n: number;

  constructor(s_in: number[], y_in: number[]) {
    this.s_coords = [...s_in];
    this.y_coords = [...y_in];
    this.n = this.s_coords.length;

    if (this.n < 2) {
      // Not enough points to form a spline segment
      return;
    }

    // 1. Use CubicSpline to get smooth derivatives at knots
    // Assuming CubicSpline is robust enough for the given s_in, y_in
    const internalCubicSpline = new CubicSpline(this.s_coords, this.y_coords);
    
    this.v_coords = this.s_coords.map(s => internalCubicSpline.derivative(s));
    this.acc_coords = this.s_coords.map(s => 0);

    // 2. Calculate Quintic Hermite coefficients for each segment
    for (let i = 0; i < this.n - 1; i++) {
      const s_i = this.s_coords[i];
      const s_ip1 = this.s_coords[i+1];
      
      const y_i = this.y_coords[i];
      const y_ip1 = this.y_coords[i+1];
      
      const v_i = this.v_coords[i];
      const v_ip1 = this.v_coords[i+1];
      
      const acc_i = this.acc_coords[i];
      const acc_ip1 = this.acc_coords[i+1];

      const h = s_ip1 - s_i;

      let c_a, c_b, c_c, c_d, c_e, c_f;

      if (Math.abs(h) < EPSILON) {
        // Segment is too small, use a quadratic based on initial conditions
        c_a = y_i;
        c_b = v_i;
        c_c = acc_i / 2;
        c_d = 0;
        c_e = 0;
        c_f = 0;
      } else {
        c_a = y_i;
        c_b = v_i;
        c_c = acc_i / 2;

        const h2 = h * h;
        const h3 = h2 * h;
        const h4 = h3 * h;
        const h5 = h4 * h;

        // Coefficients for p(t) = a + bt + ct^2 + dt^3 + et^4 + ft^5 (t relative to s_i)
        // Derived from matching y, y', y'' at s_i and s_{i+1}
        // where y_i, v_i, acc_i are p(0), p'(0), p''(0)
        // and y_{ip1}, v_{ip1}, acc_{ip1} are p(h), p'(h), p''(h)

        c_d = (20 * (y_ip1 - y_i) - (12 * v_i + 8 * v_ip1) * h - (3 * acc_i - acc_ip1) * h2) / (2 * h3);
        c_e = (30 * (y_i - y_ip1) + (16 * v_i + 14 * v_ip1) * h + (3 * acc_i - 2 * acc_ip1) * h2) / (2 * h4);
        c_f = (12 * (y_ip1 - y_i) - (6 * v_i + 6 * v_ip1) * h - (acc_i - acc_ip1) * h2) / (2 * h5);
      }
      
      this.coeffs.push({ a: c_a, b: c_b, c: c_c, d: c_d, e: c_e, f: c_f });
    }
  }

  private getSegment(s_val: number): { index: number, t_rel: number } {
    if (this.n < 2) {
      // Should not happen if constructor handles this, but as a safeguard
      throw new Error("Spline not properly initialized or too few points.");
    }

    let i = 0;
    // If s_val is before the first point, clamp to the start of the first segment
    if (s_val < this.s_coords[0]) {
      i = 0;
    } 
    // If s_val is after the last point, clamp to the start of the last segment
    else if (s_val >= this.s_coords[this.n - 1]) {
      i = this.n - 2;
    } 
    // Otherwise, find the segment s_val falls into
    else {
      for (i = 0; i < this.n - 2; i++) { // Iterate up to n-2 segments
        if (s_val <= this.s_coords[i + 1]) {
          break;
        }
      }
    }
    
    const t_rel = s_val - this.s_coords[i];
    return { index: i, t_rel: t_rel };
  }

  interpolate(s_val: number): number {
    if (this.n < 2 || this.coeffs.length === 0) {
        // Handle cases with 0 or 1 point:
        if (this.n === 1) return this.y_coords[0];
        return 0; // Or throw error, or NaN
    }

    const { index, t_rel } = this.getSegment(s_val);
    const C = this.coeffs[index];
    
    const t2 = t_rel * t_rel;
    const t3 = t2 * t_rel;
    const t4 = t3 * t_rel;
    const t5 = t4 * t_rel;

    return C.a + C.b * t_rel + C.c * t2 + C.d * t3 + C.e * t4 + C.f * t5;
  }

  derivative(s_val: number): number {
    if (this.n < 2 || this.coeffs.length === 0) {
        if (this.n === 1) return 0; // Derivative is 0 for a single point
        return 0;
    }

    const { index, t_rel } = this.getSegment(s_val);
    const C = this.coeffs[index];

    const t2 = t_rel * t_rel;
    const t3 = t2 * t_rel;
    const t4 = t3 * t_rel;

    return C.b + 2 * C.c * t_rel + 3 * C.d * t2 + 4 * C.e * t3 + 5 * C.f * t4;
  }

  secondDerivative(s_val: number): number {
    if (this.n < 2 || this.coeffs.length === 0) {
        if (this.n === 1) return 0; // Second derivative is 0
        return 0;
    }
    
    const { index, t_rel } = this.getSegment(s_val);
    const C = this.coeffs[index];
    
    const t2 = t_rel * t_rel;
    const t3 = t2 * t_rel;

    return 2 * C.c + 6 * C.d * t_rel + 12 * C.e * t2 + 20 * C.f * t3;
  }
} 