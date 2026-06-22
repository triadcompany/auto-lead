/**
 * ReadOnlyBanner — deprecated.
 * Access control is now handled by hiding menu items and redirecting routes,
 * so a visual "read-only" banner is no longer shown.
 * Kept as a no-op export for backward compatibility with existing imports.
 */
export function ReadOnlyBanner() {
  return null;
}
