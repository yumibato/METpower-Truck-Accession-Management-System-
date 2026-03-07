import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'pill';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    const baseStyles = 'font-medium transition-all duration-150 ease inline-flex items-center justify-center';
    
    const variantStyles = {
      primary: 'bg-accent text-white hover:brightness-90 active:scale-95',
      secondary: 'bg-bg-input text-text-primary dark:bg-dark-bg-input dark:text-dark-text-primary hover:bg-gray-300 dark:hover:bg-gray-700 active:scale-95',
      ghost: 'border border-border dark:border-dark-border text-text-primary dark:text-dark-text-primary hover:bg-bg-input dark:hover:bg-dark-bg-input active:scale-95',
      pill: 'rounded-full px-3 py-1 text-sm font-medium',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs rounded-md',
      md: 'px-4 py-2 text-sm rounded-lg',
      lg: 'px-6 py-3 text-base rounded-lg',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
