'use client';

import { Children, cloneElement, isValidElement, useId, type ReactNode, type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { Input } from './input';
import { Select } from './select';
import { Textarea } from './textarea';

// Existing form imports share the same controls as the rest of SchoolOS.
export { Input, Select };
export { Textarea as TextArea };

interface FormFieldProps {
  label: string;
  description?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

type ControlProps = HTMLAttributes<HTMLElement> & { children?: ReactNode; required?: boolean; type?: string };

function isControl(type: unknown) {
  return type === 'input' || type === 'select' || type === 'textarea' || type === Input || type === Select || type === Textarea;
}

export function FormField({ label, description, error, children, className, htmlFor }: FormFieldProps) {
  const generatedId = useId();
  const messageId = `${generatedId}-message`;
  const labelId = `${generatedId}-label`;
  let controlId: string | undefined = htmlFor;
  let required = false;
  let linked = false;

  function associate(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (child) => {
      if (!isValidElement<ControlProps>(child) || linked) return child;
      if (isControl(child.type) && child.props.type !== 'hidden') {
        linked = true;
        controlId = child.props.id ?? htmlFor ?? `${generatedId}-control`;
        required = Boolean(child.props.required);
        return cloneElement(child, {
          id: controlId,
          'aria-invalid': error ? true : child.props['aria-invalid'],
          'aria-describedby': [child.props['aria-describedby'], error || description ? messageId : undefined].filter(Boolean).join(' ') || undefined,
        });
      }
      // Only traverse native layout containers. Composite selectors manage
      // their own controls; the labelled group supplies their outer context.
      if (typeof child.type === 'string' && child.props.children) {
        return cloneElement(child, { children: associate(child.props.children) });
      }
      return child;
    });
  }

  const fields = associate(children);
  const message = error || description;
  return (
    <div
      className={cn('min-w-0 space-y-1.5', className)}
      role={linked ? undefined : 'group'}
      aria-labelledby={linked ? undefined : labelId}
      aria-describedby={!linked && message ? messageId : undefined}
    >
      <label id={labelId} htmlFor={controlId} className="block text-sm font-medium leading-5 text-foreground">
        {label}{required ? <span className="ml-1 text-danger-700" aria-hidden="true">*</span> : null}
      </label>
      {fields}
      {message ? <p id={messageId} role={error ? 'alert' : undefined} className={cn('text-xs leading-5', error ? 'text-danger-700' : 'text-muted-foreground')}>{message}</p> : null}
    </div>
  );
}
