import React from 'react';

// Divide un texto en palabras animables (.word > i con --wd continuo).
export function makeWords(text, counter) {
  return text.split(/(\s+)/).map((chunk, k) => {
    if (chunk.trim() === '') return chunk;
    const idx = counter.i++;
    return (
      <span className="word" key={`${idx}-${chunk}`}>
        <i style={{ '--wd': idx }}>{chunk}</i>
      </span>
    );
  });
}

// Titular del hero: "Lleva tu vida" + salto + "a lo más alto." resaltado.
export function HeroTitle() {
  const counter = { i: 0 };
  return (
    <h1 id="hero-title" className="hero-title kinetic" data-hero="3" style={{ '--d': 240 }}>
      {makeWords('Lleva tu vida', counter)} <br />
      <span className="hl">{makeWords('a lo más alto.', counter)}</span>
    </h1>
  );
}

// Titular con revelado por línea (.lines > .ln > .ln-i). `lines` es un arreglo
// de nodos React (contenido de cada línea).
export function Lines({ id, className = '', lines }) {
  return (
    <h2 id={id} className={`lines ${className}`} data-reveal>
      {lines.map((content, i) => (
        <span className="ln" key={i}>
          <span className="ln-i" style={{ '--i': i }}>{content}</span>
        </span>
      ))}
    </h2>
  );
}
