import { useEffect, useMemo, useState } from 'react';
import { fetchAll } from '../api/sheets';
import { processMens, processHealth, processTelesales } from '../utils/metrics';

// Auto-refresh interval for the live TV display (5 minutes).
const REFRESH_MS = 5 * 60 * 1000;

/**
 * Fetches both sheets, derives dashboard metrics, and auto-refreshes.
 * Returns { mens, health, status, updatedAt } where mens/health are the
 * processed metric objects (never null — empty-safe defaults on failure).
 */
export function useDashboardData() {
  const [raw, setRaw] = useState({ mens: { rows: [], tab: null }, health: { rows: [], tab: null }, telesales: { rows: [], tab: null } });
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await fetchAll();
      if (cancelled) return;
      const empty = !result.mens.rows.length && !result.health.rows.length;
      setRaw(result);
      setUpdatedAt(new Date());
      setStatus(empty ? 'error' : 'ready');
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const mens = useMemo(() => processMens(raw.mens.rows), [raw.mens]);
  const health = useMemo(() => processHealth(raw.health.rows), [raw.health]);
  const telesales = useMemo(() => processTelesales(raw.telesales?.rows || []), [raw.telesales]);

  return {
    mens, health, telesales,
    mensTab: raw.mens.tab, healthTab: raw.health.tab, telesalesTab: raw.telesales?.tab,
    status, updatedAt,
  };
}
