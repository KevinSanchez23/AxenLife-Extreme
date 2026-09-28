import React from 'react';
import { marqueeWords } from '../data/site';

export default function Marquee() {
  const group = marqueeWords.map((w, i) => (
    <React.Fragment key={i}><span>{w}</span><span className="dot">✳</span></React.Fragment>
  ));
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track" id="marquee-track">
        {group}{group}
      </div>
    </div>
  );
}
