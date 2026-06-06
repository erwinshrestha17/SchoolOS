import * as React from "react"
import { createPortal } from "react-dom"

export const Dialog = ({ children, open, onOpenChange }: any) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        {children}
      </div>
    </div>
  );

  if (mounted && typeof window !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return null;
};

export const DialogContent = ({ children, className }: any) => <div className={`flex flex-col flex-1 overflow-hidden ${className}`}>{children}</div>;
export const DialogHeader = ({ children, className }: any) => <div className={`p-6 border-b border-gray-100 ${className}`}>{children}</div>;
export const DialogTitle = ({ children, className }: any) => <h3 className={`text-xl font-bold text-gray-950 ${className}`}>{children}</h3>;
export const DialogDescription = ({ children, className }: any) => <p className={`text-sm text-gray-500 ${className}`}>{children}</p>;
export const DialogFooter = ({ children, className }: any) => <div className={`p-6 border-t border-gray-100 bg-gray-50 flex justify-end ${className}`}>{children}</div>;
export const DialogTrigger = ({ children }: any) => children;

