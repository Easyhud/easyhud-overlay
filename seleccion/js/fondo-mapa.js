/* FONDO DE MAPA — vídeos de cámara por el mapa, detrás de la selección de agentes.

   Por ahora sólo Ascent. Cada clip dura 3-5 s; al terminar uno se pone otro AL AZAR (nunca el mismo dos veces
   seguidas). El vídeo está bajo el escenario (z-index -1) y sólo se ve mientras el mapa es Ascent y la
   pantalla de selección está en marcha; si el mapa es otro, o no hay vídeos, el fondo sigue transparente.

   Los clips son de DEFYED (uso personal con crédito; para uso comercial hay que pedirle permiso:
   defyed@defyedgaming.com). Ver `assets/fondos/CREDITOS.md`. */

const MAPAS = {
  ascent: { carpeta: './assets/fondos/ascent/', clips: 31 },
};

let video = null;
let mapaActual = '';
let ultimo = -1;

/* Velocidad de reproducción: 1 = normal. Los clips YA vienen ralentizados x2 e interpolados a 60 fps (así no se ven trabados). */
const VELOCIDAD = 1;

function clave(nombreMapa) {
  const m = String(nombreMapa ?? '').toLowerCase();
  return Object.keys(MAPAS).find((k) => m.includes(k)) ?? '';
}

function siguiente(def) {
  let n;
  do n = 1 + Math.floor(Math.random() * def.clips);
  while (def.clips > 1 && n === ultimo);
  ultimo = n;
  return def.carpeta + String(n).padStart(2, '0') + '.mp4';
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

function reproduce(def) {
  video.src = siguiente(def);
  video.defaultPlaybackRate = VELOCIDAD;
  video.playbackRate = VELOCIDAD;
  video.play().catch(() => {});
}

/** Se le dice el mapa y si la pantalla está visible; pone, cambia o quita el fondo. */
export function ponFondoMapa(nombreMapa, visible) {
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
  const def = MAPAS[k];
  video ??= crea();
  video.onended = () => reproduce(def);
  video.onerror = () => setTimeout(() => mapaActual === k && reproduce(def), 1000);
  video.onplaying = () => video.classList.add('fondo-mapa--ve');
  reproduce(def);
}
