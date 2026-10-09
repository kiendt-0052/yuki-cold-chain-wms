"use client";
// Thin fetch wrapper for the app's own /api routes. A 401 sends the user back to the login screen.

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/login")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, json.error ?? `エラー (${res.status})`, json.details ?? json);
  }
  return json as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  put: <T>(url: string, body: unknown) => request<T>("PUT", url, body),
  patch: <T>(url: string, body: unknown) => request<T>("PATCH", url, body),
};
