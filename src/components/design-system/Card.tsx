import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
  isFeature?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, hoverable = false, isFeature = false, ...props }, ref) => {
    const baseStyles = 'rounded-2xl p-6 transition-shadow duration-200';
    
    const lightStyles = 'bg-bg-card text-text-primary shadow-md';
    const darkStyles = 'dark:bg-dark-bg-card dark:text-dark-text-primary dark:shadow-lg dark:border dark:border-dark-border';
    
    const featureGradient = isFeature 
      ? 'bg-gradient-to-br from-yellow-400 via-pink-400 to-blue-300 dark:from-yellow-700 dark:via-pink-700 dark:to-blue-900 text-white dark:text-white'
      : '';
    
    const hoverStyles = hoverable ? 'hover:shadow-lg dark:hover:shadow-xl cursor-pointer' : '';

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${!isFeature ? lightStyles : ''} ${darkStyles} ${featureGradient} ${hoverStyles} ${className || ''}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
