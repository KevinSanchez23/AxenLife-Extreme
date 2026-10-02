import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import type { Receipt } from './receipt.js';

export function createReceiptPdf(receipt: Receipt): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: {
        Title: 'Comprobante de abono - Axen Life Extreme',
        Author: 'Axen Life Extreme',
        Subject: receipt.livemode
          ? 'Abono confirmado por Stripe'
          : 'PRUEBA - Sin validez de pago',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    try {
      doc.registerFont(
        'Regular',
        fileURLToPath(new URL('../src/assets/fonts/Grift-500.woff2', import.meta.url)),
      );
      doc.registerFont(
        'Bold',
        fileURLToPath(new URL('../src/assets/fonts/Grift-700.woff2', import.meta.url)),
      );
      const width = 499;
      doc.rect(0, 0, 596, 170).fill('#17232b');
      doc
        .font('Bold')
        .fontSize(12)
        .fillColor('#ffffff')
        .text('AXEN LIFE', 48, 43, { characterSpacing: 2 });
      doc.fontSize(34).text('EXTREME', 48, 65, { characterSpacing: 1 });
      doc
        .font('Regular')
        .fontSize(11)
        .fillColor('#c9d8de')
        .text('Whistler, Canadá', 48, 112);
      doc.rect(48, 151, 44, 4).fill('#d8372b');
      doc
        .font('Bold')
        .fillColor('#17232b')
        .fontSize(26)
        .text('Comprobante de abono', 48, 203);
      doc
        .font('Regular')
        .fontSize(10)
        .fillColor('#53616a')
        .text(
          receipt.livemode
            ? 'PAGO CONFIRMADO POR STRIPE'
            : 'MODO PRUEBA - SIN VALIDEZ DE PAGO',
          48,
          243,
        );
      doc.roundedRect(48, 278, width, 95, 8).fill('#edf3f5');
      doc
        .font('Regular')
        .fontSize(10)
        .fillColor('#53616a')
        .text('IMPORTE ABONADO', 66, 294);
      const amount = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(receipt.cents / 100);
      doc
        .font('Bold')
        .fontSize(30)
        .fillColor('#17232b')
        .text(`${amount} MXN`, 66, 316, { width: width - 36 });
      let y = 402;
      const rows = [
        ['Nombre', receipt.name],
        ['Correo', receipt.email],
        ...(receipt.phone ? [['WhatsApp', receipt.phone]] : []),
        [
          'Fecha del pago',
          new Intl.DateTimeFormat('es-MX', {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: 'America/Mexico_City',
          }).format(new Date(receipt.paidAt)) + ' (Ciudad de México)',
        ],
        ['Referencia Stripe', receipt.reference],
      ];
      for (const [label, value] of rows) {
        doc.font('Regular').fontSize(10);
        const height = Math.max(
          16,
          doc.heightOfString(value, { width: 349, lineGap: 3 }),
        );
        doc.fillColor('#53616a').text(label, 48, y, { width: 132 });
        doc.fillColor('#17232b').text(value, 198, y, { width: 349, lineGap: 3 });
        y += height + 13;
        doc.moveTo(48, y).lineTo(547, y).lineWidth(0.5).strokeColor('#dce3e7').stroke();
        y += 13;
      }
      doc
        .font('Regular')
        .fontSize(9)
        .fillColor('#53616a')
        .text(
          receipt.livemode
            ? 'Este comprobante corresponde únicamente al abono indicado. No es una factura fiscal ni acredita la liquidación total del viaje.'
            : 'Documento de prueba. No acredita un cargo real, un abono ni la reserva de un lugar.',
          48,
          Math.max(y + 16, 685),
          { width, lineGap: 3 },
        );
      doc
        .fontSize(8)
        .fillColor('#53616a')
        .text('AXEN LIFE EXTREME  /  COMPROBANTE DE ABONO', 48, 779, {
          width,
          lineBreak: false,
        });
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}
