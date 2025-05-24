export class CubicSpline {
  x: number[];
  y: number[];
  n: number;
  h: number[];
  alpha: number[];
  l: number[];
  mu: number[];
  z: number[];
  c: number[];
  b: number[];
  d: number[];

  constructor(x: number[], y: number[]) {
    this.x = x;
    this.y = y;
    this.n = x.length;
    this.h = [];
    this.alpha = [];
    this.l = [];
    this.mu = [];
    this.z = [];
    this.c = [];
    this.b = [];
    this.d = [];
    
    this.calculateSpline();
  }
  
  calculateSpline() {
    // Calculate h values
    for (let i = 0; i < this.n - 1; i++) {
      this.h[i] = this.x[i + 1] - this.x[i];
    }
    
    // Calculate alpha values
    for (let i = 1; i < this.n - 1; i++) {
      this.alpha[i] = (3 / this.h[i]) * (this.y[i + 1] - this.y[i]) - 
                     (3 / this.h[i - 1]) * (this.y[i] - this.y[i - 1]);
    }
    
    // Solve tridiagonal system
    this.l[0] = 1;
    this.mu[0] = 0;
    this.z[0] = 0;
    
    for (let i = 1; i < this.n - 1; i++) {
      this.l[i] = 2 * (this.x[i + 1] - this.x[i - 1]) - this.h[i - 1] * this.mu[i - 1];
      this.mu[i] = this.h[i] / this.l[i];
      this.z[i] = (this.alpha[i] - this.h[i - 1] * this.z[i - 1]) / this.l[i];
    }
    
    this.l[this.n - 1] = 1;
    this.z[this.n - 1] = 0;
    this.c[this.n - 1] = 0;
    
    for (let j = this.n - 2; j >= 0; j--) {
      this.c[j] = this.z[j] - this.mu[j] * this.c[j + 1];
      this.b[j] = (this.y[j + 1] - this.y[j]) / this.h[j] - this.h[j] * (this.c[j + 1] + 2 * this.c[j]) / 3;
      this.d[j] = (this.c[j + 1] - this.c[j]) / (3 * this.h[j]);
    }
  }
  
  interpolate(t: number): number {
    let i = 0;
    for (i = 0; i < this.n - 1; i++) {
      if (t <= this.x[i + 1]) break;
    }
    if (i >= this.n - 1) i = this.n - 2;
    
    const dt = t - this.x[i];
    return this.y[i] + this.b[i] * dt + this.c[i] * dt * dt + this.d[i] * dt * dt * dt;
  }
  
  derivative(t: number): number {
    let i = 0;
    for (i = 0; i < this.n - 1; i++) {
      if (t <= this.x[i + 1]) break;
    }
    if (i >= this.n - 1) i = this.n - 2;
    
    const dt = t - this.x[i];
    return this.b[i] + 2 * this.c[i] * dt + 3 * this.d[i] * dt * dt;
  }
  
  secondDerivative(t: number): number {
    let i = 0;
    for (i = 0; i < this.n - 1; i++) {
      if (t <= this.x[i + 1]) break;
    }
    if (i >= this.n - 1) i = this.n - 2;
    
    const dt = t - this.x[i];
    return 2 * this.c[i] + 6 * this.d[i] * dt;
  }
} 