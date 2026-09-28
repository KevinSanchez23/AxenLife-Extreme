import React, { useEffect, useRef } from 'react';

export default function WhatsappDialog({ open, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open) { if (!dlg.open) dlg.showModal(); document.documentElement.classList.add('dialog-open'); }
    else if (dlg.open) dlg.close();
  }, [open]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const onCloseNative = () => {
      if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('dialog-open');
      onClose();
    };
    dlg.addEventListener('close', onCloseNative);
    return () => dlg.removeEventListener('close', onCloseNative);
  }, [onClose]);

  const backdrop = (e) => { if (e.target === ref.current) ref.current.close(); };

  return (
    <dialog id="whatsapp-dialog" className="modal whatsapp-modal" ref={ref} onClick={backdrop} aria-labelledby="whatsapp-title">
      <button type="button" className="modal-close" onClick={() => ref.current.close()} aria-label="Cerrar información">×</button>
      <div className="modal-brand">AXEN LIFE <span>EXTREME</span></div>
      <p className="step-count">ESTAMOS CERCA</p>
      <h2 id="whatsapp-title" tabIndex={-1}>Tu próxima aventura,<br />a un mensaje.</h2>
      <p className="modal-intro">Muy pronto podrás conversar con nuestro equipo por WhatsApp para conocer más sobre Axen Life Extreme.</p>
      <div className="contact-pending">Número de WhatsApp por confirmar</div>
      <button className="button button-dark full-button" onClick={() => ref.current.close()}>Seguir explorando <span aria-hidden="true">↗</span></button>
    </dialog>
  );
}
