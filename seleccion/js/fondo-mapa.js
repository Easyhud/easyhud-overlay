/* FONDO DE MAPA — vídeos de cámara por el mapa, detrás de la selección de agentes.

   Cada mapa tiene su carpeta de clips en `assets/fondos/<mapa>/NN.mp4` y el listado de cuántos clips hay de cada mapa
   está en `assets/fondos/fondos.json` (lo escribe `tools/prepara-fondos.mjs` al preparar un mapa; no se edita a mano).
   Cada clip dura unos segundos; al terminar uno se pone otro AL AZAR (nunca el mismo dos veces seguidas). El vídeo
   está bajo el escenario (z-index -1) y sólo se ve mientras la pantalla de selección está en marcha y el mapa tiene
   clips; si el mapa no tiene o no hay vídeos, el fondo sigue transparente (no pasa nada, no hay error).

   Los clips son de sus autores (p. ej. DEFYED: uso personal con crédito; para uso comercial hay que pedirles permiso).
   Ver `assets/fondos/CREDITOS.md`. */

const BASE = './assets/fondos/';

/** { ascent: 31, … } — se carga una vez. Si no se puede leer, no hay fondos. */
let listado = null;
let cargando = null;

function cargaListado() {
  if (listado !== null) return Promise.resolve(listado);
  cargando ??= fetch(BASE + 'fondos.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .catch(() => ({}))
    .then((j) => {
      listado = j && typeof j === 'object' ? j : {};
      return listado;
    });
  return cargando;
}

let video = null;
let mapaActual = '';
let ultimo = -1;
let fallos = 0;

/* Velocidad de reproducción: 1 = normal. Los clips YA vienen ralentizados x2 e interpolados a 60 fps (así no se ven trabados). */
const VELOCIDAD = 1;

/** La clave de carpeta de un nombre de mapa («Ascent», «ascent», «Ascent (Custom)»…), o '' si no hay clips de él. */
function clave(nombreMapa) {
  const m = String(nombreMapa ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (listado === null) return '';
  return Object.keys(listado).find((k) => Number(listado[k]) > 0 && m.includes(k)) ?? '';
}

function siguiente(k) {
  const n = Number(listado[k]);
  let c;
  do c = 1 + Math.floor(Math.random() * n);
  while (n > 1 && c === ultimo);
  ultimo = c;
  return `${BASE}${k}/${String(c).padStart(2, '0')}.mp4`;
}

function crea() {
  const v = document.createElement('video');
  v.className = 'fondo-mapa';
  v.muted = true;
  v.autoplay = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.setAttribute('aria-hidden', 'true');
  document.body.prepend(v);
  return v;
}

function reproduce(k) {
  video.src = siguiente(k);
  video.defaultPlaybackRate = VELOCIDAD;
  video.playbackRate = VELOCIDAD;
  video.play().catch(() => {});
}

/** Se le dice el mapa y si la pantalla está visible; pone, cambia o quita el fondo. */
export function ponFondoMapa(nombreMapa, visible) {
  if (listado === null) {
    // Primera vez: se carga el listado y se vuelve a intentar con lo último que se pidió.
    void cargaListado().then(() => ponFondoMapa(nombreMapa, visible));
    return;
  }
  const k = visible ? clave(nombreMapa) : '';
  if (k === mapaActual) return;
  mapaActual = k;
  if (k === '') {
    if (video) {
      video.classList.remove('fondo-mapa--ve');
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    return;
  }
  video ??= crea();
  video.onended = () => reproduce(k);
  video.onerror = () => {
    // Si el clip no existe o está roto se prueba con otro, pero sin insistir para siempre (tras 4 fallos seguidos se rinde).
    if (++fallos > 4) return;
    setTimeout(() => mapaActual === k && reproduce(k), 1000);
  };
  video.onplaying = () => {
    fallos = 0;
    video.classList.add('fondo-mapa--ve');
  };
  reproduce(k);
}
