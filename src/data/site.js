// Contenido del sitio (data-driven). Edita aquí para actualizar ponentes,
// navegación o el marquee sin tocar los componentes.

import marthaDebayle from '../assets/martha-devayle.webp';
import danielHabif from '../assets/daniel_habif.webp';
import danteEludier from '../assets/dante_eludier.webp';
import invitadoSorpresa from '../assets/invitado_sorpresa.webp';

export const event = {
  dateRange: '06—09',
  month: 'DICIEMBRE',
  location: 'WHISTLER, CANADÁ',
  region: 'WHISTLER · BRITISH COLUMBIA',
};

export const speakers = [
  {
    no: '01',
    name: ['Martha', 'Debayle'],
    role: 'CONFERENCISTA',
    img: marthaDebayle,
    alt: 'Martha Debayle vestida de blanco sobre un pedestal de nieve',
  },
  {
    no: '02',
    name: ['Daniel', 'Habif'],
    role: 'CONFERENCISTA',
    img: danielHabif,
    alt: 'Daniel Habif sobre un pedestal de nieve',
  },
  {
    no: '03',
    name: ['Dante', 'Eludier'],
    role: 'CONFERENCISTA',
    img: danteEludier,
    alt: 'Dante Eludier sobre un pedestal de nieve',
  },
  {
    no: '04',
    name: ['Invitado', 'sorpresa'],
    role: 'LO MEJOR AÚN ESTÁ POR REVELARSE',
    img: invitadoSorpresa,
    alt: 'Silueta de hielo que representa al invitado sorpresa',
    surprise: true,
  },
];

// Orden de scroll de las secciones (define nav, menú e índices).
export const sections = [
  { id: 'inicio', label: 'Inicio', menuIndex: '01' },
  { id: 'ponentes', label: 'Los ponentes', menuIndex: '02', nav: true },
  { id: 'experiencia', label: 'La experiencia', menuIndex: '03', nav: true },
  { id: 'tu-siguiente-paso', label: 'Tu siguiente paso', menuIndex: '04' },
];

export const marqueeWords = ['ALTURA', 'WHISTLER', 'EXTREME', 'PERSPECTIVA', 'CANADÁ', 'AXEN LIFE'];
