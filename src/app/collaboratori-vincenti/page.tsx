'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import deckData from '@/data/collaboratori-vincenti.json';

export default function CollaboratoriVincentiPage() {
  const [currentSlide, setCurrentSlide] = useState(1);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const totalSlides = deckData.totalSlides;
  const stageRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  // Initialize slide from hash or localStorage on mount
  useEffect(() => {
    const syncFromLocation = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#slide-')) {
        const parsed = parseInt(hash.replace('#slide-', ''), 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= totalSlides) {
          setCurrentSlide(parsed);
          return;
        }
      }
      const saved = localStorage.getItem('horyzon_deck_slide');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= totalSlides) {
          setCurrentSlide(parsed);
        }
      }
    };

    window.addEventListener('hashchange', syncFromLocation);
    const timer = setTimeout(syncFromLocation, 0);

    return () => {
      window.removeEventListener('hashchange', syncFromLocation);
      clearTimeout(timer);
    };
  }, [totalSlides]);

  const goToSlide = useCallback(
    (index: number) => {
      let target = index;
      if (target < 1) target = 1;
      if (target > totalSlides) target = totalSlides;
      setCurrentSlide(target);
      setIsIndexOpen(false);

      if (typeof window !== 'undefined') {
        window.location.hash = `slide-${target}`;
        localStorage.setItem('horyzon_deck_slide', target.toString());
      }
    },
    [totalSlides]
  );

  const nextSlide = useCallback(() => {
    if (currentSlide < totalSlides) {
      goToSlide(currentSlide + 1);
    }
  }, [currentSlide, totalSlides, goToSlide]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 1) {
      goToSlide(currentSlide - 1);
    }
  }, [currentSlide, goToSlide]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request error:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prevSlide();
          break;
        case 'Home':
          e.preventDefault();
          goToSlide(1);
          break;
        case 'End':
          e.preventDefault();
          goToSlide(totalSlides);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
        case 'i':
        case 'I':
          e.preventDefault();
          setIsIndexOpen((prev) => !prev);
          break;
        case 'Escape':
          setIsIndexOpen(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, goToSlide, toggleFullscreen, totalSlides]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff < 0) nextSlide();
      else prevSlide();
    }
  };

  const progressPct = ((currentSlide - 1) / (totalSlides - 1)) * 100;
  const currentSlideData = deckData.slides[currentSlide - 1];

  return (
    <div className="deck-root-container">
      {/* Real-time Progress Bar */}
      <div id="deck-progress-bar" style={{ width: `${progressPct}%` }} />

      {/* Presentation Viewport */}
      <div id="deck-viewport">
        <div
          id="deck-stage"
          ref={stageRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {deckData.slides.map((s, idx) => {
            const isActive = idx + 1 === currentSlide;
            return (
              <section
                key={s.id}
                id={`slide-${s.id}`}
                className={`slide ${isActive ? 'active' : ''}`}
                data-slide-id={s.id}
                data-module-num={s.mod_num}
                data-module-title={s.mod_title}
                data-slide-title={s.title}
                style={
                  s.bg_style
                    ? {
                        backgroundImage: `linear-gradient(90deg, rgba(7, 21, 29, 0.94) 0%, rgba(7, 21, 29, 0.65) 55%, rgba(7, 21, 29, 0.15) 82%, transparent 100%), url('${s.bg_style.includes('horyzon-hero-bg') ? '/collaboratori-vincenti/horyzon-hero-bg.jpg' : ''}')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'right center',
                      }
                    : undefined
                }
                dangerouslySetInnerHTML={{ __html: s.html }}
              />
            );
          })}
        </div>
      </div>

      {/* Floating Presentation Controls Dock */}
      <nav id="controls-dock" aria-label="Controlli presentazione">
        <div className="dock-left">
          <Link href="/" className="dock-btn text-btn" title="Torna alla Home di Horyzon">
            ← Horyzon.it
          </Link>
          <span className="dock-module-pill">
            MOD {currentSlideData?.mod_num || '01'}
          </span>
          <span className="dock-title-preview" title={currentSlideData?.title}>
            {currentSlideData?.title}
          </span>
        </div>

        <div className="dock-center">
          <button
            type="button"
            className="dock-btn"
            id="btn-prev-slide"
            onClick={prevSlide}
            disabled={currentSlide <= 1}
            title="Slide precedente (Freccia Sinistra)"
          >
            ←
          </button>
          <div className="dock-counter">
            <strong id="dock-cur-slide">{currentSlide}</strong> /{' '}
            <span id="dock-total-slides">{totalSlides}</span>
          </div>
          <button
            type="button"
            className="dock-btn"
            id="btn-next-slide"
            onClick={nextSlide}
            disabled={currentSlide >= totalSlides}
            title="Slide successiva (Spazio o Freccia Destra)"
          >
            →
          </button>
        </div>

        <div className="dock-right">
          <button
            type="button"
            className="dock-btn text-btn"
            id="btn-toggle-index"
            onClick={() => setIsIndexOpen((prev) => !prev)}
            title="Indice dei Moduli (Tasto M)"
          >
            ☰ Moduli
          </button>

          <button
            type="button"
            className="dock-btn"
            id="btn-fullscreen"
            onClick={toggleFullscreen}
            title="Schermo Intero (Tasto F)"
          >
            ⛶
          </button>
        </div>
      </nav>

      {/* Index Drawer Overlay */}
      <div
        className={`drawer-overlay ${isIndexOpen ? 'open' : ''}`}
        id="drawer-overlay"
        onClick={() => setIsIndexOpen(false)}
      />

      {/* Slide Index Drawer */}
      <aside
        className={`deck-drawer ${isIndexOpen ? 'open' : ''}`}
        id="index-drawer"
        aria-label="Indice dei contenuti"
      >
        <div className="drawer-header">
          <h2 className="drawer-title">Indice Masterclass</h2>
          <button
            type="button"
            className="drawer-close-btn"
            id="btn-close-index"
            onClick={() => setIsIndexOpen(false)}
            aria-label="Chiudi indice"
          >
            ×
          </button>
        </div>

        <div className="drawer-scroll-body">
          {deckData.modules.map((mod) => {
            const modSlides = deckData.slides.filter((s) => s.mod_num === mod.num);
            return (
              <div key={mod.num} className="index-module-group">
                <div className="index-module-header">
                  <span className="idx-mod-badge">MODULO {mod.num}</span>
                  <span className="idx-mod-title">{mod.name}</span>
                  <span className="idx-mod-range">({mod.range})</span>
                </div>
                <ul className="index-slide-list">
                  {modSlides.map((s) => {
                    const isItemActive = s.id === currentSlide;
                    return (
                      <li
                        key={s.id}
                        className={`index-slide-item ${isItemActive ? 'active' : ''}`}
                        onClick={() => goToSlide(s.id)}
                      >
                        <span className="idx-num">Slide {String(s.id).padStart(2, '0')}</span>{' '}
                        <span className="idx-name">{s.title}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
