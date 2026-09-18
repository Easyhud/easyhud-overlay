/* BINDS DEL OBSERVADOR — el pintor.
   =================================

   Pinta SOLO el icono de cada agente con su tecla de observador (chiquita):
   izquierda 1–5, derecha 6–0, en el orden de la barra de arriba del juego.

   El amarillo aparece SOLO en el jugador RECOMENDADO por el auto-director
   (`jugador.recomendado`), no en el que se observa. El motor de recomendación
   es aparte; aquí solo se pinta la marca.

   ORDEN: por ahora usa el orden posicional de `estado.jugadores` (Nivel 1).
   Cuando el cliente mande `ui_team_order` de GEP, se reordena por ahí y el
   mapeo pasa a ser EXACTO. */

import { suscribe } from '../../combate/js/datos.js';
import { iconoAgente } from '../../combate/js/cdn.js';

/* Teclas del observador: izquierda 1–5, derecha 6–0 (el décimo es 0). */
const TECLAS = [
  ['1', '2', '3', '4', '5'],
  ['6', '7', '8', '9', '0'],
];

/* Roster de ejemplo, solo para VER la ventana sin partida. Marco a uno como
   `recomendado` para ver el amarillo; en el juego lo pone el auto-director. */
const DEMO = [
  [
    { agente: 'jett' },
    { agente: 'sova' },
    { agente: 'killjoy', recomendado: true },
    { agente: 'omen' },
    { agente: 'raze' },
  ],
  [
    { agente: 'chamber' },
    { agente: 'cypher' },
    { agente: 'neon' },
    { agente: 'reyna' },
    { agente: 'sage' },
  ],
];

const $ = (id) => document.getElementById(id);

function celdaHTML(jugador, tecla) {
  const clave = String(jugador?.agente || '').toLowerCase();
  const url = iconoAgente(clave);
  const icono = url
    ? `<img class="bind__ag" src="${url}" alt="">`
    : '<span class="bind__ag bind__ag--vacio"></span>';
  const rec = jugador?.recomendado === true ? ' bind--rec' : '';
  return `<div class="bind${rec}">${icono}<span class="bind__tecla">${tecla}</span></div>`;
}

function pinta(jugadores) {
  [0, 1].forEach((lado) => {
    const col = $(lado === 0 ? 'lado-izq' : 'lado-der');
    if (!col) return;
    const reales = Array.isArray(jugadores?.[lado]) ? jugadores[lado] : [];
    const lista = reales.length > 0 ? reales : DEMO[lado];
    col.innerHTML = lista
      .slice(0, 5)
      .map((jug, i) => celdaHTML(jug, TECLAS[lado][i]))
      .join('');
  });
}

suscribe((e) => pinta(e.jugadores));
