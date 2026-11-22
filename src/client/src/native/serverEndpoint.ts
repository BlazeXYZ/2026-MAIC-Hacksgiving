export interface SavedServer {
  host: string;
  port: string;
}

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}$`);

/** Returns an error message, or null when the address can be saved. */
export function validateServer(host: string, port: string): string | null {
  const ip = host.trim();
  const rawPort = port.trim();
  if (!IPV4.test(ip)) {
    return 'Enter an IPv4 address, like 192.168.1.20.';
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
