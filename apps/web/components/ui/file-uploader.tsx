'use client';

import { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  module: string;
  onUploadComplete: (fileId: string, fileName: string) => void;
  onRemove: (fileId: string) => void;
  maxFiles?: number;
  accept?: string;
  className?: string;
}

export function FileUploader({
  module,
  onUploadComplete,
  onRemove,
  maxFiles = 5,
  accept = '*',
  className,
}: FileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedFiles.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed.`);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await api.uploadFile(file, module);
        const newFile = { id: result.id, name: result.fileName };
        setUploadedFiles((prev) => [...prev, newFile]);
        onUploadComplete(result.id, result.fileName);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    onRemove(id);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div 
        className={cn(
          "p-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center transition-all cursor-pointer",
          isUploading ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200 hover:border-primary-300 hover:bg-primary-50/30",
          error ? "border-rose-200 bg-rose-50/30" : ""
        )}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept={accept}
          multiple={maxFiles > 1}
        />
        
        {isUploading ? (
          <>
            <Loader2 className="h-10 w-10 mb-4 text-primary-500 animate-spin" />
            <p className="text-sm font-bold text-slate-900">Uploading...</p>
            <p className="text-xs text-slate-500 mt-1">Please wait while we process your files.</p>
          </>
        ) : (
          <>
            <div className="h-12 w-12 mb-4 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-primary-500 transition-colors">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-slate-900">Click to upload or drag and drop</p>
            <p className="text-xs text-slate-500 mt-1">
              {accept === '*' ? 'Any file' : accept} up to 10MB
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="grid gap-2">
          {uploadedFiles.map((file) => (
            <div 
              key={file.id} 
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 animate-in fade-in slide-in-from-left-2"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-primary-500 shadow-sm">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">
                  {file.name}
                </span>
                <CheckCircle2 className="h-4 w-4 text-success-500" />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(file.id);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
