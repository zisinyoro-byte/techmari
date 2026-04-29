/**
 * Next.js Instrumentation Hook
 *
 * Runs once on server startup. Loads persisted backtest-derived thresholds
 * from disk into the in-memory registry so they're available immediately.
 *
 * https://nextjs.org/docs/app/api-reference/config/instrumentation
 */

export async function register() {
  // Dynamic import to keep threshold-init server-only
  const { initializeThresholds } = await import('@/lib/models/threshold-init');
  initializeThresholds();
}
