/** Storage and editing share these limits so any UI-created project can be saved. */
export const PROJECT_LIMITS = {
  maxFileBytes: 2 * 1024 * 1024,
  maxWires: 500,
  maxPoints: 64,
  minCoordinate: -3000,
  maxCoordinate: 6000,
} as const;
