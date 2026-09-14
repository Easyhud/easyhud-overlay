/* Por qué esta pantalla está en negro.
   ====================================

   Las pantallas que aparecen solo en un momento —selección, carteles, fase de
   compra— se esconden el resto del tiempo, y eso está bien: en OBS son
   fuentes fijas que nadie toca durante el partido.

   El problema es al revisarlas. Una página en negro no distingue entre «está
   escondida porque toca» y «está rota», y eso hace perder un rato largo cada
   vez.

   Así que con `&dev=1` en la URL la pantalla dice, en una esquina y en
   pequeño, por qué no se ve. **Sin ese parámetro no aparece nada**, para que
   la URL que va en OBS siga limpia: la que reparte el simulador lo lleva
   puesto, la que se copia a mano no.
*/

const activo = new URLSearchParams(location.search).get('dev') === '1';

let caja = null;

function creaCaja() {
  const nodo = document.createElement('div');
  nodo.style.cssText = [
    'position:fixed',
    'left:12px',
    'bottom:12px',
    'z-index:9999',
    'padding:7px 12px',
    'border-radius:7px',
    'background:rgb(10 10 14 / 88%)',
    'color:#e7e7ec',
    'font:12px/1.45 system-ui,sans-serif',
    'letter-spacing:.02em',
    'pointer-events:none',
    'max-width:46ch',
  ].join(';');
  document.body.append(nodo);
  return nodo;
}

/**
 * Dice por qué no se ve nada, o lo calla si ya se ve.
 *
 * @param {string} motivo Cadena vacía para quitarlo
 */
export function avisa(motivo) {
  if (!activo) return;
  if (caja === null) caja = creaCaja();
  caja.textContent = motivo;
  caja.style.display = motivo === '' ? 'none' : '';
}
