export interface SavedServer {
  host: string;
  port: string;
}

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}$`);
const LABEL = '(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)';
const HOSTNAME = new RegExp(`^(?=.{1,253}$)(?:${LABEL}\\.)*${LABEL}$`, 'i');

/** An IPv4 address, including Tailscale's 100.64.0.0/10 range, or a DNS name. */
export function isServerHost(host: string): boolean {
  const name = host.trim();
  if (IPV4.test(name)) return true;
  if (/^\d+(?:\.\d+){3}$/.test(name)) return false;
  return HOSTNAME.test(name);
}

/**
 * The connect screen belongs to the packaged shell. A dashboard loaded from a
 * saved server must stay the dashboard, including when that server is a Tailscale address.
 */
export function isShellDocument(): boolean {
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  return protocol === 'capacitor:' || host === 'localhost' || host === '127.0.0.1';
}

/** Returns an error message, or null when the address can be saved. */
export function validateServer(host: string, port: string): string | null {
  const ip = host.trim();
  const rawPort = port.trim();
  if (!isServerHost(ip)) {
    return 'Enter an IPv4 address or hostname, like 100.64.0.1.';
  }
  if (!/^\d+$/.test(rawPort)) {
    return 'Enter a port from 1 to 65535.';
  }
  const parsed = Number(rawPort);
  if (parsed < 1 || parsed > 65535) {
    return 'Enter a port from 1 to 65535.';
  }
  return null;
}

export function serverUrl(host: string, port: string): string {
  return `http://${host.trim()}:${port.trim()}/`;
}

/** True when this page is already the saved server, so a redirect would reload in place. */
export function isCurrentServer(server: SavedServer): boolean {
  const here = window.location;
  if (here.hostname.toLowerCase() !== server.host.trim().toLowerCase()) return false;
  const herePort = here.port || (here.protocol === 'https:' ? '443' : '80');
  return herePort === server.port.trim();
}
