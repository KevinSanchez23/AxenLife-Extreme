// Publicar como aplicación web, ejecutada por el propietario.
// Configurar SPREADSHEET_ID y SHARED_SECRET en Propiedades del script.
// Usar un único despliegue/script como escritor de estas pestañas.
function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost(e) {
  var lock;
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('SHARED_SECRET');
    var spreadsheetId = props.getProperty('SPREADSHEET_ID');
    if (!secret || secret.length < 32 || !spreadsheetId) throw new Error('configuration');
    var raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 16000) throw new Error('body');
    var envelope = JSON.parse(raw);
    if (
      typeof envelope.timestamp !== 'string' ||
      !/^\d{13}$/.test(envelope.timestamp) ||
      Math.abs(Date.now() - Number(envelope.timestamp)) > 300000 ||
      typeof envelope.payload !== 'string' ||
      typeof envelope.signature !== 'string' ||
      !/^[a-f0-9]{64}$/.test(envelope.signature)
    )
      throw new Error('signature');
    var bytes = Utilities.computeHmacSha256Signature(
      envelope.timestamp + '.' + envelope.payload,
      secret,
      Utilities.Charset.UTF_8,
    );
    var expected = bytes
      .map(function (b) {
        return ('0' + ((b + 256) % 256).toString(16)).slice(-2);
      })
      .join('');
    var difference = 0;
    for (var i = 0; i < expected.length; i++)
      difference |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
    if (difference !== 0) throw new Error('signature');
    var p = JSON.parse(envelope.payload);
    if (
      typeof p.paymentId !== 'string' ||
      !/^pi_[A-Za-z0-9]+$/.test(p.paymentId) ||
      typeof p.sessionId !== 'string' ||
      !/^cs_[A-Za-z0-9_]+$/.test(p.sessionId) ||
      typeof p.eventId !== 'string' ||
      p.eventId.length > 100 ||
      typeof p.name !== 'string' ||
      p.name.length > 100 ||
      typeof p.email !== 'string' ||
      p.email.length > 150 ||
      !p.email ||
      typeof p.phone !== 'string' ||
      p.phone.length > 25 ||
      typeof p.confirmedAt !== 'string' ||
      !isFinite(Date.parse(p.confirmedAt)) ||
      !Number.isSafeInteger(p.amountCents) ||
      p.amountCents < 150000 ||
      p.amountCents > 99999999 ||
      p.currency !== 'mxn' ||
      p.status !== 'paid' ||
      typeof p.livemode !== 'boolean'
    )
      throw new Error('record');

    var subtotal = p.subtotalCents === undefined ? p.amountCents : p.subtotalCents;
    var tax = p.taxCents === undefined ? 0 : p.taxCents;
    if (
      !Number.isSafeInteger(subtotal) ||
      subtotal < 150000 ||
      !Number.isSafeInteger(tax) ||
      tax < 0 ||
      subtotal + tax !== p.amountCents
    )
      throw new Error('tax');

    lock = LockService.getScriptLock();
    lock.waitLock(5000);
    var book = SpreadsheetApp.openById(spreadsheetId);
    var tabName = p.livemode ? 'Abonos' : 'Abonos_pruebas';
    var sheet = book.getSheetByName(tabName) || book.insertSheet(tabName);
    var headers = [
      'ID pago Stripe',
      'ID sesión',
      'ID evento / origen',
      'Fecha confirmación / recuperación UTC',
      'Nombre',
      'Correo',
      'WhatsApp',
      'Abono MXN',
      'Moneda',
      'Estado',
      'Modo',
    ];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    } else {
      var existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
      if (
        headers.some(function (h, j) {
          return existingHeaders[j] !== h;
        })
      )
        throw new Error('headers');
    }
    // Preserve the original columns and historical rows. Column H remains total paid.
    var taxHeaders = ['Abono antes de impuestos MXN', 'IVA MXN'];
    var existingTaxHeaders = sheet.getRange(1, 12, 1, 2).getValues()[0];
    if (
      existingTaxHeaders.every(function (value) {
        return !value;
      })
    ) {
      sheet.getRange(1, 12, 1, 2).setValues([taxHeaders]);
    } else if (
      taxHeaders.some(function (value, index) {
        return existingTaxHeaders[index] !== value;
      })
    )
      throw new Error('tax headers');
    var lastRow = sheet.getLastRow();
    var duplicate =
      lastRow > 1 &&
      sheet
        .getRange(2, 1, lastRow - 1, 1)
        .createTextFinder(p.paymentId)
        .matchEntireCell(true)
        .useRegularExpression(false)
        .findNext();
    if (duplicate)
      return jsonResponse({ ok: true, paymentId: p.paymentId, duplicate: true });

    // Evitar que datos del formulario se interpreten como fórmulas de Sheets.
    function text(value) {
      return /^[\s]*[=+@\-]/.test(value) ? "'" + value : value;
    }
    sheet.appendRow([
      p.paymentId,
      p.sessionId,
      p.eventId,
      p.confirmedAt,
      text(p.name),
      text(p.email),
      text(p.phone),
      p.amountCents / 100,
      'MXN',
      'Pagado',
      p.livemode ? 'Real' : 'Prueba',
      subtotal / 100,
      tax / 100,
    ]);
    SpreadsheetApp.flush();
    return jsonResponse({ ok: true, paymentId: p.paymentId, duplicate: false });
  } catch (_error) {
    // Apps Script no permite establecer el código HTTP aquí: el backend verifica ok.
    return jsonResponse({ ok: false, error: 'No se pudo registrar el abono.' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
