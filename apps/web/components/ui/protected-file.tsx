'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';
import { CheckCircle2, Download, ExternalLink, Loader2 } from 'lucide-react';
import {
  downloadProtectedFile,
  openProtectedFile,
} from '../../lib/api/client';
import { cn } from '../../lib/utils';
import { Button, type ButtonProps } from './button';
import { Tooltip } from './tooltip';

type ProtectedFileAction = 'preview' | 'download';
type ProtectedFileStatus = 'idle' | 'loading' | 'success' | 'error';

type ProtectedFileBaseProps = {
  fileAssetId?: string | null;
  fileName?: string | null;
  action?: ProtectedFileAction;
  disabled?: boolean;
  children?: ReactNode;
  label?: string;
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  ariaLabel?: string;
  showStatus?: boolean;
  statusClassName?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

function actionText(action: ProtectedFileAction) {
  return action === 'download' ? 'Download file' : 'Open file';
}

function loadingText(action: ProtectedFileAction) {
  return action === 'download'
    ? 'Downloading protected file...'
    : 'Opening protected file...';
}

function successText(action: ProtectedFileAction) {
  return action === 'download'
    ? 'File download started.'
    : 'File opened securely.';
}

function errorText(action: ProtectedFileAction) {
  return action === 'download'
    ? 'The file could not be downloaded. Please try again.'
    : 'The file could not be opened. Please try again.';
}

function useProtectedFileAction({
  action,
  fileAssetId,
  fileName,
  loadingLabel,
  successLabel,
  errorLabel,
  onSuccess,
  onError,
}: Required<Pick<ProtectedFileBaseProps, 'action'>> &
  Pick<
    ProtectedFileBaseProps,
    | 'fileAssetId'
    | 'fileName'
    | 'loadingLabel'
    | 'successLabel'
    | 'errorLabel'
    | 'onSuccess'
    | 'onError'
  >) {
  const [status, setStatus] = useState<ProtectedFileStatus>('idle');
  const [message, setMessage] = useState('');

  async function run() {
    if (!fileAssetId) {
      const nextMessage = 'This protected file is not available yet.';
      setStatus('error');
      setMessage(nextMessage);
      onError?.(nextMessage);
      return;
    }

    setStatus('loading');
    setMessage(loadingLabel || loadingText(action));

    try {
      if (action === 'download') {
        await downloadProtectedFile(fileAssetId, fileName || 'schoolos-file');
      } else {
        await openProtectedFile(fileAssetId, { fileName });
      }
      const nextMessage = successLabel || successText(action);
      setStatus('success');
      setMessage(nextMessage);
      onSuccess?.();
    } catch (error: unknown) {
      const nextMessage =
        error instanceof Error
          ? error.message
          : errorLabel || errorText(action);
      setStatus('error');
      setMessage(nextMessage);
      onError?.(nextMessage);
    }
  }

  return {
    isLoading: status === 'loading',
    message,
    run,
    status,
  };
}

function ProtectedFileStatusText({
  message,
  status,
  className,
}: {
  message: string;
  status: ProtectedFileStatus;
  className?: string;
}) {
  if (!message || status === 'idle') return null;

  return (
    <p
      className={cn(
        'mt-2 text-xs font-semibold',
        status === 'error' ? 'text-danger-700' : 'text-slate-500',
        className,
      )}
      role={status === 'error' ? 'alert' : 'status'}
      aria-live={status === 'error' ? 'assertive' : 'polite'}
    >
      {message}
    </p>
  );
}

export type ProtectedFileButtonProps = ProtectedFileBaseProps &
  Omit<
    ButtonProps,
    'children' | 'disabled' | 'isLoading' | 'onClick' | 'onError'
  >;

export function ProtectedFileButton({
  fileAssetId,
  fileName,
  action = 'preview',
  disabled = false,
  children,
  label,
  loadingLabel,
  successLabel,
  errorLabel,
  ariaLabel,
  showStatus = true,
  statusClassName,
  onSuccess,
  onError,
  variant = 'outline',
  size = 'sm',
  ...buttonProps
}: ProtectedFileButtonProps) {
  const protectedFile = useProtectedFileAction({
    action,
    fileAssetId,
    fileName,
    loadingLabel,
    successLabel,
    errorLabel,
    onSuccess,
    onError,
  });
  const Icon = action === 'download' ? Download : ExternalLink;
  const text = label || actionText(action);
  const accessibleName = ariaLabel || text;

  const button = (
    <Button
      {...buttonProps}
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || !fileAssetId}
      onClick={() => void protectedFile.run()}
      aria-label={accessibleName}
    >
      {protectedFile.isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {size === 'icon' ? null : loadingLabel || loadingText(action)}
        </>
      ) : children || (
        <>
          <Icon className="h-4 w-4" />
          {text}
        </>
      )}
    </Button>
  );

  return (
    <span className="inline-flex flex-col">
      {size === 'icon' ? <Tooltip content={accessibleName}>{button}</Tooltip> : button}
      {showStatus ? (
        <ProtectedFileStatusText
          message={protectedFile.message}
          status={protectedFile.status}
          className={statusClassName}
        />
      ) : null}
    </span>
  );
}

export type ProtectedFileLinkProps = ProtectedFileBaseProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'disabled' | 'onClick' | 'onError'
  >;

export function ProtectedFileLink({
  fileAssetId,
  fileName,
  action = 'preview',
  disabled = false,
  children,
  label,
  loadingLabel,
  successLabel,
  errorLabel,
  ariaLabel,
  showStatus = true,
  statusClassName,
  onSuccess,
  onError,
  className,
  ...buttonProps
}: ProtectedFileLinkProps) {
  const protectedFile = useProtectedFileAction({
    action,
    fileAssetId,
    fileName,
    loadingLabel,
    successLabel,
    errorLabel,
    onSuccess,
    onError,
  });
  const Icon =
    protectedFile.status === 'success'
      ? CheckCircle2
      : protectedFile.isLoading
        ? Loader2
        : action === 'download'
          ? Download
          : ExternalLink;
  const text = label || actionText(action);

  return (
    <span className="inline-flex flex-col">
      <button
        {...buttonProps}
        type="button"
        disabled={disabled || !fileAssetId || protectedFile.isLoading}
        onClick={() => void protectedFile.run()}
        aria-label={ariaLabel || text}
        className={cn(
          'inline-flex items-center gap-2 text-sm font-bold text-[var(--primary)] underline-offset-4 transition hover:text-[var(--primary-dark)] hover:underline disabled:cursor-not-allowed disabled:text-slate-400',
          className,
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4',
            protectedFile.isLoading ? 'animate-spin' : undefined,
          )}
        />
        {children || text}
      </button>
      {showStatus ? (
        <ProtectedFileStatusText
          message={protectedFile.message}
          status={protectedFile.status}
          className={statusClassName}
        />
      ) : null}
    </span>
  );
}
