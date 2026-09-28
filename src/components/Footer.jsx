import React from 'react';
import logo from '../assets/axen-life-extreme-horizontal.svg';
import { scrollToId } from '../lib/scroll';

export default function Footer() {
  const go = (e) => { e.preventDefault(); scrollToId('#inicio'); };
  return (
    <footer className="footer">
      <a className="brand" href="#inicio" data-cursor onClick={go}>
        <img className="brand-logo" src={logo} alt="Axen Life Extreme" width="637" height="223" />
      </a>
      <p>EXTREME · WHISTLER, CANADÁ</p>
      <a className="footer-top magnetic" href="#inicio" data-cursor onClick={go}><span className="button-label">Volver a la cima</span> ↑</a>
    </footer>
  );
}
