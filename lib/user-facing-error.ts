export const getUserFacingErrorMessage = (error: unknown, fallback: string) => {
  if (__DEV__) {
    console.warn(fallback, error);
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
};
