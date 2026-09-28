import React from 'react';
import { Lines } from './kinetic';
import { scrollToId } from '../lib/scroll';

export default function Experience() {
  const go = (e) => { e.preventDefault(); scrollToId('#tu-siguiente-paso'); };
  return (
    <section className="experience section-pad" id="experiencia" aria-labelledby="experience-title">
      <span className="section-veil" aria-hidden="true" />
      <div className="section-kicker" data-reveal><span>02 / LA EXPERIENCIA</span><span aria-hidden="true">✳</span></div>
      <div className="experience-layout">
        <Lines id="experience-title" className="display-xl" lines={[
          'Hay lugares',
          'que te cambian',
          <span className="hl" key="hl">la perspectiva.</span>,
        ]} />
        <div className="experience-copy" data-reveal>
          <p className="lead">Y hay experiencias que te llevan más lejos.</p>
          <p>Axen Life Extreme reúne cuatro grandes voces en Whistler, Canadá. Un encuentro para abrir tu mente, retar tus límites y conectar con lo que sigue para ti.</p>
          <a className="text-link magnetic" href="#tu-siguiente-paso" data-cursor onClick={go}>
            <span className="button-label">Da el siguiente paso</span> <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>
    </section>
  );
}
