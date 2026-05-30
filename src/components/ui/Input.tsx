import clsx from 'clsx';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  currency?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, currency, id, ...props }, ref) => {
    const inputId = id || label;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none transition-colors',
            currency && 'input-currency text-right font-mono',
            error && 'border-danger',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
