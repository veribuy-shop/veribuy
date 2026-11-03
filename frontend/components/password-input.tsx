'use client';

import { Eye, EyeOff } from 'lucide-react';
import { type ComponentProps, useState } from 'react';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'> & {
  /** What this field is for, so screen readers can tell several toggles apart. */
  toggleLabel?: string;
};

/** A password field with its own show or hide button. */
export function PasswordInput({ className, toggleLabel = 'password', ...props }: PasswordInputProps) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={shown ? 'text' : 'password'} className={cn(className, 'pr-11')} />
      <button
        type="button"
        onClick={() => setShown((current) => !current)}
        // Keeps the cursor in the field, so people can carry on typing.
        onMouseDown={(e) => e.preventDefault()}
        aria-label={`${shown ? 'Hide' : 'Show'} ${toggleLabel}`}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-gray-400 hover:text-gray-600"
      >
        {shown ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
