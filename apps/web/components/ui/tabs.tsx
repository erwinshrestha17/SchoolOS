'use client';

import * as React from 'react';

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);

  if (!context) {
    throw new Error('Tabs components must be used inside <Tabs>');
  }

  return context;
}

type TabsProps = {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
};

const Tabs = ({
  children,
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
}: TabsProps) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
  const value = controlledValue ?? internalValue;
  const baseId = React.useId();

  const setValue = React.useCallback(
    (newValue: string) => {
      if (controlledValue === undefined) {
        setInternalValue(newValue);
      }

      onValueChange?.(newValue);
    },
    [controlledValue, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ value, setValue, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

type TabsListProps = React.HTMLAttributes<HTMLDivElement>;

const TabsList = ({
  children,
  className = '',
  onKeyDown,
  ...props
}: TabsListProps) => {
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not(:disabled)',
      ),
    );
    if (tabs.length === 0) return;
    const currentIndex = tabs.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex =
        currentIndex < 0
          ? tabs.length - 1
          : (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  }

  return (
    <div
      role="tablist"
      className={`inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500 ${className}`}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </div>
  );
};

type TabsTriggerProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value'
> & {
  value: string;
};

const TabsTrigger = ({
  value,
  children,
  className = '',
  onClick,
  ...props
}: TabsTriggerProps) => {
  const { value: activeValue, setValue, baseId } = useTabsContext();
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      id={tabId(baseId, value)}
      aria-controls={panelId(baseId, value)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setValue(value);
      }}
      data-state={isActive ? 'active' : 'inactive'}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? 'bg-white text-gray-950 shadow-sm'
          : 'hover:bg-gray-50 hover:text-gray-900'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
};

const TabsContent = ({
  value,
  children,
  className = '',
  ...props
}: TabsContentProps) => {
  const { value: activeValue, baseId } = useTabsContext();

  if (value !== activeValue) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={panelId(baseId, value)}
      aria-labelledby={tabId(baseId, value)}
      tabIndex={0}
      data-state="active"
      className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

function tabId(baseId: string, value: string) {
  return `${baseId}-tab-${encodeURIComponent(value)}`;
}

function panelId(baseId: string, value: string) {
  return `${baseId}-panel-${encodeURIComponent(value)}`;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
