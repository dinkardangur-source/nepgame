import React, { useEffect, useState } from 'react';

type Listener = () => void;

const listeners = new Set<Listener>();
let currentNowMs = Date.now();
let intervalId: number | null = null;

function notifyAll() {
  currentNowMs = Date.now();
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore individual listener errors
    }
  });
}

function subscribeSimClock(listener: Listener): () => void {
  listeners.add(listener);
  if (intervalId === null && typeof window !== 'undefined') {
    currentNowMs = Date.now();
    intervalId = window.setInterval(notifyAll, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null && typeof window !== 'undefined') {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}

export function useSimNowMs(): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    return subscribeSimClock(() => {
      setNow(currentNowMs);
    });
  }, []);

  return now;
}

export function formatSimRemaining(
  remSec: number,
  format: 'mmss' | 'hms' | 'duration' = 'mmss'
): string {
  const s = Math.max(0, Math.ceil(remSec));
  if (format === 'duration') {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
  }
  if (format === 'hms') {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const SimCountdownText: React.FC<{
  targetMs: number;
  format?: 'mmss' | 'hms' | 'duration';
  prefix?: string;
  suffix?: string;
}> = ({ targetMs, format = 'mmss', prefix = '', suffix = '' }) => {
  const nowMs = useSimNowMs();
  const remSec = Math.max(0, (targetMs - nowMs) / 1000);
  return React.createElement(
    React.Fragment,
    null,
    prefix,
    formatSimRemaining(remSec, format),
    suffix
  );
};

export const SimProgressFill: React.FC<{
  startedAt: number;
  completesAt: number;
  background: string;
}> = ({ startedAt, completesAt, background }) => {
  const nowMs = useSimNowMs();
  const pct = Math.max(
    0,
    Math.min(100, Math.round(((nowMs - startedAt) / Math.max(1, completesAt - startedAt)) * 100))
  );
  return React.createElement('div', {
    style: { width: `${pct}%`, height: '100%', background },
  });
};
