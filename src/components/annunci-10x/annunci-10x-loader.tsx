"use client";

import Image from 'next/image';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ANNUNCI10X_LOADER_LOGO_PATH, clampAnnunci10xProgress } from '@/lib/annunci-10x/loading';
import styles from './annunci-10x.module.css';

type LoaderVariant = 'panel' | 'compact' | 'inline' | 'overlay' | 'strip';

export function Annunci10xLoader({
  label,
  progress,
  indeterminate = progress === null || progress === undefined,
  variant = 'panel',
  complete = progress === 100,
  delayMs = 180,
}: {
  label: string;
  progress?: number | null;
  indeterminate?: boolean;
  variant?: LoaderVariant;
  complete?: boolean;
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(delayMs <= 0);
  const target = indeterminate ? null : clampAnnunci10xProgress(progress ?? 0);
  const shown = useSmoothedProgress(target);
  const rounded = Math.round(shown);
  const rootStyle = useMemo(() => ({ '--annunci10x-loader-progress': indeterminate ? '45%' : `${shown}%` }) as CSSProperties, [indeterminate, shown]);

  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  if (!visible) return null;

  return <div
    className={styles.loader}
    data-variant={variant}
    data-indeterminate={indeterminate}
    data-complete={complete || rounded >= 100}
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={indeterminate ? undefined : rounded}
    style={rootStyle}
  >
    <div className={styles.loaderLogo} aria-hidden="true">
      <Image className={styles.loaderImage} src={ANNUNCI10X_LOADER_LOGO_PATH} alt="" width={1188} height={420} sizes="(max-width: 760px) 210px, 520px" unoptimized />
      <div className={styles.loaderBar}><span className={styles.loaderFill} /></div>
    </div>
    <p className={styles.loaderStatus} aria-live="polite">{label}</p>
  </div>;
}

function useSmoothedProgress(target: number | null): number {
  const [shown, setShown] = useState(target ?? 0);
  const shownRef = useRef(shown);
  const targetRef = useRef(target);
  const frameRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reducedMotionRef.current = media.matches;
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (target === null) return;
    targetRef.current = Math.max(targetRef.current ?? 0, target);

    if (reducedMotionRef.current) {
      shownRef.current = targetRef.current;
      setShown(targetRef.current);
      return;
    }

    function tick() {
      const nextTarget = targetRef.current ?? 0;
      const delta = nextTarget - shownRef.current;
      if (Math.abs(delta) < 0.2) {
        shownRef.current = nextTarget;
        setShown(nextTarget);
        frameRef.current = null;
        return;
      }
      shownRef.current += delta * 0.16;
      setShown(shownRef.current);
      frameRef.current = window.requestAnimationFrame(tick);
    }

    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [target]);

  return shown;
}
