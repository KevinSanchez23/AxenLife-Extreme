import React from 'react';
import officialLogo from '../assets/axen-extreme-canada.svg';
import { HeroTitle } from './kinetic';
import { Button } from './Button';
import { event } from '../data/site';
import { scrollToId } from '../lib/scroll';

export default function Hero({ onPay, onWhatsapp, paused, onTogglePaused }) {
  const go = (e, id) => { e.preventDefault(); scrollToId('#' + id); };
  return (
    <section className="hero" id="inicio" aria-labelledby="hero-title">
      <div className="mountain-scene" data-parallax data-speed="0.18" aria-hidden="true" />
      <div className="hero-haze" aria-hidden="true" />

      <div className="hero-content">
        <div className="hero-top">
          <div className="eyebrow hero-eyebrow" data-hero="1" style={{ '--d': 0 }}>
            <span className="chapter-index">00</span>
            <span className="snow-symbol" aria-hidden="true">✳</span> {event.location} <span className="rule" /> AXEN LIFE PRESENTA
          </div>
          <div className="hero-date" data-hero="2" style={{ '--d': 120 }}>
            <strong>{event.dateRange}</strong><span>{event.month}</span>
          </div>
        </div>

        <HeroTitle />

        <div className="logo-stage" id="logo-stage" data-hero="4" style={{ '--d': 360 }} aria-hidden="true">
          <div className="emblem" id="emblem">
            <img className="logo-face" src={officialLogo} alt="Axen Life Extreme Canadá" width="1080" height="1080" fetchpriority="high" />
          </div>
        </div>

        <div className="ice-object ice-one" data-parallax data-speed="0.3" aria-hidden="true"><div className="ice-cube"><i /><i /><i /><i /><i /><i /></div></div>
        <div className="ice-object ice-two" data-parallax data-speed="0.5" aria-hidden="true"><div className="ice-cube"><i /><i /><i /><i /><i /><i /></div></div>

        <div className="hero-bottom">
          <div className="hero-copy" data-hero="5" style={{ '--d': 480 }}>
            <p className="hero-lede">Cuatro conferencias. Un destino extraordinario.<br />Una nueva forma de ver lo que eres capaz de hacer.</p>
            <div className="hero-actions">
              <Button onClick={onPay}>Haz tu pago aquí</Button>
              <Button variant="light" onClick={onWhatsapp}>Obtén más información</Button>
            </div>
          </div>
          <a className="scroll-cue" href="#ponentes" data-hero="6" style={{ '--d': 600 }} data-cursor onClick={(e) => go(e, 'ponentes')}>
            <span>EL VIAJE EMPIEZA AQUÍ</span><span className="scroll-line" aria-hidden="true" /><span className="scroll-dot" aria-hidden="true">↓</span>
          </a>
        </div>
      </div>

      <div className="hero-foot">
        <span>{event.region}</span>
        <span>
          <button id="motion-toggle" aria-pressed={paused} data-cursor onClick={onTogglePaused}>
            {paused ? 'Activar animaciones ' : 'Pausar animaciones '}<span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>
          </button>
        </span>
      </div>
    </section>
  );
}
