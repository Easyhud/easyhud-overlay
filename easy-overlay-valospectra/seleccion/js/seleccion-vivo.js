/* ══ Selección — comportamiento en vivo ═══════════════════════════════════
   Trabaja sobre el marcado YA presente, así que sirve igual al estático y al
   generado. Dos cosas que son cambios de estado, no dibujo:

     · el que está eligiendo va cambiando de agente cada 620 ms
     · al confirmar, la tarjeta da un golpe y suelta el destello

   Las animaciones de bucle (logo extruido, rótulo, casilla vacía) no pasan por
   aquí: son CSS puro y corren sin JS.                                       */
import { AGENTES, PAPEL_DE_AGENTE } from './catalogo.js';

(() => {
  const banda = document.querySelector('.sel-banda');
  if (!banda) return;

  const { retratoAgente, iconoPapel } = window.HUD || {};
  if (!retratoAgente) return;   // hace falta cdn.js

  /*
   * Los veintinueve agentes, no diez.
   *
   * El fichero de diseño traía una rueda de diez escrita a mano, que bastaba
   * para maquetar. Con el elenco entero, quien está eligiendo pasa por todos
   * los agentes de verdad —que es lo que hace el juego— en vez de por una
   * selección.
   */
  const RUEDA = Object.keys(AGENTES).sort();
  const PAPELES = PAPEL_DE_AGENTE;
  const nombre = a => a.charAt(0).toUpperCase() + a.slice(1);

  /* ── el que duda va cambiando de agente ──
     Solo se toca su retrato y su nombre; la tarjeta no se repinta, para no
     reiniciar las animaciones de entrada ni el latido del rótulo. */
  let vuelta = 0;
  setInterval(() => {
    vuelta++;
    banda.querySelectorAll('.celda--eligiendo').forEach(c => {
      const lado = +c.dataset.lado || 0;
      const pos = +c.dataset.pos || 0;
      const agente = RUEDA[(vuelta + pos * 3 + lado * 5) % RUEDA.length];
      const r = c.querySelector('.celda__retrato');
      if (!r) return;
      r.style.backgroundImage = "url('" + retratoAgente(agente) + "')";
      c.querySelector('.celda__agente').textContent = nombre(agente);
      /* Reiniciar una animación exige quitarla, forzar un reflujo y reponerla:
         sin el reflujo el navegador no reinicia nada. */
      r.style.animation = 'none';
      void r.offsetWidth;
      r.style.animation = '';
    });
  }, 620);

  /* ── confirmar el agente del que está eligiendo ──
     Avanza el equipo que va por detrás, igual que el juego alterna turnos. */
  const confirma = () => {
    const filas = [...banda.querySelectorAll('.sel-fila')];
    const hechos = filas.map(f => f.querySelectorAll('.celda--elegido').length);
    const lado = hechos[1] < hechos[0] ? 1 : 0;
    const c = filas[lado] && filas[lado].querySelector('.celda--eligiendo');
    if (!c) return;

    /* El agente que se queda es el que estuviese en pantalla en ese momento. */
    const visible = (c.querySelector('.celda__agente') || {}).textContent || '';
    const clave = visible.toLowerCase();
    const papel = PAPELES[clave];

    c.classList.remove('celda--eligiendo');
    c.classList.add('celda--elegido');
    const rot = c.querySelector('.celda__eligiendo');
    if (rot) rot.remove();
    /* Al confirmar aparece el papel: antes no hay composición que anticipar. */
    if (papel && !c.querySelector('.celda__papel')) {
      const i = document.createElement('div');
      i.className = 'celda__papel';
      i.style.backgroundImage = "url('" + iconoPapel(papel) + "')";
      c.querySelector('.celda__meta').prepend(i);
    }

    /* El siguiente de la fila pasa a estar eligiendo. */
    const sig = c.nextElementSibling;
    if (sig && sig.classList.contains('celda')) {
      sig.classList.add('celda--eligiendo');
      const hueco = sig.querySelector('.celda__hueco');
      if (hueco) {
        const r = document.createElement('div');
        r.className = 'celda__retrato';
        r.style.backgroundImage = "url('" + retratoAgente(RUEDA[0]) + "')";
        hueco.replaceWith(r);
      }
      const rr = document.createElement('span');
      rr.className = 'celda__eligiendo';
      rr.textContent = 'eligiendo';
      sig.appendChild(rr);
    }

    /* El golpe va en su propia clase para no pisar la animación de entrada. */
    c.classList.add('es-encaja');
    setTimeout(() => c.classList.remove('es-encaja'), 470);
  };

  window.bloquear = { etiqueta: 'Confirmar agente', accion: confirma };
})();
