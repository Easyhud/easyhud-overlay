/* ══ Victoria — generador ══════════════════════════════════════════════════
   Pinta la pantalla desde VICTORIA (js/datos-victoria.js). El estático ya
   trae este mismo marcado escrito a mano; este fichero está para ver de dónde
   sale cada dato y para conectar el resultado real.                         */
/*
 * ÚNICO cambio respecto al fichero de diseño: era una función que se
 * ejecutaba sola al cargar y leía un objeto global. Ahora se la llama con el
 * resultado cuando la partida termina de verdad.
 */
window.pintaVictoria = (D) => {
  const vic = document.querySelector('.vic');
  if (!vic) return;

  const pinta = () => {
    const eq = D.equipos[D.ganador];
    const bando = D.ganador ? 'def' : 'atk';
    const nombre = eq.nombre.toUpperCase();

    /* El color del ganador entra por variables: el CSS no sabe quién ganó. */
    vic.style.setProperty('--c', 'var(--' + bando + ')');
    vic.style.setProperty('--cl', 'var(--' + bando + '-light)');

    /* Muro: el nombre repetido por fila. El desplazamiento lateral y el trazo
       los pone el CSS (nth-child), aquí solo va el texto. */
    const fila = (nombre + '   ').repeat(D.repeticiones);
    let muro = '';
    for (let k = 0; k < D.filasMuro; k++) muro += '<span>' + fila + '</span>';

    vic.innerHTML =
        '<div class="vic__muro"><div class="vic__deriva">' + muro + '</div></div>'
      + '<div class="vic__reticula"></div>'
      + '<div class="vic__escudo" style="--logo: url(\'' + eq.logo + '\');"></div>'
      + '<div class="vic__banda"><span class="vic__palabra">' + D.palabra + '</span></div>';
  };
  pinta();
};
