import * as React from "react"

export const Dialog = ({ children, open, onOpenChange }: any) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {children}
      </div>
    </div>
  );
};

export const DialogContent = ({ children, className }: any) => <div className={`flex flex-col flex-1 overflow-hidden ${className}`}>{children}</div>;
export const DialogHeader = ({ children, className }: any) => <div className={`p-6 border-b border-gray-100 ${className}`}>{children}</div>;
export const DialogTitle = ({ children, className }: any) => <h3 className={`text-xl font-bold text-gray-950 ${className}`}>{children}</h3>;
export const DialogDescription = ({ children, className }: any) => <p className={`text-sm text-gray-500 ${className}`}>{children}</p>;
export const DialogFooter = ({ children, className }: any) => <div className={`p-6 border-t border-gray-100 bg-gray-50 flex justify-end ${className}`}>{children}</div>;
export const DialogTrigger = ({ children }: any) => children;
