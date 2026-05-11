'use client';

import * as React from 'react';

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
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
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

type TabsListProps = {
  children: React.ReactNode;
  className?: string;
};

const TabsList = ({ children, className = '' }: TabsListProps) => (
  <div
    role="tablist"
    className={`inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500 ${className}`}
  >
    {children}
  </div>
);

type TabsTriggerProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

const TabsTrigger = ({ value, children, className = '' }: TabsTriggerProps) => {
  const { value: activeValue, setValue } = useTabsContext();
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      onClick={() => setValue(value)}
      data-state={isActive ? 'active' : 'inactive'}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? 'bg-white text-gray-950 shadow-sm'
          : 'hover:bg-gray-50 hover:text-gray-900'
      } ${className}`}
    >
      {children}
    </button>
  );
};

type TabsContentProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

const TabsContent = ({ value, children, className = '' }: TabsContentProps) => {
  const { value: activeValue } = useTabsContext();

  if (value !== activeValue) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      data-state="active"
      className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </div>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
