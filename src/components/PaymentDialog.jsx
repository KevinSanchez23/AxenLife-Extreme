import React, { useEffect, useRef, useState } from 'react';
import {
  newAttempt,
  parseAmount,
  paymentRequest,
  readAttempt,
  saveAttempt,
} from '../lib/payments';

function money(cents) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
    cents / 100,
  );
}

function OrderSummary({ data }) {
  const rows = [
    ['Concepto', 'Axen Life Extreme'],
    ['Nombre', data.name],
    ['Correo', data.email],
  ];
  if (data.phone) rows.push(['WhatsApp', data.phone]);
  if (data.reference) rows.push(['Referencia', data.reference]);
  if (data.paidAt)
    rows.push([
      'Fecha del pago',
      new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Mexico_City',
      }).format(new Date(data.paidAt)) + ' (CDMX)',
    ]);
  rows.push(['Abono', `${money(data.cents)} MXN`]);
  return (
    <div className="order-summary">
      <dl style={{ margin: 0 }}>
        {rows.map(([label, value]) => (
          <div className={`order-row${label === 'Abono' ? ' amount' : ''}`} key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function PaymentDialog({ open, onClose, paymentReturn }) {
  const ref = useRef(null);
  const formRef = useRef(null);
  const attemptRef = useRef(null);
  const inFlight = useRef(false);
  const [step, setStep] = useState('form');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);

  useEffect(() => {
    const restored = () => {
      inFlight.current = false;
      setBusy(false);
    };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, []);

  useEffect(() => {
    const dlg = ref.current;
    if (open) {
      if (!dlg.open) dlg.showModal();
      document.documentElement.classList.add('dialog-open');
      setError('');
      setOrder(null);
      setStep(paymentReturn?.type === 'success' ? 'checking' : 'form');
      if (!paymentReturn) {
        setDraft(null);
        attemptRef.current = null;
      }
    } else if (dlg.open) dlg.close();
  }, [open, paymentReturn]);

  useEffect(() => {
    if (!open || paymentReturn?.type !== 'success') return;
    const controller = new AbortController();
    let active = true;
    setStep('checking');
    setError('');
    const attempt = readAttempt();
    if (!attempt?.accessToken || !paymentReturn.sessionId) {
      setError(
        'No encontramos el acceso a este comprobante. Vuelve desde Stripe en la misma pestaña donde iniciaste el pago. Si ya pagaste, contacta al equipo; no necesitas abonar otra vez.',
      );
      setStep('verification-error');
      return () => controller.abort();
    }
    const timeout = setTimeout(() => controller.abort(), 25000);
    paymentRequest(
      '/api/pago',
      { sessionId: paymentReturn.sessionId, accessToken: attempt.accessToken },
      { signal: controller.signal },
    )
      .then((response) => response.json())
      .then((result) => {
        if (!active) return;
        if (result.status === 'paid') {
          setOrder(result.receipt);
          setStep('result');
        } else if (result.status === 'pending') setStep('pending');
        else if (result.status === 'expired') setStep('expired');
        else if (result.status === 'refunded') setStep('adjusted');
        else throw new Error('No se pudo verificar este abono.');
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err.name === 'AbortError'
            ? 'La consulta tardó demasiado. Verifica nuevamente; no necesitas pagar otra vez.'
            : err.message,
        );
        setStep('verification-error');
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [open, paymentReturn, checkVersion]);

  useEffect(() => {
    const dlg = ref.current;
    const closed = () => {
      if (!document.querySelector('dialog[open]'))
        document.documentElement.classList.remove('dialog-open');
      onClose();
    };
    const cancel = (e) => {
      if (inFlight.current) e.preventDefault();
    };
    dlg.addEventListener('close', closed);
    dlg.addEventListener('cancel', cancel);
    return () => {
      dlg.removeEventListener('close', closed);
      dlg.removeEventListener('cancel', cancel);
    };
  }, [onClose]);

  useEffect(() => {
    if (open) ref.current?.querySelector('h2')?.focus();
  }, [step, open]);

  function submit(e) {
    e.preventDefault();
    setError('');
    if (!formRef.current.reportValidity()) return;
    try {
      const data = new FormData(formRef.current);
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '')
        .trim()
        .toLowerCase();
      if (name.length < 2) throw new Error('Escribe tu nombre completo.');
      if (
        email !==
        String(data.get('confirmEmail') || '')
          .trim()
          .toLowerCase()
      )
        throw new Error(
          'Los correos no coinciden. Revísalos para vincular correctamente tu abono.',
        );
      const cents = parseAmount(data.get('amount'));
      setDraft({ name, email, phone: String(data.get('phone') || '').trim(), cents });
      setStep('review');
    } catch (err) {
      setError(err.message);
    }
  }

  async function pay() {
    if (!draft || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const body = {
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        amount: (draft.cents / 100).toFixed(2),
      };
      const fingerprint = JSON.stringify(body);
      if (attemptRef.current?.fingerprint !== fingerprint)
        attemptRef.current = { ...newAttempt(), fingerprint };
      const { requestId, accessToken } = attemptRef.current;
      saveAttempt({ requestId, accessToken });
      const response = await paymentRequest(
        '/api/crear-pago',
        { ...body, accessToken },
        {
          requestId,
          signal: AbortSignal.timeout(25000),
        },
      );
      const result = await response.json();
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com')
        throw new Error('La dirección de pago no es válida.');
      window.location.assign(url.href);
    } catch (err) {
      setError(
        err.name === 'TimeoutError'
          ? 'La solicitud tardó demasiado. Puedes reintentar con el mismo abono.'
          : err.message,
      );
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function download() {
    if (!order || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await paymentRequest(
        '/api/comprobante',
        {
          sessionId: paymentReturn.sessionId,
          accessToken: readAttempt()?.accessToken,
        },
        { signal: AbortSignal.timeout(25000) },
      );
      if (!response.headers.get('content-type')?.includes('application/pdf'))
        throw new Error('No se pudo generar el comprobante.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `abono-${order.reference}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(
        err.name === 'TimeoutError'
          ? 'La descarga tardó demasiado. Intenta nuevamente.'
          : err.message,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const close = () => {
    if (!inFlight.current) ref.current.close();
  };
  const retry = () => setCheckVersion((v) => v + 1);
  return (
    <dialog
      id="payment-dialog"
      className="modal"
      data-lenis-prevent
      ref={ref}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-labelledby="payment-title"
      aria-busy={busy || step === 'checking'}
    >
      <button
        type="button"
        className="modal-close"
        onClick={close}
        disabled={busy}
        aria-label="Cerrar formulario"
      >
        ×
      </button>
      <div className="modal-brand">
        AXEN LIFE <span>EXTREME</span>
      </div>

      {step === 'form' && (
        <div className="payment-step">
          <p className="step-count">01 / TU ABONO</p>
          <h2 id="payment-title" tabIndex={-1}>
            Tu próxima cima
            <br />
            empieza aquí.
          </h2>
          <p className="modal-intro">
            Elige cuánto deseas abonar. El mínimo es de $1,500.00 MXN.
          </p>
          {paymentReturn?.type === 'cancelled' && (
            <p className="payment-notice" role="status">
              Saliste del proceso de pago. Puedes revisar tus datos e intentarlo
              nuevamente.
            </p>
          )}
          <form id="payment-form" ref={formRef} onSubmit={submit}>
            <div className="field">
              <label htmlFor="full-name">Nombre completo</label>
              <input
                id="full-name"
                name="name"
                autoComplete="name"
                placeholder="Tu nombre y apellido"
                defaultValue={draft?.name || ''}
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div className="field">
              <label htmlFor="email">Correo electrónico</label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                defaultValue={draft?.email || ''}
                required
                maxLength={150}
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-email">Confirma tu correo</label>
              <input
                type="email"
                id="confirm-email"
                name="confirmEmail"
                autoComplete="off"
                placeholder="Escribe nuevamente tu correo"
                defaultValue={draft?.email || ''}
                required
                maxLength={150}
              />
            </div>
            <div className="field">
              <label htmlFor="phone">
                WhatsApp <span>(opcional)</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                autoComplete="tel"
                placeholder="Tu número de contacto"
                defaultValue={draft?.phone || ''}
                maxLength={25}
              />
            </div>
            <div className="field amount-field">
              <label htmlFor="amount">¿Cuánto quieres abonar?</label>
              <div className="amount-input">
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min="1500"
                  max="999999.99"
                  step="0.01"
                  placeholder="1500.00"
                  defaultValue={draft ? (draft.cents / 100).toFixed(2) : ''}
                  required
                  aria-describedby="amount-help"
                />
                <span>MXN</span>
              </div>
              <p id="amount-help">Importe en pesos mexicanos. Abono mínimo: $1,500.00.</p>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="button button-dark full-button">
              Revisar mi abono <span aria-hidden="true">↗</span>
            </button>
            <p className="form-note">
              Vincularemos tu abono al correo indicado. El pago se completa en Stripe.
            </p>
          </form>
        </div>
      )}

      {step === 'review' && draft && (
        <div className="payment-step">
          <p className="step-count">02 / REVISA TU ABONO</p>
          <h2 id="payment-title" tabIndex={-1}>
            Un paso más
            <br />
            hacia lo extraordinario.
          </h2>
          <p className="modal-intro">
            Confirma el importe y tu correo antes de continuar al pago.
          </p>
          <OrderSummary data={draft} />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="review-actions">
            <button
              className="button button-dark full-button"
              disabled={busy}
              onClick={pay}
            >
              {busy ? 'Abriendo Stripe…' : 'Continuar a pagar'}{' '}
              <span aria-hidden="true">↗</span>
            </button>
            <button
              className="back-button"
              disabled={busy}
              onClick={() => {
                setError('');
                setStep('form');
              }}
            >
              ← Editar datos
            </button>
          </div>
          <p className="form-note">
            Al confirmar el pago podrás descargar tu comprobante en PDF.
          </p>
        </div>
      )}

      {step === 'result' && order && (
        <div className="payment-step">
          <p className="step-count">03 / TU COMPROBANTE</p>
          <div className="order-mark" aria-hidden="true">
            ✓
          </div>
          <h2 id="payment-title" tabIndex={-1}>
            Tu abono está confirmado.
          </h2>
          <p className="order-state">PAGO CONFIRMADO POR STRIPE</p>
          <OrderSummary data={order} />
          <p className="demo-explanation">
            Conserva el comprobante de este abono. No es una factura fiscal ni acredita la
            liquidación total del viaje.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button button-dark full-button"
            disabled={busy}
            onClick={download}
          >
            {busy ? 'Preparando PDF…' : 'Descargar comprobante PDF'}{' '}
            <span aria-hidden="true">↓</span>
          </button>
          <button className="back-button" disabled={busy} onClick={close}>
            Volver a la experiencia
          </button>
        </div>
      )}

      {['checking', 'pending', 'expired', 'adjusted', 'verification-error'].includes(
        step,
      ) && (
        <div className="payment-step" aria-live="polite">
          <p className="step-count">03 / ESTADO DEL PAGO</p>
          <h2 id="payment-title" tabIndex={-1}>
            {step === 'checking'
              ? 'Verificando tu abono…'
              : step === 'pending'
                ? 'Tu pago sigue pendiente.'
                : step === 'expired'
                  ? 'La sesión expiró.'
                  : step === 'adjusted'
                    ? 'Este pago tiene cambios.'
                    : 'No pudimos verificar el pago.'}
          </h2>
          <p className="modal-intro">
            {step === 'checking'
              ? 'Estamos consultando la confirmación de Stripe.'
              : step === 'pending'
                ? 'Aún no hay un abono confirmado. Si completaste el pago, espera un momento y verifica nuevamente antes de intentar otro cargo.'
                : step === 'expired'
                  ? 'Esta sesión de Stripe ya no está disponible. Si tienes un cargo en tu banco, consulta al equipo antes de volver a pagar.'
                  : step === 'adjusted'
                    ? 'El pago tiene una devolución o disputa. Contacta al equipo para revisar el estado actualizado.'
                    : error}
          </p>
          {['pending', 'verification-error'].includes(step) && (
            <button className="button button-dark full-button" onClick={retry}>
              Verificar nuevamente <span aria-hidden="true">↻</span>
            </button>
          )}
          <button className="back-button" onClick={close}>
            Volver a la experiencia
          </button>
        </div>
      )}
    </dialog>
  );
}
