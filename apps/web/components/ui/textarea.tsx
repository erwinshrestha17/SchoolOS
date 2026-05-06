'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm focus:border-primary-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 transition-colors placeholder:text-slate-400 min-h-[80px]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
