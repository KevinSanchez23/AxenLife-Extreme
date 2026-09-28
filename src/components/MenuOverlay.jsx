import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { sections, event } from '../data/site';
import { scrollToId } from '../lib/scroll';

export default function MenuOverlay({ open, onClose, onPay }) {
  const ref = useRef(null);
  const [render, setRender] = useState(open);

  useEffect(() => {
    if (open) { setRender(true); return; }
    const t = setTimeout(() => setRender(false), 600);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && open) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleLink = (e, id) => {
    e.preventDefault();
    onClose();
    setTimeout(() => scrollToId('#' + id), 620);
  };

  return (
    <div className={`menu-overlay${open ? ' is-open' : ''}`} id="menu-overlay" ref={ref} role="dialog" aria-modal="true" aria-label="Menú" hidden={!render}>
      <div className="menu-inner">
        <p className="menu-eyebrow"><span>{event.location.replace(', ', ' · ')}</span><span>{event.dateRange} DIC</span></p>
        <nav className="menu-nav" aria-label="Menú principal">
          {sections.map((s) => (
            <a key={s.id} href={'#' + s.id} data-cursor onClick={(e) => handleLink(e, s.id)}>
              <span className="menu-index">{s.menuIndex}</span>
              <span className="menu-word">{s.label}</span>
            </a>
          ))}
        </nav>
        <div className="menu-foot">
          <Button onClick={() => { onClose(); onPay(); }}>Haz tu pago aquí</Button>
          <p className="menu-note">Axen Life Extreme · Una experiencia de altura</p>
        </div>
      </div>
    </div>
  );
}
