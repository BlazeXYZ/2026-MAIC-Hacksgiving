/// <reference types="vite/client" />
import { Capacitor } from '@capacitor/core';

const configuredOrigin = import.meta.env.VITE_API_ORIGIN?.trim();
export const hasPackagedApi = Boolean(configuredOrigin);

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!configuredOrigin || !Capacitor.isNativePlatform()) return fetch(path, init);

  const origin = new URL(configuredOrigin);
  if (origin.protocol !== 'https:' || origin.href !== `${origin.origin}/`) {
    throw new Error('Set VITE_API_ORIGIN to the HTTPS origin of the ComForce API.');
  }

  return fetch(`${origin.origin}${path}`, init);
}
