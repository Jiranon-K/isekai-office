const LOCAL_HOSTS = ['localhost', '127.0.0.1']

export type GuardPorts = { serverPort: number; publicPort: number }

function allowedHosts(ports: GuardPorts): Set<string> {
  return new Set(LOCAL_HOSTS.flatMap((host) => [`${host}:${ports.serverPort}`, `${host}:${ports.publicPort}`]))
}

export function isAllowedRequest(request: Request, ports: GuardPorts): boolean {
  const hosts = allowedHosts(ports)
  const host = request.headers.get('host')
  if (!host || !hosts.has(host)) {
    return false
  }
  const origin = request.headers.get('origin')
  if (origin && !hosts.has(origin.replace(/^https?:\/\//, ''))) {
    return false
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return origin !== null && request.headers.get('content-type')?.startsWith('application/json') === true
  }
  return true
}
