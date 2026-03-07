import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium text-text-secondary dark:text-dark-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted dark:text-dark-text-muted">{icon}</div>}
          <input
            ref={ref}
            className={`
              w-full px-3 py-2 text-sm rounded-lg
              bg-bg-input dark:bg-dark-bg-input
              text-text-primary dark:text-dark-text-primary
              border border-border dark:border-dark-border
              placeholder:text-text-muted dark:placeholder:text-dark-text-muted
              focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
              transition-all duration-150
              ${icon ? 'pl-9' : ''}
              ${error ? 'border-red-500 dark:border-red-400' : ''}
              ${className || ''}
            `}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
