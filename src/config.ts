import { resolveNetworkUrls, type NetworkUrls } from './network-config';

export function getNetworkUrls(): NetworkUrls {
  return resolveNetworkUrls();
}

export function getApiUrl(): string {
  return getNetworkUrls().apiUrl;
}

export function getWsUrl(): string {
  return getNetworkUrls().wsUrl;
}

/** @deprecated Usar getApiUrl() para URLs dinámicas */
export const API_URL = getApiUrl();
/** @deprecated Usar getWsUrl() para URLs dinámicas */
export const WS_URL = getWsUrl();
