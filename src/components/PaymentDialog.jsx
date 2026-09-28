import React, { useEffect, useRef, useState } from 'react';

const CURRENCY = 'MXN';

function parseAmount(value) {
  const raw = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Escribe un monto válido, mayor a cero y con hasta dos decimales.');
  const cents = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 99999999999) throw new Error('Revisa el importe de tu abono.');
  return cents;
}
function money(cents) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2 }).format(cents / 100);
}

function OrderSummary({ data, withOrder }) {
  const rows = [];
  if (withOrder) rows.push(['Folio de ejemplo', data.reference]);
  rows.push(['Concepto', 'Axen Life Extreme'], ['Nombre', data.name], ['Correo', data.email]);
  if (data.phone) rows.push(['WhatsApp', data.phone]);
  rows.push(['Abono de ejemplo', `${money(data.cents)} MXN`]);
  return (
    <div className="order-summary">
      <dl style={{ margin: 0 }}>
        {rows.map(([label, value]) => (
          <div className={`order-row${label === 'Abono de ejemplo' ? ' amount' : ''}`} key={label}>
            <dt>{label}</dt><dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function PaymentDialog({ open, onClose }) {
  const ref = useRef(null);
  const formRef = useRef(null);
  const [step, setStep] = useState('form');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const [order, setOrder] = useState(null);

  // abrir / cerrar el <dialog> nativo y clase para el cursor
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open) {
      if (!dlg.open) dlg.showModal();
      document.documentElement.classList.add('dialog-open');
      setStep('form'); setError(''); setDraft(null); setOrder(null);
      formRef.current && formRef.current.reset();
    } else if (dlg.open) {
      dlg.close();
    }
  }, [open]);

  // cierre nativo (Escape / backdrop)
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

  const submit = (e) => {
    e.preventDefault();
    setError('');
    const form = formRef.current;
    if (!form.reportValidity()) return;
    try {
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim();
      if (name.length < 2) throw new Error('Escribe tu nombre para identificar el abono.');
      setDraft({ name, email, phone: String(data.get('phone') || '').trim(), cents: parseAmount(data.get('amount')) });
      setStep('review');
    } catch (err) { setError(err.message); }
  };

  const generate = () => {
    if (!draft) return;
    let o = order;
    if (!o) {
      const bytes = new Uint8Array(5); crypto.getRandomValues(bytes);
      const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      o = { ...draft, reference: `DEMO-EXT-${token}`, createdAt: new Date().toISOString() };
      setOrder(o);
    }
    setStep('result');
  };

  const download = () => {
    if (!order) return;
    const text = [
      'AXEN LIFE EXTREME — ORDEN DE EJEMPLO',
      'DEMOSTRACIÓN · SIN VALIDEZ DE COBRO', '',
      `Folio: ${order.reference}`, `Fecha de generación: ${new Date(order.createdAt).toLocaleString('es-MX')}`,
      'Evento: Axen Life Extreme · Whistler, Canadá', `Nombre: ${order.name}`,
      `Correo: ${order.email}`, ...(order.phone ? [`WhatsApp: ${order.phone}`] : []),
      `Abono de ejemplo: ${money(order.cents)} MXN`, 'Estado: Pendiente de pago · Demostración', '',
      'La moneda y las condiciones del abono están por confirmar.',
      'Esta orden es ilustrativa. No se realizó ningún cargo, no acredita un abono y no reserva un lugar.',
      'No se envió ni guardó información en un servidor. El archivo descargado queda bajo tu control.',
    ].join('\n');
    const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${order.reference}.txt`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const labelledby = step === 'form' ? 'payment-title' : step === 'review' ? 'review-heading' : 'result-heading';

  return (
    <dialog id="payment-dialog" className="modal" ref={ref} onClick={backdrop} aria-labelledby={labelledby} aria-describedby={step === 'form' ? 'payment-intro' : undefined}>
      <button type="button" className="modal-close" onClick={() => ref.current.close()} aria-label="Cerrar formulario">×</button>
      <div className="modal-brand">AXEN LIFE <span>EXTREME</span></div>
      <div className="demo-label">VISTA PREVIA · SIN COBRO REAL</div>

      {step === 'form' && (
        <div className="payment-step">
          <p className="step-count">01 / TU ABONO</p>
          <h2 id="payment-title" tabIndex={-1}>Tu próxima cima<br />empieza aquí.</h2>
          <p className="modal-intro" id="payment-intro">Elige la cantidad que deseas abonar y revisa tu orden de ejemplo.</p>
          <form id="payment-form" ref={formRef} onSubmit={submit}>
            <div className="field"><label htmlFor="full-name">Nombre completo</label><input id="full-name" name="name" autoComplete="name" placeholder="Tu nombre y apellido" required maxLength={100} /></div>
            <div className="field-row">
              <div className="field"><label htmlFor="email">Correo electrónico</label><input type="email" id="email" name="email" autoComplete="email" placeholder="tu@correo.com" required maxLength={150} /></div>
              <div className="field"><label htmlFor="phone">WhatsApp <span>(opcional)</span></label><input type="tel" id="phone" name="phone" autoComplete="tel" placeholder="Tu número de contacto" maxLength={25} /></div>
            </div>
            <div className="field amount-field">
              <label htmlFor="amount">¿Cuánto quieres abonar?</label>
              <div className="amount-input"><input id="amount" name="amount" type="number" inputMode="decimal" min="0.01" max="999999999.99" step="0.01" placeholder="0.00" required aria-describedby="amount-help" /><span>MXN · EJEMPLO</span></div>
              <p id="amount-help">La moneda y las condiciones del abono están por confirmar.</p>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="button button-dark full-button">Revisar mi abono <span aria-hidden="true">↗</span></button>
            <p className="form-note">Usa datos de prueba. Esta demostración no envía ni guarda tus datos.</p>
          </form>
        </div>
      )}

      {step === 'review' && draft && (
        <div className="payment-step">
          <p className="step-count">02 / REVISA TU ORDEN</p>
          <h2 id="review-heading" tabIndex={-1}>Un paso más<br />hacia lo extraordinario.</h2>
          <p className="modal-intro">Confirma los datos de tu abono de ejemplo.</p>
          <OrderSummary data={draft} />
          <div className="review-actions">
            <button className="button button-dark full-button" onClick={generate}>Generar orden de ejemplo <span aria-hidden="true">↗</span></button>
            <button className="back-button" onClick={() => setStep('form')}>← Editar datos</button>
          </div>
          <p className="form-note">Generar esta orden no realiza un cargo ni confirma tu lugar.</p>
        </div>
      )}

      {step === 'result' && order && (
        <div className="payment-step">
          <p className="step-count">03 / TU ORDEN DE EJEMPLO</p>
          <div className="order-mark" aria-hidden="true">✓</div>
          <h2 id="result-heading" tabIndex={-1}>El primer paso,<br />en tus manos.</h2>
          <p className="order-state">PENDIENTE DE PAGO · DEMOSTRACIÓN</p>
          <OrderSummary data={order} withOrder />
          <p className="demo-explanation">Esta orden es ilustrativa: no tiene validez de cobro, no acredita un abono y no reserva un lugar.</p>
          <button className="button button-dark full-button" onClick={download}>Descargar orden de ejemplo <span aria-hidden="true">↓</span></button>
          <button className="back-button" onClick={() => ref.current.close()}>Volver a la experiencia</button>
        </div>
      )}
    </dialog>
  );
}
