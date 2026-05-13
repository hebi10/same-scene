export const getUserFacingErrorMessage = (error: unknown, fallback: string) => {
  console.error(fallback, error);
  return fallback;
};
