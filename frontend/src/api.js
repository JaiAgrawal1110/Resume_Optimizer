export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON response (e.g. file download) — caller handles res directly
  }
  if (!res.ok) {
    const detail = body?.detail || res.statusText || "Request failed";
    throw new Error(detail);
  }
  return body;
}
