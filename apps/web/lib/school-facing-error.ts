import { ApiRequestError } from "./api/client";
import {
  OFFLINE_MUTATION_MESSAGE,
  OfflineMutationError,
} from "./offline-policy";

export type SchoolFacingErrorCopy = {
  fallback: string;
  invalid?: string;
  unauthenticated?: string;
  forbidden?: string;
  notFound?: string;
  conflict?: string;
  payloadTooLarge?: string;
  rateLimited?: string;
};

/**
 * Converts transport failures into bounded, school-facing copy without
 * rendering arbitrary backend, provider, storage, or database messages.
 */
export function schoolFacingErrorMessage(
  error: unknown,
  copy: SchoolFacingErrorCopy,
) {
  if (error instanceof OfflineMutationError) {
    return OFFLINE_MUTATION_MESSAGE;
  }

  if (!(error instanceof ApiRequestError)) {
    return copy.fallback;
  }

  switch (error.statusCode) {
    case 400:
    case 422:
      return copy.invalid ?? "Review the information and try again.";
    case 401:
      return (
        copy.unauthenticated ??
        "Your session expired. Sign in again before continuing."
      );
    case 403:
      return (
        copy.forbidden ?? "You do not have permission to complete this action."
      );
    case 404:
      return copy.notFound ?? "This record is no longer available.";
    case 409:
      return (
        copy.conflict ??
        "This record changed before the action finished. Refresh and try again."
      );
    case 413:
      return (
        copy.payloadTooLarge ??
        "The selected file is too large. Choose a smaller file and try again."
      );
    case 429:
      return (
        copy.rateLimited ??
        "Too many requests were submitted. Wait a moment and try again."
      );
    default:
      return copy.fallback;
  }
}
