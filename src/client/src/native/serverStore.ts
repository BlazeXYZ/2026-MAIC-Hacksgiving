import { Preferences } from '@capacitor/preferences';
import { validateServer, type SavedServer } from './serverEndpoint';

const HOST_KEY = 'comforce.server.host';
const PORT_KEY = 'comforce.server.port';

export async function loadServer(): Promise<SavedServer | null> {
  const [host, port] = await Promise.all([
    Preferences.get({ key: HOST_KEY }),
    Preferences.get({ key: PORT_KEY }),
  ]);
  if (!host.value || !port.value) return null;
  if (validateServer(host.value, port.value)) return null;
  return { host: host.value, port: port.value };
}

export async function saveServer(server: SavedServer): Promise<void> {
  await Preferences.set({ key: HOST_KEY, value: server.host });
  await Preferences.set({ key: PORT_KEY, value: server.port });
}

export async function clearServer(): Promise<void> {
  await Preferences.remove({ key: HOST_KEY });
  await Preferences.remove({ key: PORT_KEY });
}
