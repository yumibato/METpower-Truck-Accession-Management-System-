import React from 'react';

type BadgeColor = 'green' | 'red' | 'gray' | 'blue' | 'amber';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  children: React.ReactNode;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ color = 'gray', className, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150';
    
    const colorStyles = {
      green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    };

    return (
      <span
        ref={ref}
        className={`${baseStyles} ${colorStyles[color]} ${className || ''}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
