'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { eventSessionSnapshot } from '@/content/patrimonial-event-session';

const initialSession = eventSessionSnapshot(null);
const Session = createContext(initialSession);
export function EventSessionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(initialSession);
  useEffect(() => {
    const update = () => setSnapshot(eventSessionSnapshot(Date.now()));
    const frame = requestAnimationFrame(update);
    const timer = setInterval(update, 1000);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); };
  }, []);
  return <Session.Provider value={snapshot}>{children}</Session.Provider>;
}
export const useEventSession = () => useContext(Session);

// Scarcity counter: the fewer seats are left, the bigger the number gets.
export function EventSeatsLeft({ className, min = 40, max = 104 }: { className?: string; min?: number; max?: number }) {
  const snapshot = useContext(Session);
  const ratio = snapshot.seatsTotal > 0 ? snapshot.seatsLeft / snapshot.seatsTotal : 0;
  const size = Math.round(min + (max - min) * (1 - ratio));
  return <span data-bind="seatsLeft" data-demo={snapshot.demo} className={className} style={{ fontSize: `${size}px` }}>{snapshot.seatsLeft}</span>;
}
type SessionName = 'eventLabel' | 'seatsTotal' | 'seatsTaken' | 'seatsLeft' | 'cd.d' | 'cd.h' | 'cd.m' | 'cd.s';
export function EventSessionValue({ name }: { name: SessionName }) {
  const snapshot = useContext(Session);
  const value = name.startsWith('cd.') ? snapshot.cd[name.slice(3) as keyof typeof snapshot.cd] : snapshot[name as Exclude<SessionName, `cd.${string}`>];
  return <span data-bind={name} data-demo={snapshot.demo}>{value}</span>;
}
