const DISMISS_ERRORS = new Set(['user_cancel', 'app_cancel', 'system_cancel']);

export function shouldDismissBiometricLock(result) {
  return Boolean(result?.success || DISMISS_ERRORS.has(result?.error));
}
