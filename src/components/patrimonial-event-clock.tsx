'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { eventSessionSnapshot, eventSession, type EventSession } from '@/content/patrimonial-event-session';

const initialSession = eventSessionSnapshot(null);
const Session = createContext(initialSession);
export function EventSessionProvider({ children, session = eventSession }: { children: ReactNode; session?: EventSession }) {
  const [snapshot, setSnapshot] = useState(() => eventSessionSnapshot(null, session));
  useEffect(() => {
    const update = () => setSnapshot(eventSessionSnapshot(Date.now(), session));
    const frame = requestAnimationFrame(update);
    const timer = setInterval(update, 1000);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); };
  }, [session]);
  return <Session.Provider value={snapshot}>{children}</Session.Provider>;
}
type SessionName = 'eventLabel' | 'seatsTotal' | 'seatsTaken' | 'seatsLeft' | 'cd.d' | 'cd.h' | 'cd.m' | 'cd.s';
export function EventSessionValue({ name }: { name: SessionName }) {
  const snapshot = useContext(Session);
  const value = name.startsWith('cd.') ? snapshot.cd[name.slice(3) as keyof typeof snapshot.cd] : snapshot[name as Exclude<SessionName, `cd.${string}`>];
  return <span data-bind={name} data-demo={snapshot.demo}>{value}</span>;
}
