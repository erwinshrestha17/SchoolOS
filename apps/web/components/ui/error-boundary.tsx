'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { ApiRequestError } from '../../lib/api';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const requestId =
        this.state.error instanceof ApiRequestError
          ? this.state.error.requestId
          : undefined;

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-danger-100 bg-danger-50/30 p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger-100 text-danger-600">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Something went wrong</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500 leading-relaxed">
            An unexpected error occurred while rendering this section.
          </p>
          {requestId && (
            <p className="mt-3 rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-500">
              Request ID: {requestId}
            </p>
          )}
          <div className="mt-8 flex gap-3">
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw size={16} />
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
