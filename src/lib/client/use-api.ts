"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api-client";

type Result<T> = { key: string | null; data: T | null; error: string | null };

/**
 * Load JSON from one of the app's API routes; `reload()` refetches after a mutation.
 * State is only set from the fetch callbacks, and the previous data stays visible while reloading.
 */
export function useApi<T>(url: string | null) {
  const [tick, setTick] = useState(0);
  const key = url ? `${url}#${tick}` : null;
  const [result, setResult] = useState<Result<T>>({ key: null, data: null, error: null });

  useEffect(() => {
    if (!url || !key) return;
    let alive = true;
    api.get<T>(url)
      .then((data) => alive && setResult({ key, data, error: null }))
      .catch((e: Error) => alive && setResult((prev) => ({ key, data: prev.data, error: e.message })));
    return () => {
      alive = false;
    };
  }, [url, key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: result.data, error: result.error, loading: result.key !== key, reload };
}
