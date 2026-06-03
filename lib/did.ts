const DID_API = 'https://api.d-id.com';

export function getDIDAuth(): string {
  const raw = process.env.DID_API_KEY ?? '';
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

export async function didFetch(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${DID_API}${path}`, {
    method,
    headers: { 'Authorization': getDIDAuth(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D-ID ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.status === 204 ? {} : res.json();
}
