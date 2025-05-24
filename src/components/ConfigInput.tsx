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
    <label className="text-sm font-medium text-text-secondary">{label}:</label>
    <div className="flex items-center gap-1">
      <input
        type={type}
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        className="w-24 px-3 py-2 border border-border-color-secondary rounded text-sm bg-input-background text-text-primary text-right shadow-sm focus:ring-accent-primary focus:border-accent-primary"
      />
      {unit && <span className="text-text-secondary text-xs pl-1">{unit}</span>} {/* Adjusted unit padding slightly */}
    </div>
  </div>
);

export default ConfigInput; 