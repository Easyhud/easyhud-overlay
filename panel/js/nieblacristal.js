/* ══ "Aero Shards", portado a Canvas 2D puro (sin WebGL/ogl, sin dependencias) ══
   Esquirlas que flotan, brillan por turnos como si les pegara la luz, y se
   apartan del cursor. Solo corre detrás de la puerta de acceso: ahí no hay
   overlay ni GEP compitiendo por GPU, así que se puede permitir el lujo.
   Fleco de color en rojo de marca (--rec/--rec-claro) imitando aberracion
   cromatica sin shaders. */

const NUM_ESQUIRLAS = 46;
const RADIO_REPELE = 130;
const FUERZA_REPELE = 55;
const ROJO_CLARO = '255 100 110';
const ROJO_HONDO = '245 37 59';

let canvas = null;
let ctx = null;
let esquirlas = [];
let raton = { x: -9999, y: -9999 };
let activo = false;
let ultimo = 0;

function aleatorio(min, max) { return min + Math.random() * (max - min); }

function creaEsquirla(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    ox: 0, oy: 0, // desplazamiento elastico por repulsion
    vx: aleatorio(-18, 18),
    vy: aleatorio(-14, 14),
    tam: aleatorio(7, 20),
    rot: aleatorio(0, Math.PI * 2),
    rotVel: aleatorio(-0.6, 0.6),
    fase: aleatorio(0, Math.PI * 2),
    velGlint: aleatorio(0.5, 1.4),
    fleco: Math.random() > 0.45, // con o sin el desdoble de color
  };
}

function redimensiona() {
  if (!canvas) return;
  const r = canvas.parentElement.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return; // sigue oculto: no hay donde medir
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  canvas.style.width = `${r.width}px`;
  canvas.style.height = `${r.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (esquirlas.length === 0) {
    esquirlas = Array.from({ length: NUM_ESQUIRLAS }, () => creaEsquirla(r.width, r.height));
  }
}

function dibujaEsquirla(x, y, rot, tam, alpha, colorRgb) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(0, -tam, 0, tam);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.5, `rgb(${colorRgb})`);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -tam);
  ctx.lineTo(tam * 0.32, 0);
  ctx.lineTo(0, tam);
  ctx.lineTo(-tam * 0.32, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function dibuja(t) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 1 || h < 1) return;
  const dt = Math.min((t - (ultimo || t)) / 1000, 1 / 30);
  ultimo = t;

  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';

  for (const e of esquirlas) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.rot += e.rotVel * dt;
    if (e.x < -30) e.x = w + 30; else if (e.x > w + 30) e.x = -30;
    if (e.y < -30) e.y = h + 30; else if (e.y > h + 30) e.y = -30;

    /* Repele suave: empuja lejos del cursor, vuelve solo por friccion. */
    const dx = e.x - raton.x;
    const dy = e.y - raton.y;
    const d = Math.hypot(dx, dy);
    if (d < RADIO_REPELE && d > 0.01) {
      const f = (1 - d / RADIO_REPELE) * FUERZA_REPELE;
      e.ox += (dx / d) * f * dt;
      e.oy += (dy / d) * f * dt;
    }
    e.ox *= 0.9;
    e.oy *= 0.9;

    const glint = 0.16 + 0.55 * Math.max(0, Math.sin(t * 0.0012 * e.velGlint + e.fase));
    const px = e.x + e.ox;
    const py = e.y + e.oy;

    if (e.fleco) {
      /* Fleco de color: dos copias desplazadas 1.5px, ambas en rojo de marca,
         imitan el borde cromatico sin salirse de la paleta. */
      dibujaEsquirla(px - 1.5, py, e.rot, e.tam, glint, ROJO_CLARO);
      dibujaEsquirla(px + 1.5, py, e.rot, e.tam, glint * 0.8, ROJO_HONDO);
    } else {
      dibujaEsquirla(px, py, e.rot, e.tam, glint, '255 255 255');
    }
  }

  ctx.globalCompositeOperation = 'source-over';
}

function paso(t) {
  requestAnimationFrame(paso);
  if (!activo || !canvas) return;
  dibuja(t);
}

/** Se llama una vez al cargar. */
export function montaNieblaCristal() {
  canvas = document.getElementById('acceso-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', redimensiona);
  canvas.parentElement.addEventListener('mousemove', (ev) => {
    const r = canvas.getBoundingClientRect();
    raton.x = ev.clientX - r.left;
    raton.y = ev.clientY - r.top;
  });
  canvas.parentElement.addEventListener('mouseleave', () => { raton.x = -9999; raton.y = -9999; });
  requestAnimationFrame(paso);
}

/** Arranca/pausa el dibujado (para no gastar CPU mientras la puerta esta oculta). */
export function activaNieblaCristal(visible) {
  activo = visible;
  if (visible) redimensiona();
}
