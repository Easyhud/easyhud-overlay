/* ══ LOS ATAJOS ═════════════════════════════════════════════════════════════
   Teclas globales para llevar la emisión desde el PC del observador.

   Son LOCALES del programa, no del panel: siguen funcionando aunque el panel
   pierda la conexión con el servidor, que es justo cuando más falta hacen. El
   panel solo las edita; quien las registra de verdad es el proceso principal.

   Portado de `hotkeys.component.ts` (Angular + PrimeNG). Se conservan los
   valores por defecto, la validación y las dos migraciones; lo que se cae es
   el popover de PrimeNG, sustituido por un rótulo de «pulsa una tecla».

   ## Por qué llegan apagadas

   Las seis vienen con tecla asignada pero DESHABILITADAS. Un atajo global se
   come la tecla para todo el sistema, incluido el juego: encenderlas sin que
   nadie lo pida es robarle F1 a quien lo tenía puesto para otra cosa.        */

const LLAVE = 'hotkeys';

/** Los seis mandos, en el orden en que se enseñan. */
const MANDOS = [
  { id: 'spikePlanted', nombre: 'Spike plantada', nota: 'Fuerza el contador de la spike.' },
  { id: 'techPause', nombre: 'Pausa técnica', nota: 'Saca la pantalla de pausa.' },
  { id: 'leftTimeout', nombre: 'Tiempo muerto · izquierda', nota: 'Gasta uno del cupo.' },
  { id: 'rightTimeout', nombre: 'Tiempo muerto · derecha', nota: 'Gasta uno del cupo.' },
  { id: 'switchKdaCredits', nombre: 'KDA / Creditos', nota: 'Cambia lo que muestra el marcador.' },
  { id: 'showToast', nombre: 'Rotulo', nota: 'Enseña el rotulo que haya escrito.' },
];

/** Por defecto: F1–F6 y todas apagadas. */
function porDefecto() {
  return {
    spikePlanted: 'F1',
    techPause: 'F2',
    leftTimeout: 'F3',
    rightTimeout: 'F4',
    switchKdaCredits: 'F5',
    showToast: 'F6',
    enabled: {
      spikePlanted: false,
      techPause: false,
      leftTimeout: false,
      rightTimeout: false,
      switchKdaCredits: false,
      showToast: false,
    },
  };
}

/**
 * Una tecla vale si es una tecla suelta, con o sin modificadores.
 *
 * La misma expresión que usaba el componente de Angular, para no cambiar por
 * accidente qué se acepta: un cambio silencioso aquí deja a alguien con un
 * atajo que el proceso principal luego rechaza.
 */
const VALIDA = /^(Ctrl\+|Alt\+|Shift\+)*(\D|F[1-9][0-1]?|\d)$/;

let datos = porDefecto();
/** Qué mando está esperando una tecla, o null. */
let capturando = null;

/** Lee lo guardado y aplica las migraciones. */
export function cargaAtajos() {
  let guardado = null;
  try {
    const crudo = localStorage.getItem(LLAVE);
    if (crudo !== null) guardado = JSON.parse(crudo);
  } catch {
    /* Ilegible: se queda con los de fábrica. */
  }

  datos = guardado !== null && typeof guardado === 'object' ? guardado : porDefecto();

  /* Un guardado viejo puede no traer `enabled`. */
  if (typeof datos.enabled !== 'object' || datos.enabled === null) {
    datos.enabled = porDefecto().enabled;
  }

  /* Migraciones: los dos mandos que se añadieron después no existen en los
     guardados antiguos. Se les pone su tecla y se dejan APAGADOS, que es lo
     que haría un usuario que nunca los pidió. */
  if (!datos.switchKdaCredits) {
    datos.switchKdaCredits = 'F5';
    datos.enabled.switchKdaCredits = false;
  }
  if (!datos.showToast) {
    datos.showToast = 'F6';
    datos.enabled.showToast = false;
  }

  return datos;
}

/** Lo que hay ahora en memoria. */
export const atajos = () => datos;

/** Guarda y devuelve lo guardado. */
export function guardaAtajos() {
  try {
    localStorage.setItem(LLAVE, JSON.stringify(datos));
  } catch {
    /* Sin almacenamiento duran lo que dure la ventana. */
  }
  return datos;
}

/** ¿Está todo en orden? Solo se valida lo que está encendido. */
export function atajosValidos() {
  return MANDOS.every(({ id }) => !datos.enabled[id] || VALIDA.test(datos[id] ?? ''));
}

/**
 * Los mandos encendidos que comparten tecla.
 *
 * Dos atajos con la misma tecla no dan error al registrarse: gana uno y el
 * otro no responde nunca, que desde fuera parece que el programa está roto.
 * Mejor decirlo antes de guardar.
 */
export function atajosDuplicados() {
  const vistos = new Map();
  const choques = new Set();
  for (const { id } of MANDOS) {
    if (!datos.enabled[id]) continue;
    const tecla = (datos[id] ?? '').toUpperCase();
    if (tecla === '') continue;
    if (vistos.has(tecla)) {
      choques.add(id);
      choques.add(vistos.get(tecla));
    } else {
      vistos.set(tecla, id);
    }
  }
  return [...choques];
}

const $ = (id) => document.getElementById(id);

/** Dibuja la lista completa. */
function pinta() {
  const caja = $('at-lista');
  if (caja === null) return;

  const duplicados = new Set(atajosDuplicados());
  caja.innerHTML = '';

  for (const { id, nombre, nota } of MANDOS) {
    const encendido = datos.enabled[id] === true;
    const tecla = datos[id] ?? '';
    const mal = encendido && !VALIDA.test(tecla);
    const choca = duplicados.has(id);

    const fila = document.createElement('div');
    fila.className = 'atajo';
    fila.dataset.mal = mal || choca ? 'si' : 'no';
    fila.innerHTML =
      '<label class="atajo__on">' +
      `<input type="checkbox" data-enc="${id}"${encendido ? ' checked' : ''} />` +
      '</label>' +
      '<span class="atajo__texto">' +
      `<span class="atajo__nombre">${nombre}</span>` +
      `<span class="atajo__nota">${choca ? 'Esa tecla ya la usa otro mando.' : mal ? 'Esa tecla no vale.' : nota}</span>` +
      '</span>' +
      `<button class="boton boton--terciario atajo__tecla" type="button" data-cap="${id}"${encendido ? '' : ' disabled'}>` +
      `${capturando === id ? 'Pulsa una tecla…' : tecla || '—'}` +
      '</button>';
    caja.appendChild(fila);
  }

  const aviso = $('at-aviso');
  if (aviso !== null) {
    const problema = !atajosValidos() || duplicados.size > 0;
    aviso.hidden = !problema;
    aviso.textContent = problema
      ? 'Revisa los mandos marcados antes de guardar.'
      : '';
  }
  const guardar = $('at-guardar');
  if (guardar !== null) guardar.disabled = !atajosValidos() || duplicados.size > 0;
}

/** Empieza a esperar una tecla para un mando. */
function captura(id) {
  capturando = id;
  pinta();
}

function paraCaptura() {
  capturando = null;
  pinta();
}

/**
 * Traduce un evento de teclado a la cadena que entiende el proceso principal.
 *
 * Los modificadores se escriben delante y siempre en el mismo orden, porque la
 * cadena se compara tal cual contra la expresión de validación.
 */
function teclaDe(ev) {
  let s = '';
  if (ev.ctrlKey) s += 'Ctrl+';
  if (ev.altKey) s += 'Alt+';
  if (ev.shiftKey) s += 'Shift+';
  /* El modificador suelto no es una tecla: se espera a que pulse otra. */
  if (ev.key !== 'Shift' && ev.key !== 'Alt' && ev.key !== 'Control') {
    s += ev.key.toUpperCase();
  }
  return s;
}

function alPulsar(ev) {
  if (capturando === null) return;
  if (ev.key === 'Escape') return paraCaptura();

  ev.preventDefault();
  ev.stopPropagation();

  const tecla = teclaDe(ev);
  /* Solo un modificador todavía: se sigue esperando. */
  if (tecla.endsWith('+')) return pinta();

  datos[capturando] = tecla;
  paraCaptura();
}

/** Monta los manejadores. Se llama una vez, al cargar. */
export function montaAtajos() {
  cargaAtajos();

  $('at-lista')?.addEventListener('click', (ev) => {
    const boton = ev.target.closest('[data-cap]');
    if (boton !== null) return captura(boton.dataset.cap);
  });

  $('at-lista')?.addEventListener('change', (ev) => {
    const caja = ev.target.closest('[data-enc]');
    if (caja === null) return;
    const id = caja.dataset.enc;
    datos.enabled[id] = caja.checked;
    /* Al apagar un mando deja de estorbar aunque su tecla fuera inválida. */
    if (!caja.checked && capturando === id) capturando = null;
    pinta();
  });

  window.addEventListener('keydown', alPulsar, true);

  pinta();
}

/** Enseña u oculta el diálogo. */
export function muestraAtajos(visible) {
  const caja = $('atajos');
  if (caja === null) return;
  capturando = null;
  caja.hidden = !visible;
  if (visible) {
    cargaAtajos();
    pinta();
  }
}
