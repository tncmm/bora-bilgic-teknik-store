import type { HeroSlide } from '@bora/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@bora/ui';
import { api } from '../../shared/api/client';

const FALLBACK_SLIDE: HeroSlide = {
  id: 'fallback',
  title: 'BORA BİLGİÇ',
  subtitle: 'İlham Veren Görüntüler',
  ctaText: 'KEŞFET',
  ctaLink: '/katalog',
  imageUrl: '',
  isActive: true,
  sortOrder: 0,
};

export function HeroSlider() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;
    void api
      .listHeroSlides()
      .then((items) => {
        if (mounted) setSlides(items);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveSlides = slides.length > 0 ? slides : [FALLBACK_SLIDE];
  const currentSlide = effectiveSlides[activeIndex] ?? effectiveSlides[0];

  const advance = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % effectiveSlides.length);
  }, [effectiveSlides.length]);

  const goBack = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + effectiveSlides.length) % effectiveSlides.length);
  }, [effectiveSlides.length]);

  useEffect(() => {
    if (paused || effectiveSlides.length < 2) return;
    timerRef.current = setInterval(advance, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, effectiveSlides.length, advance]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goBack();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      advance();
    }
  }

  return (
    <section
      className="dji-hero dji-hero-slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Ana görsel slider"
    >
      <div className="dji-hero__background">
        {currentSlide.imageUrl ? (
          <img
            key={currentSlide.id}
            alt={currentSlide.title}
            src={currentSlide.imageUrl}
            className="dji-hero-slider__image"
          />
        ) : null}
      </div>
      <div className="ui-shell dji-hero__content">
        <div className="dji-hero__copy">
          <h1>{currentSlide.title}</h1>
          {currentSlide.subtitle ? <h2>{currentSlide.subtitle}</h2> : null}
          <div className="dji-hero__actions">
            <Link to={currentSlide.ctaLink ?? '/katalog'}>
              <Button>{currentSlide.ctaText ?? 'KEŞFET'}</Button>
            </Link>
          </div>
        </div>
      </div>

      {effectiveSlides.length > 1 && (
        <>
          <button
            className="dji-hero-slider__arrow dji-hero-slider__arrow--prev"
            onClick={goBack}
            type="button"
            aria-label="Önceki slayt"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button
            className="dji-hero-slider__arrow dji-hero-slider__arrow--next"
            onClick={advance}
            type="button"
            aria-label="Sonraki slayt"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
          <div className="dji-hero-slider__dots" role="tablist">
            {effectiveSlides.map((slide, index) => (
              <button
                key={slide.id}
                className={`dji-hero-slider__dot ${index === activeIndex ? 'is-active' : ''}`}
                onClick={() => setActiveIndex(index)}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Slayt ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
