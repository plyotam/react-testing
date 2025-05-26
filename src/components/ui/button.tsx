import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string;
  size?: string;
  // Add other common props if they appear in errors, e.g., asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  // For now, variant and size are accepted but not used to change styles
  // A real implementation would use cva or similar to apply classes based on these props
  return <button ref={ref} className={className} {...props} />;
});
Button.displayName = "Button";

export { Button }; 