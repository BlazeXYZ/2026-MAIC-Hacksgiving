/// <reference types="vite/client" />
import { Capacitor } from '@capacitor/core';

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!Capacitor.isNativePlatform()) return fetch(path, init);

  const configuredOrigin = import.meta.env.VITE_API_ORIGIN?.trim();
  const origin = configuredOrigin ? new URL(configuredOrigin) : undefined;
  if (!origin || origin.protocol !== 'https:' || origin.href !== `${origin.origin}/`) {
    throw new Error('Set VITE_API_ORIGIN to the HTTPS origin of the ComForce API.');
  }

  return fetch(`${origin.origin}${path}`, init);
}
