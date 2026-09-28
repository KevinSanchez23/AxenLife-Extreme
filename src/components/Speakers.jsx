import React from 'react';
import { Lines } from './kinetic';
import { speakers } from '../data/site';

export default function Speakers() {
  return (
    <section className="speakers section-pad" id="ponentes" aria-labelledby="speakers-title">
      <span className="section-veil" aria-hidden="true" />
      <div className="section-kicker" data-reveal><span>01 / VOCES QUE TE MUEVEN</span><span>4 CONFERENCIAS · 1 EXPERIENCIA</span></div>
      <div className="section-heading">
        <Lines id="speakers-title" className="display-xl" lines={['Una nueva', <span className="hl" key="hl">forma de pensar.</span>]} />
        <p data-reveal>Personas que inspiran.<br />Ideas que se quedan contigo.</p>
      </div>
      <div className="speaker-grid" id="speaker-grid">
        {speakers.map((sp) => (
          <article className={`speaker${sp.surprise ? ' speaker-surprise' : ''}`} data-reveal key={sp.no}>
            <div className="speaker-portrait">
              <span className="speaker-no">{sp.no}</span>
              <img src={sp.img} alt={sp.alt} width="600" height="1200" loading="lazy" decoding="async" />
            </div>
            <div className="speaker-caption">
              <span>{sp.role}</span>
              <h3>{sp.name[0]}<br />{sp.name[1]}</h3>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
