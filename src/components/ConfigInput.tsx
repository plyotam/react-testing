import React from 'react';

interface ConfigInputProps {
  label: string;
  value: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  step?: string | number;
  min?: number;
  max?: number;
  unit?: string;
  className?: string;
}

const ConfigInput: React.FC<ConfigInputProps> = ({ 
  label, 
  value, 
  onChange, 
  type = 'number', 
  step = 'any', 
  min, 
  max, 
  unit, 
  className = '' 
}) => (
  <div className={`flex items-center justify-between ${className}`}>
    <label className="text-sm text-text-secondary">{label}:</label>
    <div className="flex items-center gap-1">
      <input
        type={type}
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        className="w-24 px-2 py-1 border border-background-primary rounded text-sm bg-text-primary text-background-primary text-right"
      />
      {unit && <span className="text-text-secondary text-xs">{unit}</span>}
    </div>
  </div>
);

export default ConfigInput; 