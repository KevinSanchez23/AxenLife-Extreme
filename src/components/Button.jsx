import React from 'react';

// Botón pill con cápsula de flecha. variant: 'dark' | 'light'.
export function Button({ variant = 'dark', children, onClick, href, arrow = '↗', className = '', full = false }) {
  const cls = `button button-${variant}${full ? ' full-button' : ''} magnetic ${className}`.trim();
  const inner = (
    <>
      <span className="button-label">{children}</span>{' '}
      <span className="button-arrow" aria-hidden="true">{arrow}</span>
    </>
  );
  if (href) return <a className={cls} href={href} data-cursor onClick={onClick}>{inner}</a>;
  return <button type="button" className={cls} data-cursor onClick={onClick}>{inner}</button>;
}
