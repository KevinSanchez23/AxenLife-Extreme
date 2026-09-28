import React from 'react';

export default function Ascent() {
  return (
    <aside className="ascent" id="ascent" aria-hidden="true">
      <span className="ascent-cap">CIMA</span>
      <span className="ascent-track">
        <span className="ascent-fill" id="ascent-fill" />
        <span className="ascent-marker" id="ascent-marker">▲</span>
      </span>
      <span className="ascent-pct" id="ascent-pct">00</span>
      <span className="ascent-base">BASE</span>
    </aside>
  );
}
