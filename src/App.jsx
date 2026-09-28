import React, { useCallback, useEffect, useState } from 'react';
import Cursor from './components/Cursor';
import Header from './components/Header';
import MenuOverlay from './components/MenuOverlay';
import Ascent from './components/Ascent';
import Hero from './components/Hero';
import Marquee from './components/Marquee';
import Speakers from './components/Speakers';
import Experience from './components/Experience';
import Closing from './components/Closing';
import Footer from './components/Footer';
import PaymentDialog from './components/PaymentDialog';
import WhatsappDialog from './components/WhatsappDialog';
import { useSite } from './hooks/useSite';
import { lockScroll } from './lib/scroll';
import { clearPaymentReturn, readPaymentReturn } from './lib/payments';

const WHATSAPP_NUMBER = ''; // dígitos internacionales sin '+' cuando se confirme

export default function App() {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [paused, setPaused] = useState(reduced);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paymentReturn, setPaymentReturn] = useState(readPaymentReturn);
  const [paymentOpen, setPaymentOpen] = useState(() => Boolean(readPaymentReturn()));
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  useSite(paused, reduced);

  // menú: clase en body + bloqueo de scroll
  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);
    lockScroll(menuOpen);
  }, [menuOpen]);

  const openPayment = () => { setMenuOpen(false); setPaymentOpen(true); };
  const closePayment = useCallback(() => {
    setPaymentOpen(false); setPaymentReturn(null); clearPaymentReturn();
  }, []);
  const openWhatsapp = () => {
    if (/^[1-9]\d{9,14}$/.test(WHATSAPP_NUMBER)) {
      const msg = encodeURIComponent('Hola, me gustaría obtener más información sobre Axen Life Extreme en Whistler, Canadá.');
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank', 'noopener,noreferrer');
    } else setWhatsappOpen(true);
  };

  // WebMCP opcional: solo abre el formulario; pagar requiere la acción del usuario.
  useEffect(() => {
    if (!document.modelContext?.registerTool) return;
    const ctrl = new AbortController();
    try {
      Promise.resolve(document.modelContext.registerTool({
        name: 'start_abono', title: 'Abrir formulario de abono',
        description: 'Abre el formulario visible de abono de Axen Life Extreme. No crea una orden ni cobra dinero.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Este formulario se abre sin parámetros.');
          setPaymentOpen(true); return { opened: true, chargesMoney: false };
        },
      }, { signal: ctrl.signal })).catch(() => {});
    } catch { /* funciona sin esta API opcional */ }
    return () => ctrl.abort();
  }, []);

  return (
    <>
      <a className="skip-link" href="#ponentes">Saltar al contenido</a>
      <Cursor />
      <canvas id="snow-canvas" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <Header onPay={openPayment} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)} />
      <MenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} onPay={openPayment} />
      <Ascent />

      <main>
        <Hero onPay={openPayment} onWhatsapp={openWhatsapp} paused={paused} onTogglePaused={() => setPaused((v) => !v)} />
        <Marquee />
        <Speakers />
        <Experience />
        <Closing onPay={openPayment} onWhatsapp={openWhatsapp} />
      </main>

      <Footer />

      <PaymentDialog open={paymentOpen} onClose={closePayment} paymentReturn={paymentReturn} />
      <WhatsappDialog open={whatsappOpen} onClose={() => setWhatsappOpen(false)} />
    </>
  );
}
