export type NetworkMode = 'auto' | 'local' | 'tailscale' | 'custom';

export interface NetworkSettings {
  mode: NetworkMode;
  tailscaleIp: string;
  customHost: string;
  backendPort: number;
  frontendPort: number;
}

export interface NetworkUrls {
  apiUrl: string;
  wsUrl: string;
  mode: NetworkMode;
  label: string;
}

export interface ServerNetworkInfo {
  hostname: string;
  tailscaleIp: string | null;
  tailscaleAvailable: boolean;
  tailscaleOnline: boolean;
  ports: { frontend: number; backend: number };
  localIps: string[];
  shareUrl: string | null;
}

const STORAGE_KEY = 'animdb-network-settings';

const DEFAULT_SETTINGS: NetworkSettings = {
  mode: 'auto',
  tailscaleIp: '',
  customHost: '',
  backendPort: 5174,
  frontendPort: 5173,
};

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function isTailscaleIp(hostname: string): boolean {
  const match = hostname.match(/^100\.(\d+)\.\d+\.\d+$/);
  if (!match) return false;
  const second = parseInt(match[1], 10);
  return second >= 64 && second <= 127;
}

export function loadNetworkSettings(): NetworkSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveNetworkSettings(settings: NetworkSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resolveNetworkUrls(settings = loadNetworkSettings()): NetworkUrls {
  const envApi = import.meta.env.VITE_API_URL as string | undefined;
  const envWs = import.meta.env.VITE_WS_URL as string | undefined;

  if (typeof window === 'undefined') {
    return {
      apiUrl: 'http://localhost:5174/api',
      wsUrl: 'http://localhost:5174',
      mode: 'local',
      label: 'Servidor',
    };
  }

  if (envApi) {
    const base = envApi.replace(/\/$/, '');
    return {
      apiUrl: `${base}/api`,
      wsUrl: envWs?.replace(/\/$/, '') || base,
      mode: settings.mode,
      label: 'Variables de entorno',
    };
  }

  const { protocol, hostname, origin } = window.location;
  const local = isLocalHost(hostname);
  const onTailscale = isTailscaleIp(hostname);

  if (settings.mode === 'local' || (settings.mode === 'auto' && local)) {
    return {
      apiUrl: '/api',
      wsUrl: envWs?.replace(/\/$/, '') || origin,
      mode: 'local',
      label: 'Solo este PC',
    };
  }

  const host =
    settings.mode === 'tailscale'
      ? settings.tailscaleIp.trim()
      : settings.mode === 'custom'
        ? settings.customHost.trim()
        : hostname;

  const port = settings.backendPort || 5174;
  const remoteBase = `${protocol}//${host}:${port}`;

  if (settings.mode === 'auto' && onTailscale) {
    return {
      apiUrl: `${remoteBase}/api`,
      wsUrl: remoteBase,
      mode: 'auto',
      label: 'Tailscale (automático)',
    };
  }

  if (settings.mode === 'auto' && !local) {
    return {
      apiUrl: `${remoteBase}/api`,
      wsUrl: remoteBase,
      mode: 'auto',
      label: 'Red local',
    };
  }

  if (settings.mode === 'tailscale' && settings.tailscaleIp) {
    return {
      apiUrl: `${remoteBase}/api`,
      wsUrl: remoteBase,
      mode: 'tailscale',
      label: 'Tailscale',
    };
  }

  if (settings.mode === 'custom' && settings.customHost) {
    return {
      apiUrl: `${remoteBase}/api`,
      wsUrl: remoteBase,
      mode: 'custom',
      label: 'Personalizado',
    };
  }

  return {
    apiUrl: '/api',
    wsUrl: origin,
    mode: 'local',
    label: 'Solo este PC',
  };
}

export function getShareUrl(info: ServerNetworkInfo | null, settings = loadNetworkSettings()): string | null {
  const ip = info?.tailscaleIp || settings.tailscaleIp;
  if (!ip) return null;
  return `http://${ip}:${settings.frontendPort}`;
}

export function isTailscaleHost(hostname: string): boolean {
  return isTailscaleIp(hostname);
}
