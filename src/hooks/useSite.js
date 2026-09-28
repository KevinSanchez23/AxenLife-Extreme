import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { lenisRef } from '../lib/scroll';

/**
 * Capa de experiencia del sitio: smooth scroll (Lenis), parálax (GSAP/
 * ScrollTrigger), revelados + cristal (IntersectionObserver), cursor copo,
 * nieve en canvas, botones magnéticos, header + indicador de ascenso.
 * Portado de app.js a un hook con limpieza (compatible con StrictMode).
 */
export function useSite(paused, reduced) {
  const pausedRef = useRef(paused);
  const api = useRef({ startSnow: null, stopSnow: null, parallax: [], lenis: null });

  // --- Montaje: configura todo una sola vez ---
  useEffect(() => {
    const cleanups = [];
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const $ = (s) => document.querySelector(s);

    /* 1 · Cursor copo de nieve */
    (function cursor() {
      const cur = $('#cursor');
      if (!cur || !finePointer) { if (cur) cur.style.display = 'none'; return; }
      document.documentElement.classList.add('custom-cursor');
      cur.style.opacity = '0'; cur.style.transition = 'opacity .3s';
      let tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty, s = 1, ts = 1, shown = false, raf = 0;
      const move = (e) => { tx = e.clientX; ty = e.clientY; if (!shown) { shown = true; cur.style.opacity = '1'; } };
      const down = () => { ts = .78; }, up = () => { ts = 1; };
      const sel = 'a, button, [data-cursor], input, label';
      const over = (e) => { if (e.target.closest(sel)) cur.classList.add('is-hover'); };
      const out = (e) => { if (e.target.closest(sel)) cur.classList.remove('is-hover'); };
      window.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('pointerdown', down);
      window.addEventListener('pointerup', up);
      document.addEventListener('pointerover', over);
      document.addEventListener('pointerout', out);
      const loop = () => { cx += (tx - cx) * .22; cy += (ty - cy) * .22; s += (ts - s) * .2; cur.style.transform = `translate3d(${cx}px,${cy}px,0) scale(${s})`; raf = requestAnimationFrame(loop); };
      loop();
      cleanups.push(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up);
        document.removeEventListener('pointerover', over); document.removeEventListener('pointerout', out);
        document.documentElement.classList.remove('custom-cursor');
      });
    })();

    /* 2 · Botones magnéticos */
    if (finePointer) {
      document.querySelectorAll('.magnetic').forEach((el) => {
        const strength = .3;
        const mv = (e) => { if (pausedRef.current) return; const r = el.getBoundingClientRect(); el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`; };
        const lv = () => { el.style.transform = ''; };
        el.addEventListener('pointermove', mv); el.addEventListener('pointerleave', lv);
        cleanups.push(() => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerleave', lv); });
      });
    }

    /* 3 · Índices para splits (por si el CSS los usa) y revelados */
    document.querySelectorAll('.lines').forEach((h) => h.querySelectorAll('.ln-i').forEach((el, i) => el.style.setProperty('--i', i)));
    document.querySelectorAll('.speaker[data-reveal]').forEach((el, i) => el.style.setProperty('--reveal-delay', `${(i % 4) * 90}ms`));

    const observers = [];
    if ('IntersectionObserver' in window) {
      const rev = new IntersectionObserver((entries, obs) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); obs.unobserve(e.target); } }, { threshold: .16, rootMargin: '0px 0px -8% 0px' });
      document.querySelectorAll('[data-reveal]').forEach((el) => rev.observe(el));
      const veil = new IntersectionObserver((entries, obs) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); obs.unobserve(e.target); } }, { threshold: .08 });
      document.querySelectorAll('main > section.section-pad').forEach((el) => veil.observe(el));
      observers.push(rev, veil);
    }
    cleanups.push(() => observers.forEach((o) => o.disconnect()));

    /* 4 · Entrada del hero */
    const heroRaf = requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('hero-in')));
    cleanups.push(() => cancelAnimationFrame(heroRaf));

    /* 5 · Header + indicador de ascenso */
    const header = $('#site-header'), aFill = $('#ascent-fill'), aMark = $('#ascent-marker'), aPct = $('#ascent-pct');
    let uiTick = false;
    const updateUI = () => {
      const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight, p = max > 0 ? Math.min(1, y / max) : 0;
      if (header) header.classList.toggle('is-scrolled', y > 40);
      if (aFill) { aFill.style.height = (p * 100) + '%'; aMark.style.bottom = (p * 100) + '%'; aPct.textContent = String(Math.round(p * 100)).padStart(2, '0'); }
      uiTick = false;
    };
    const onScroll = () => { if (!uiTick) { uiTick = true; requestAnimationFrame(updateUI); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    updateUI();
    cleanups.push(() => window.removeEventListener('scroll', onScroll));

    /* 6 · Nieve + emblema 3D */
    const canvas = $('#snow-canvas'), context = canvas ? canvas.getContext('2d') : null;
    const emblem = $('#emblem'), cubes = [...document.querySelectorAll('.ice-cube')];
    let width = innerWidth, height = innerHeight, sections = [], frame = 0, lastTime = 0, lastScroll = window.scrollY;
    let wind = 0, pointerX = 0, pointerY = 0, easedX = 0, easedY = 0, storm = 0, lastSection = 0;
    const flakes = [];
    const measure = () => {
      width = innerWidth; height = innerHeight;
      if (!canvas) return;
      const d = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * d); canvas.height = Math.round(height * d);
      context && context.setTransform(d, 0, 0, d, 0, 0);
      sections = [...document.querySelectorAll('main>section')].map((el) => el.offsetTop);
      const count = width < 760 ? 46 : 82; flakes.length = 0;
      for (let i = 0; i < count; i++) flakes.push({ x: Math.random() * width, y: Math.random() * height, r: .5 + Math.random() * 2, speed: .35 + Math.random() * 1.05, phase: Math.random() * Math.PI * 2, alpha: .25 + Math.random() * .5 });
    };
    const animate = (time) => {
      if (pausedRef.current || document.hidden) return;
      const delta = lastTime ? Math.min((time - lastTime) / 16.667, 2) : 1; lastTime = time;
      const scroll = window.scrollY;
      const vel = api.current.lenis ? (api.current.lenis.velocity || 0) * 2 : Math.max(-35, Math.min(35, scroll - lastScroll)); lastScroll = scroll;
      wind += (vel - wind) * .06;
      easedX += (pointerX - easedX) * .045; easedY += (pointerY - easedY) * .045;
      const active = sections.reduce((v, top, i) => scroll + height * .52 >= top ? i : v, 0);
      if (active !== lastSection) { storm = 1; lastSection = active; }
      storm = Math.max(0, storm - .012 * delta);
      if (scroll < height * 1.6 && emblem) {
        const float = Math.sin(time * .0007) * 8;
        emblem.style.transform = `translate3d(0,${float - scroll * .06}px,0) rotateX(${easedY * -5}deg) rotateY(${-5 + easedX * 10}deg) rotateZ(${easedX * 1.5}deg)`;
      }
      cubes.forEach((c, i) => { c.style.transform = `rotateX(${time * .008 + scroll * .05 + i * 22}deg) rotateY(${time * .013 + scroll * .07 + i * 40}deg) rotateZ(${scroll * .015}deg)`; });
      if (context) {
        context.clearRect(0, 0, width, height);
        for (const f of flakes) {
          f.x += (Math.sin(time * .0002 + f.phase) * .25 + .4 + wind * .13 + storm * 9) * delta;
          f.y += (f.speed + Math.abs(wind) * .05 + storm * 1.7) * delta;
          if (f.y > height + 10) { f.y = -10; f.x = Math.random() * width; }
          if (f.x > width + 15) f.x = -15; if (f.x < -15) f.x = width + 15;
          context.beginPath(); context.fillStyle = `rgba(255,255,255,${f.alpha})`;
          context.ellipse(f.x, f.y, f.r * (1 + storm * 2.4), f.r, -.32, 0, Math.PI * 2); context.fill();
        }
      }
      frame = requestAnimationFrame(animate);
    };
    const startSnow = () => { if (pausedRef.current || document.hidden) return; lastTime = 0; cancelAnimationFrame(frame); frame = requestAnimationFrame(animate); };
    const stopSnow = () => { cancelAnimationFrame(frame); context && context.clearRect(0, 0, width, height); if (emblem) emblem.style.transform = 'rotateY(-4deg)'; cubes.forEach((c, i) => { c.style.transform = `rotateX(${24 + i * 15}deg) rotateY(35deg)`; }); };
    api.current.startSnow = startSnow; api.current.stopSnow = stopSnow;
    const onPointer = (e) => { pointerX = e.clientX / width * 2 - 1; pointerY = e.clientY / height * 2 - 1; };
    const onResize = () => { measure(); ScrollTrigger.refresh(); };
    const onVis = () => { cancelAnimationFrame(frame); if (!document.hidden && !pausedRef.current) startSnow(); };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    measure();
    cleanups.push(() => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointer); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis);
    });

    /* 7 · Smooth scroll (Lenis) + parálax (GSAP/ScrollTrigger) */
    let lenis = null;
    if (!reduced) {
      lenis = new Lenis({ lerp: .1, wheelMultiplier: 1, smoothWheel: true, touchMultiplier: 1.6 });
      api.current.lenis = lenis;
      lenisRef.current = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      const tick = (t) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      cleanups.push(() => { gsap.ticker.remove(tick); lenis.destroy(); api.current.lenis = null; lenisRef.current = null; });

      gsap.registerPlugin(ScrollTrigger);
      const triggers = [];
      gsap.utils.toArray('[data-parallax]').forEach((el) => {
        if (el.hasAttribute('data-hero') || el.hasAttribute('data-reveal')) return;
        const speed = parseFloat(el.getAttribute('data-speed')) || .1;
        const range = speed * 220;
        const tw = gsap.fromTo(el, { y: range }, { y: -range, ease: 'none', scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: .6 } });
        if (tw.scrollTrigger) triggers.push(tw.scrollTrigger);
      });
      api.current.parallax = triggers;
      ScrollTrigger.refresh();
      cleanups.push(() => { triggers.forEach((t) => t.kill()); });
    }

    // arranque de la nieve según estado inicial
    if (!pausedRef.current) startSnow();

    return () => { cleanups.forEach((fn) => fn()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Reacciona a pausa ---
  useEffect(() => {
    pausedRef.current = paused;
    document.body.classList.toggle('motion-paused', paused);
    const a = api.current;
    a.parallax.forEach((t) => (paused ? t.disable() : t.enable()));
    if (paused) a.stopSnow && a.stopSnow();
    else a.startSnow && a.startSnow();
  }, [paused]);
}
