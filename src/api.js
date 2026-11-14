import { firebaseAuth } from './firebase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

export function isApiConfigured() {
  return Boolean(API_URL);
}

export async function apiRequest(path, options = {}) {
  if (!API_URL) throw new Error('API não configurada. Defina EXPO_PUBLIC_API_URL.');
  const token = firebaseAuth?.currentUser ? await firebaseAuth.currentUser.getIdToken() : null;
  const response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `API respondeu ${response.status}`);
  return body;
}

export async function healthCheck() {
  return apiRequest('/health');
}
