import { toast as sonnerToast } from "sonner";
import { parseApiErrorMessage } from "./api/client";

/** Success feedback with an explicit, action-specific message. */
export function showSuccess(message: string) {
  sonnerToast.success(message);
}

/** Error feedback with school-friendly copy (never raw stack traces). */
export function showError(message: string) {
  sonnerToast.error(message);
}

export function showWarning(message: string) {
  sonnerToast.warning(message);
}

export function showInfo(message: string) {
  sonnerToast.info(message);
}

export function showAction(
  message: string,
  action: { label: string; onClick: () => void },
) {
  sonnerToast.message(message, {
    action: {
      label: action.label,
      onClick: action.onClick,
    },
  });
}

/** Map unknown thrown values (API errors, Error instances) to user-safe text. */
export function resolveUserFacingError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error && error.message.trim()) {
    const parsed = parseApiErrorMessage(error.message);
    return parsed || error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return parseApiErrorMessage(error) || error;
  }

  return fallback;
}

export function showErrorFromUnknown(error: unknown, fallback: string) {
  showError(resolveUserFacingError(error, fallback));
}
