/**
 * Next.js Instrumentation Hook
 *
 * Currently a no-op. Threshold persistence is initialized lazily
 * from server-side API routes (predict, backtest) which run in Node.js
 * runtime and can access fs/path modules.
 *
 * https://nextjs.org/docs/app/api-reference/config/instrumentation
 */

export async function register() {
  // No-op: threshold initialization moved to lazy API-route loading
  // because Edge Runtime (instrumentation) does not support Node.js fs/path.
  // See src/lib/models/threshold-init.ts → initializeThresholdsIfNecessary()
}
