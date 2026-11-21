/**
 * Coordinator access. The key is typed in by staff and held in React memory only,
 * so it never ships in the bundle and Quick Exit or a reload drops it.
 */

export const COORDINATOR_KEY_HEADER = 'X-Coordinator-Key';

const VERIFY_PATH = '/api/v1/coordinator/queue?limit=1';

export type CoordinatorSignInResult = 'ok' | 'denied' | 'unreachable';

export function coordinatorHeaders(accessKey: string, extra: Record<string, string> = {}): Record<string, string> {
  return { ...extra, [COORDINATOR_KEY_HEADER]: accessKey };
}

/** Thrown by coordinator fetches when the server rejects the key. */
export class CoordinatorAccessError extends Error {
  constructor() {
    super('Coordinator access required.');
    this.name = 'CoordinatorAccessError';
  }
}

/** Asks the server whether `accessKey` opens coordinator endpoints. */
export async function verifyCoordinatorKey(accessKey: string, signal?: AbortSignal): Promise<CoordinatorSignInResult> {
  try {
    const response = await fetch(VERIFY_PATH, {
      signal,
      headers: coordinatorHeaders(accessKey, { Accept: 'application/json' }),
    });
    if (response.ok) return 'ok';
    return response.status === 401 || response.status === 403 ? 'denied' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}
