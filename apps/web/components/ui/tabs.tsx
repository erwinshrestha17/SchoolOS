import * as React from "react"

const Tabs = ({ children, defaultValue, className }: { children: React.ReactNode, defaultValue: string, className?: string }) => {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <div className={className}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { activeValue: value, setValue });
        }
        return child;
      })}
    </div>
  );
};

const TabsList = ({ children, className, activeValue, setValue }: any) => (
  <div className={`inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500 ${className}`}>
    {React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child as React.ReactElement<any>, { activeValue, setValue });
      }
      return child;
    })}
  </div>
);

const TabsTrigger = ({ value, children, activeValue, setValue, className }: any) => (
  <button
    onClick={() => setValue(value)}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
      activeValue === value ? "bg-white text-gray-950 shadow-sm" : "hover:bg-gray-50 hover:text-gray-900"
    } ${className}`}
  >
    {children}
  </button>
);

const TabsContent = ({ value, activeValue, children, className }: any) => {
  if (value !== activeValue) return null;
  return <div className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${className}`}>{children}</div>;
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
