import React from 'react';
import { Lines } from './kinetic';
import { Button } from './Button';

export default function Closing({ onPay, onWhatsapp }) {
  return (
    <section className="closing section-pad" id="tu-siguiente-paso">
      <span className="section-veil" aria-hidden="true" />
      <div className="section-kicker" data-reveal><span>03 / TU SIGUIENTE PASO</span><span aria-hidden="true">✳</span></div>
      <div className="closing-content">
        <p className="eyebrow" data-reveal>AXEN LIFE EXTREME · WHISTLER</p>
        <Lines className="display-xxl" lines={[
          'Lo extraordinario',
          <span className="hl" key="hl">empieza contigo.</span>,
        ]} />
        <p className="closing-lede" data-reveal>Da el siguiente paso hacia una experiencia de altura.</p>
        <div className="hero-actions" data-reveal>
          <Button onClick={onPay}>Haz tu pago aquí</Button>
          <Button variant="light" onClick={onWhatsapp}>Obtén más información</Button>
        </div>
      </div>
    </section>
  );
}
