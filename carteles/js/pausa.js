/* PAUSA — tiempo muerto y pausa técnica.
   ======================================

   Al revés que la ceremonia, esta va con el ESTADO: un tiempo muerto no es
   un instante, es una situación que dura. Mientras el servidor diga que hay
   uno, el cartel está puesto; cuando deje de decirlo, se va.

   El reloj lo lleva el navegador. El servidor manda el INSTANTE en que
   empezó y cuánto dura, no los segundos que quedan: así la cuenta atrás va
   suave aunque la red llegue a saltos, que es la misma razón por la que el
   reloj de ronda se manda igual. */

import { barra, cartel, conecta, relieve, tinta } from './enlace.js';

const caja = cartel('.cartel');
const pintaBarra = barra();
const nodo = document.querySelector('.cartel');
const tipo = document.getElementById('tipo');
const quien = document.getElementById('quien');
const reloj = document.getElementById('reloj');
/** @type {HTMLElement | null} */
const relleno = document.querySelector('.pausa__relleno');
const cupo = document.getElementById('cupo');
const pips = document.querySelector('.pausa__pips');
const fondo = document.querySelector('.cartel__fondo > div');

caja.escondeYa();

/** El último tiempo muerto visto, para poder seguir contando entre mensajes. */
let actual = null;

function pintaCartel(match, timeout) {
  const tecnica = timeout.kind === 'technical';
  const equipo = timeout.teamIndex === null ? null : match.teams[timeout.teamIndex];

  /*
   * La técnica va en gris y sin logo: no la pide nadie, la pide la
   * organización. Y en la técnica **desaparece el cupo**, porque no hay
   * nada que contar — es del LEEME del diseño.
   */
  tinta(nodo, tecnica || equipo === undefined || equipo === null ? null : timeout.teamIndex);

  if (tipo !== null) tipo.textContent = tecnica ? 'Pausa técnica' : 'Tiempo muerto';
  if (quien !== null) quien.textContent = tecnica ? 'Producción' : (equipo?.name ?? '');
  relieve(fondo, tecnica ? '' : (equipo?.logoUrl ?? ''));

  if (cupo !== null) cupo.style.visibility = tecnica ? 'hidden' : '';
  if (!tecnica && pips !== null && equipo !== null && equipo !== undefined) {
    const total = match.rules?.timeoutsPerTeam ?? 0;
    if (pips.children.length !== total) {
      pips.textContent = '';
      for (let k = 0; k < total; k += 1) pips.append(document.createElement('i'));
    }
    [...pips.children].forEach((pip, k) => {
      pip.className = k < equipo.timeoutsRemaining ? 'on' : '';
    });
  }
}

/** La cuenta atrás, que la lleva el navegador con su propio reloj. */
function tic() {
  if (actual === null || !caja.puesto) return;

  const total = actual.durationSec;
  const resto = Math.max(0, total - (Date.now() - actual.startedAt) / 1000);
  const min = Math.floor(resto / 60);
  const seg = Math.floor(resto % 60);

  if (reloj !== null) reloj.textContent = `${min}:${String(seg).padStart(2, '0')}`;
  if (relleno !== null && total > 0) {
    relleno.style.width = `${Math.max(0, Math.min(100, (resto / total) * 100)).toFixed(1)}%`;
  }
}

setInterval(tic, 100);

conecta({
  alEstado: (match) => {
    // La barra va siempre, no con el cartel.
    pintaBarra(match);

    const timeout = match.timeout ?? null;

    if (timeout === null) {
      actual = null;
      caja.sale();
      return;
    }

    actual = timeout;
    /*
     * No se escribe dentro mientras el cartel se mueve: reescribir un
     * elemento que está animándose reinicia lo que herede la animación. El
     * primer pintado va ANTES de pedir la entrada, por eso.
     */
    if (!caja.puesto) {
      pintaCartel(match, timeout);
      tic();
      caja.entra();
      return;
    }
    if (caja.quieto) {
      pintaCartel(match, timeout);
    }
  },
});
