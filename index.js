/* El director: qué pantalla se ve en cada momento.
   ================================================

   Esta es la única fuente que el operador pone en OBS. Dentro viven las
   siete pantallas y aquí se decide cuál se enseña, mirando lo mismo que
   miran ellas: el estado de la partida.

   ## La regla

   Manda lo más excepcional. De arriba abajo, la primera que aplique:

     victoria   la partida ha terminado
     selección  fase de selección de agentes
     pausa      hay un tiempo muerto
     aviso      el operador ha puesto un rótulo
     compra     fase de compra
     combate    lo demás, que es casi siempre

   La ceremonia de ronda no está en esa lista porque **no sustituye a nada**:
   sale encima del combate y se va sola. Por eso va en su propia capa, por
   delante y siempre montada.

   ## Dos decisiones que conviene no deshacer

   **Los marcos se montan una vez y no se quitan.** Desmontarlos rehace la
   conexión y relanza las animaciones de entrada cada vez que se cambia de
   pantalla, que es justo lo que no se quiere.

   **La barra superior la dibuja UNA sola pantalla.** Combate la lleva
   siempre; en las demás se apaga con `&barra=0`, o se verían dos barras
   solapadas cuando coinciden.
*/

import { abreFuente, GRUPO } from './comun/fuente.js';

const params = new URLSearchParams(location.search);
/* La sala es el código de grupo de ValoSpectra; se acepta `?room=` por
   compatibilidad con direcciones de OBS viejas (lo resuelve `comun/fuente.js`). */
const grupo = GRUPO;
const endpoint = params.get('endpoint');
const dev = params.get('dev') === '1';

/** Cada pantalla, con lo que hay que pedirle. */
const PANTALLAS = {
  combate: { ruta: 'combate/index.html', barra: true },
  compra: { ruta: 'compra/index.html', barra: false },
  seleccion: { ruta: 'seleccion/index.html', barra: false },
  pausa: { ruta: 'carteles/pausa.html', barra: false },
  aviso: { ruta: 'carteles/avisos.html', barra: false },
  victoria: { ruta: 'victoria/index.html', barra: false },
};

/** La ceremonia va aparte: se superpone, no sustituye. */
const ENCIMA = { ruta: 'carteles/ceremonia.html', barra: false };

const marcos = new Map();

function monta(nombre, pantalla) {
  const marco = document.createElement('iframe');
  marco.className = 'capa';
  marco.setAttribute('allowtransparency', 'true');

  const extra = new URLSearchParams({ groupCode: grupo });
  if (endpoint !== null) extra.set('endpoint', endpoint);
  /* El token de la puerta del servidor: si esta dirección lo trae (overlay
     servido por web con la reja encendida), cada pantalla lo necesita para su
     propio `logon`. En modo local va vacío y no cambia nada: el relé del exe
     pone el token de memoria e ignora el de la URL. */
  const token = params.get('token');
  if (token !== null && token !== '') extra.set('token', token);
  if (!pantalla.barra) extra.set('barra', '0');
  if (dev) extra.set('dev', '1');
  // La palabra de la victoria se hereda, si se puso en esta dirección.
  const palabra = params.get('palabra');
  if (palabra !== null && nombre === 'victoria') extra.set('palabra', palabra);

  marco.src = `./${pantalla.ruta}?${extra.toString()}`;
  document.body.append(marco);
  marcos.set(nombre, marco);
  return marco;
}

function enseña(nombre) {
  for (const [otro, marco] of marcos) {
    if (otro === 'ceremonia') continue;
    marco.classList.toggle('capa--puesta', otro === nombre);
  }
  const marco = marcos.get(nombre) ?? monta(nombre, PANTALLAS[nombre]);
  marco.classList.add('capa--puesta');
}

/* La ceremonia se monta desde el principio y se queda visible siempre: ella
   misma se esconde cuando no hay nada que anunciar. */
function montaCeremonia() {
  const marco = monta('ceremonia', ENCIMA);
  marco.classList.add('capa--puesta');
  marco.style.pointerEvents = 'none';
}

/* ── Qué toca ────────────────────────────────────────────────────────────── */

function decide(match) {
  if (match.phase === 'gameOver') return 'victoria';
  if (match.phase === 'agentSelect') return 'seleccion';
  if (match.timeout !== null && match.timeout !== undefined) return 'pausa';
  if (match.broadcast?.toast?.visible === true) return 'aviso';
  if (match.phase === 'shopping') return 'compra';
  return 'combate';
}

function avisa(texto) {
  if (!dev) return;
  const caja = document.getElementById('dev');
  caja.textContent = texto;
  caja.style.display = texto === '' ? 'none' : '';
}

/* ── Conexión ────────────────────────────────────────────────────────────── */

/*
 * El director también lee de la fuente de ValoSpectra (ver `comun/fuente.js`),
 * pero solo para decidir qué pantalla toca: mira la fase y el tiempo muerto,
 * igual que antes. Los datos de cada pantalla los pide su propio iframe.
 */
let actual = '';

/*
 * El combate se monta ya, antes de saber nada.
 *
 * Es la pantalla que está el 90 % del tiempo, y montarla al recibir el
 * primer estado la haría entrar con su animación en mitad de la partida.
 */
enseña('combate');
montaCeremonia();
avisa(grupo === '' ? 'Falta el código de grupo en la dirección.' : 'Conectando…');

abreFuente({
  onMatch: (match) => {
    const toca = decide(match);
    avisa(`grupo ${match.roomCode} · ${match.phase} · enseñando ${toca}`);
    if (toca === actual) return;
    actual = toca;
    enseña(toca);
  },
});

/*
 * Módulo, aunque no importe nada: sin un `import` o un `export`, sus
 * variables de nivel superior chocarían con las de las pantallas.
 */
export {};
