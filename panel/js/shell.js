/* ══ EL SHELL ═══════════════════════════════════════════════════════════════
   El punto de entrada del programa. Reemplaza a `app.component` de Angular.

   Antes esto era una aplicación de Angular que montaba el panel en un iframe
   y, al lado, un componente de observador de 1124 líneas metido en un
   `<div hidden>` para que su ciclo de vida enganchara el juego. Dos clientes
   del servidor dentro de una misma ventana, con el estado reconciliándose
   dando la vuelta por el VPS. De ahí venía la inestabilidad.

   Ahora el panel ES el documento, y esto es lo único que lo envuelve:

     · la barra de título (la ventana va sin marco nativo)
     · la puerta: sin permiso de emisión vigente, solo se ve el acceso
     · el diálogo de atajos
     · encender y apagar, siguiendo a la sesión, el servidor local del overlay
       y el lector de sala

   Lo que NO está aquí, y es el cambio de fondo: la lógica del observador. Vive
   en el proceso principal, con `gepService` y `connectorService`, que es donde
   siempre debió estar. Este fichero no habla con el juego.                   */

import { arranca, apaga } from './panel.js';
import { montaAcceso, muestraAcceso } from './acceso.js';
import { montaAtajos, muestraAtajos, cargaAtajos, guardaAtajos, atajos } from './atajos.js';
import {
  alCambiar,
  entrado,
  limpiaSiCaducada,
  codigoGrupo,
  tokenEmision,
  cuenta,
  sal,
  ENDPOINT_DATOS,
} from './sesion.js';

const $ = (id) => document.getElementById(id);
const api = () => window.electronAPI;

/** El perfil de build dice si este exe es el observador o el del jugador. */
function perfil() {
  try {
    return api()?.getBuildProfile?.() ?? { mode: 'normal' };
  } catch {
    return { mode: 'normal' };
  }
}

const ES_OBSERVADOR = perfil().mode === 'observer';

/** Dónde apuntar OBS. La monta el proceso principal, que sabe el puerto. */
function urlObs() {
  try {
    return api()?.getObsUrl?.() ?? 'http://localhost:5310/';
  } catch {
    return 'http://localhost:5310/';
  }
}

/* ── La barra de título ──────────────────────────────────────────────────── */

function montaBarra() {
  $('bt-minimizar')?.addEventListener('click', () => api()?.ventanaMinimizar?.());
  $('bt-maximizar')?.addEventListener('click', () => api()?.ventanaMaximizar?.());
  $('bt-cerrar')?.addEventListener('click', () => api()?.ventanaCerrar?.());

  $('bt-atajos')?.addEventListener('click', () => muestraAtajos(true));
  $('at-cerrar')?.addEventListener('click', () => muestraAtajos(false));
  $('at-guardar')?.addEventListener('click', () => {
    const datos = guardaAtajos();
    /* El registro real lo hace el proceso principal: un atajo global no lo
       puede poner una página. Se aplican en caliente, sin reiniciar. */
    api()?.aplicaAtajos?.(datos);
    muestraAtajos(false);
  });

  /* Cerrar sesión ya tiene sentido aquí: el shell es quien tiene la sesión.
     Antes este botón navegaba a `/salir` y, dentro del exe, dejaba el panel en
     blanco sin vuelta atrás. */
  $('a-salir')?.addEventListener('click', () => sal());
}

/** El rótulo de la barra: para quién es la sesión y cuánto le queda. */
function pintaSesion() {
  const el = $('a-sesion');
  if (el === null) return;
  const c = cuenta();
  if (c === null) {
    el.textContent = '—';
    return;
  }
  const horas = Math.max(0, Math.round((c.caduca.getTime() - Date.now()) / 3600000));
  el.textContent = `${c.cliente} · el permiso de emisión caduca en ${horas} h`;
}

/* ── La puerta ───────────────────────────────────────────────────────────── */

/** Lo que estaba encendido, para no encender dos veces ni apagar de más. */
let encendido = false;

/**
 * Sigue a la sesión.
 *
 * Con permiso de emisión vigente: se levanta el servidor local del overlay con
 * el token en memoria del proceso principal, se arranca el lector de sala y el
 * panel se conecta. Sin permiso: se apaga todo y se enseña el acceso.
 */
function sigueSesion() {
  const dentro = entrado();

  muestraAcceso(!dentro);
  pintaSesion();

  if (dentro && !encendido) {
    encendido = true;
    /* El token va al proceso principal y se queda ahí: no vuelve al navegador
       ni aparece en ninguna URL. */
    api()?.arrancaOverlayLocal?.(tokenEmision(), codigoGrupo());
    api()?.arrancaLectorSala?.();
    /* Los atajos se registran al entrar, no al abrir el diálogo: si el
       operador nunca lo abre, igual quiere sus teclas. */
    api()?.aplicaAtajos?.(cargaAtajos());
    /* Y se engancha el juego. Ya no hay botón de «Connect» ni formulario que
       rellenar: tener permiso de emisión vigente ES la orden de conectar. Todo
       lo demás lo gobierna el panel en vivo. */
    api()?.conecta?.(tokenEmision(), codigoGrupo());
    arranca({
      endpoint: ENDPOINT_DATOS,
      grupo: codigoGrupo(),
      token: tokenEmision(),
      obs: urlObs(),
    });
    return;
  }

  if (!dentro && encendido) {
    encendido = false;
    apaga();
    api()?.paraLectorSala?.();
    api()?.paraOverlayLocal?.();
    muestraAtajos(false);
  }
}

/**
 * Vigila la caducidad.
 *
 * El permiso dura pocas horas. Sin esto, un exe abierto toda la noche seguiría
 * pareciendo conectado con un permiso muerto, y el fallo saldría al conectar,
 * que es cuando estorba. Un minuto de resolución sobra para algo que dura
 * horas.
 */
function vigilaCaducidad() {
  setInterval(() => {
    if (encendido && !entrado()) sigueSesion();
  }, 60000);
}

/* ── Arranque ────────────────────────────────────────────────────────────── */

function inicia() {
  /* El exe del jugador no tiene panel ni cuenta: solo reporta por GEP. Si por
     lo que sea se abriera este documento ahí, no se enseña la puerta. */
  if (!ES_OBSERVADOR) {
    muestraAcceso(false);
    return;
  }

  /* Una sesión ya caducada se tira antes de pintar nada. */
  limpiaSiCaducada();

  montaBarra();
  montaAcceso();
  montaAtajos();

  alCambiar(sigueSesion);
  sigueSesion();
  vigilaCaducidad();

  /* El reloj del rótulo de sesión, para que la cuenta atrás no se quede vieja. */
  setInterval(pintaSesion, 60000);
}

inicia();
