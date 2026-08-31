import type { Campaign } from '@bora/types';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../../shared/api/client';

const SLIDE_MS = 5000;

export function CampaignSlider() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    void api.listCampaigns().then(setCampaigns).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (paused || campaigns.length < 2) return;

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % campaigns.length);
    }, SLIDE_MS);

    return () => clearInterval(timer);
  }, [paused, campaigns.length]);

  if (campaigns.length === 0) {
    return null;
  }

  return (
    <section className="dji-section campaign-slider-section">
      <div className="ui-shell">
        <div className="dji-section__heading">
          <h2>KAMPANYALAR</h2>
        </div>
        <div
          className="campaign-slider"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="campaign-slider__track" style={{ transform: `translateX(-${index * 100}%)` }}>
            {campaigns.map((campaign) => {
              const content = (
                <article className="campaign-slide" key={campaign.id}>
                  {campaign.imageUrl ? (
                    <>
                      <div className="campaign-slide__bg" style={{ backgroundImage: `url(${campaign.imageUrl})` }} />
                      <div className="campaign-slide__overlay" />
                    </>
                  ) : null}
                  <div className="campaign-slide__copy">
                    {campaign.badge ? <span className="campaign-slide__badge">{campaign.badge}</span> : null}
                    <h3>{campaign.title}</h3>
                    {campaign.description ? <p>{campaign.description}</p> : null}
                  </div>
                </article>
              );

              return campaign.linkUrl ? (
                <Link className="campaign-slide-link" key={campaign.id} to={campaign.linkUrl}>
                  {content}
                </Link>
              ) : (
                content
              );
            })}
          </div>

          {campaigns.length > 1 ? (
            <>
              <button
                aria-label="Önceki kampanya"
                className="campaign-slider__arrow campaign-slider__arrow--prev"
                onClick={() => setIndex((index - 1 + campaigns.length) % campaigns.length)}
                type="button"
              >
                ‹
              </button>
              <button
                aria-label="Sonraki kampanya"
                className="campaign-slider__arrow campaign-slider__arrow--next"
                onClick={() => setIndex((index + 1) % campaigns.length)}
                type="button"
              >
                ›
              </button>
              <div className="campaign-slider__dots">
                {campaigns.map((campaign, dotIndex) => (
                  <button
                    aria-label={`Kampanya ${dotIndex + 1}`}
                    className={dotIndex === index ? 'is-active' : ''}
                    key={campaign.id}
                    onClick={() => setIndex(dotIndex)}
                    type="button"
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
