import React from 'react';
import logo from '../assets/axen-life-extreme-horizontal.svg';
import { sections } from '../data/site';
import { scrollToId } from '../lib/scroll';

export default function Header({ onPay, menuOpen, onToggleMenu }) {
  const navLinks = sections.filter((s) => s.nav);
  const go = (e, id) => { e.preventDefault(); scrollToId('#' + id); };
  return (
    <header className="site-header" id="site-header">
      <a className="brand" href="#inicio" aria-label="Axen Life Extreme, inicio" data-cursor onClick={(e) => go(e, 'inicio')}>
        <img className="brand-logo" src={logo} alt="Axen Life Extreme" width="637" height="223" />
      </a>
      <nav className="header-nav" aria-label="Navegación principal">
        {navLinks.map((s) => (
          <a key={s.id} href={'#' + s.id} data-nav data-cursor onClick={(e) => go(e, s.id)}>{s.label}</a>
        ))}
        <button className="nav-pay" data-cursor onClick={onPay}>
          <span className="nav-pay-label">Haz tu pago aquí</span> <span className="nav-pay-arrow" aria-hidden="true">↗</span>
        </button>
        <button className="menu-toggle" id="menu-toggle" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} data-cursor onClick={onToggleMenu}>
          <span /><span />
        </button>
      </nav>
    </header>
  );
}
