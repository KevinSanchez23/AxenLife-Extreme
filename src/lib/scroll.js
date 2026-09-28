// Instancia compartida de Lenis para navegación con smooth scroll.
export const lenisRef = { current: null };

export function scrollToId(id) {
  const el = document.querySelector(id);
  if (!el) return;
  if (lenisRef.current) lenisRef.current.scrollTo(el, { offset: 0 });
  else el.scrollIntoView({ behavior: 'smooth' });
}

export function lockScroll(locked) {
  const l = lenisRef.current;
  if (!l) return;
  locked ? l.stop() : l.start();
}
