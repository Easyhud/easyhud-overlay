/* EL INTÉRPRETE.
   =============

   Recorre una lista de números y hace llamadas a un contexto 2D. Eso es todo
   lo que hace y todo lo que sabe.

   No hay aquí una función que pinte una tarjeta, ni una que sepa qué es una
   insignia de definitiva, ni un nombre que diga qué representa ninguno de los
   números que van pasando. La composición —dónde va cada cosa, de qué color,
   qué se anima y durante cuántos milisegundos— está entera dentro del wasm, y
   lo que cruza hasta aquí son veintiuna operaciones de dibujo. Quien abra las
   herramientas del navegador encuentra un lienzo, un módulo binario y este
   bucle.

   Cada operación lee un número fijo de ranuras y en un orden fijo: las
   posiciones y los tamaños como coma flotante, los identificadores y los
   colores como entero. Las dos vistas miran la misma memoria, así que leer una
   ranura "como entero" no convierte nada, solo la interpreta. */

const FIN = 0, GUARDAR = 1, RESTAURAR = 2, ALFA = 3, TRASLADA = 4, ESCALA = 5,
  RECORTE_RR = 6, RECORTE_POLI = 7, RECT = 8, RECT_GRAD = 9, POLI = 10,
  IMAGEN = 11, RETRATO = 12, TEXTO = 13, TRAZO_RR = 14, BRILLO_INT = 15,
  RADIAL = 16, ANILLO = 17, RUTA = 18, SOMBRA = 19, ROTA = 20;

const ALINEA = ["left", "center", "right"];

const cacheColor = new Map();

function color(v) {
  let s = cacheColor.get(v);
  if (s === undefined) {
    const a = ((v >>> 24) & 255) / 255;
    s = "rgba(" + ((v >>> 16) & 255) + "," + ((v >>> 8) & 255) + "," + (v & 255) + "," + a + ")";
    cacheColor.set(v, s);
  }
  return s;
}

/*
 * Encaja una caja en la rejilla de píxeles, como hace el navegador.
 *
 * El motor redondea los bordes de toda caja de elemento antes de pintarla —el
 * fondo, la imagen, la sombra—, y NO redondea el texto, que va en subpíxeles.
 * Sin esto, una fila que cae en un medio píxel sale con los dos bordes
 * difuminados en el lienzo y con los bordes limpios en el DOM: es exactamente
 * lo que pasaba con las barras de vida y con la silueta del escudo, que
 * quedaban un píxel más altas y desplazadas.
 *
 * La regla es la del motor: se redondean las dos esquinas, no la posición y el
 * tamaño por separado, para que dos cajas pegadas sigan pegadas.
 */
const R4 = [0, 0, 0, 0];

/* A cuántos píxeles de salida equivale un píxel del diseño. La rejilla es la
   de VERDAD, no la del diseño: a doble resolución hay el doble de sitios donde
   encajar, y redondear a los del diseño tiraría media nitidez. */
let rejilla = 1;

function encaja(x, y, w, h) {
  const x0 = Math.round(x * rejilla) / rejilla;
  const y0 = Math.round(y * rejilla) / rejilla;
  R4[0] = x0;
  R4[1] = y0;
  R4[2] = Math.round((x + w) * rejilla) / rejilla - x0;
  R4[3] = Math.round((y + h) * rejilla) / rejilla - y0;
  return R4;
}

function caminoRR(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (r > 0) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  else ctx.rect(x, y, w, h);
}

/** El color de una lista de paradas en un punto, para cortar un degradado. */
function enParada(paradas, colores, u) {
  const n = paradas.length;
  if (u <= paradas[0]) return colores[0];
  if (u >= paradas[n - 1]) return colores[n - 1];
  for (let k = 1; k < n; k++) {
    if (u > paradas[k]) continue;
    const t = (u - paradas[k - 1]) / (paradas[k] - paradas[k - 1] || 1);
    const a = colores[k - 1], b = colores[k];
    const mezcla = (d) => Math.round(((a >>> d) & 255) + (((b >>> d) & 255) - ((a >>> d) & 255)) * t);
    return (mezcla(24) << 24) | (mezcla(16) << 16) | (mezcla(8) << 8) | mezcla(0);
  }
  return colores[n - 1];
}

/** Un lienzo de usar y tirar, que se reaprovecha entre llamadas. */
let apunte = null;
function scratch(w, h) {
  if (apunte === null) apunte = document.createElement("canvas");
  if (apunte.width < w || apunte.height < h) {
    apunte.width = Math.max(w, apunte.width);
    apunte.height = Math.max(h, apunte.height);
  }
  const c = apunte.getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;
  c.filter = "none";
  c.imageSmoothingQuality = "high";
  c.clearRect(0, 0, apunte.width, apunte.height);
  return c;
}

export function ejecuta(ctx, F, I, n, R, escala = 1) {
  rejilla = escala;
  let p = 0;
  const paradas = [];
  const colores = [];

  while (p < n) {
    const op = I[p++];
    if (op === FIN) break;

    switch (op) {
      case GUARDAR:
        ctx.save();
        break;

      case RESTAURAR:
        ctx.restore();
        break;

      case ALFA:
        ctx.globalAlpha *= F[p++];
        break;

      case TRASLADA:
        ctx.translate(F[p], F[p + 1]); p += 2;
        break;

      case ESCALA:
        ctx.scale(F[p], F[p + 1]); p += 2;
        break;

      case ROTA:
        ctx.rotate(F[p++]);
        break;

      case SOMBRA: {
        ctx.shadowOffsetX = F[p];
        ctx.shadowOffsetY = F[p + 1];
        ctx.shadowBlur = F[p + 2];
        ctx.shadowColor = color(I[p + 3]);
        p += 4;
        break;
      }

      case RECORTE_RR: {
        const c = encaja(F[p], F[p + 1], F[p + 2], F[p + 3]);
        caminoRR(ctx, c[0], c[1], c[2], c[3], F[p + 4]);
        p += 5;
        ctx.clip();
        break;
      }

      case RECORTE_POLI: {
        const c = I[p++];
        ctx.beginPath();
        for (let k = 0; k < c; k++) {
          const x = F[p + k * 2], y = F[p + k * 2 + 1];
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        p += c * 2;
        ctx.closePath();
        ctx.clip();
        break;
      }

      case RECT: {
        const c = encaja(F[p], F[p + 1], F[p + 2], F[p + 3]);
        const x = c[0], y = c[1], w = c[2], h = c[3], r = F[p + 4];
        ctx.fillStyle = color(I[p + 5]);
        p += 6;
        if (r > 0) { caminoRR(ctx, x, y, w, h, r); ctx.fill(); }
        else ctx.fillRect(x, y, w, h);
        break;
      }

      case RECT_GRAD: {
        const cg = encaja(F[p], F[p + 1], F[p + 2], F[p + 3]);
        const x = cg[0], y = cg[1], w = cg[2], h = cg[3], r = F[p + 4];
        const g = ctx.createLinearGradient(F[p + 5], F[p + 6], F[p + 7], F[p + 8]);
        const c = I[p + 9];
        p += 10;
        for (let k = 0; k < c; k++) { g.addColorStop(Math.min(1, Math.max(0, F[p])), color(I[p + 1])); p += 2; }
        ctx.fillStyle = g;
        if (r > 0) { caminoRR(ctx, x, y, w, h, r); ctx.fill(); }
        else ctx.fillRect(x, y, w, h);
        break;
      }

      case POLI: {
        const c = I[p++];
        ctx.beginPath();
        for (let k = 0; k < c; k++) {
          const x = F[p + k * 2], y = F[p + k * 2 + 1];
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        p += c * 2;
        ctx.closePath();
        ctx.fillStyle = color(I[p++]);
        ctx.fill();
        break;
      }

      case IMAGEN: {
        const id = I[p];
        const ce = encaja(F[p + 1], F[p + 2], F[p + 3], F[p + 4]);
        const x = ce[0], y = ce[1], w = ce[2], h = ce[3];
        const a = F[p + 5], tinte = I[p + 6], banderas = I[p + 7];
        p += 8;
        if (!R.lista(id)) break;
        const src = tinte === 0 ? R.fuente(id) : R.tenida(id, tinte);
        if (src === null) break;

        let dx = x, dy = y, dw = w, dh = h;
        if (banderas & 2) {
          const sw = src.naturalWidth || src.width;
          const sh = src.naturalHeight || src.height;
          const k = Math.min(w / sw, h / sh);
          dw = sw * k; dh = sh * k;
          dx = x + (w - dw) / 2; dy = y + (h - dh) / 2;
        }

        const previo = ctx.globalAlpha;
        ctx.globalAlpha = previo * a;
        if (banderas & 1) {
          /* Espejo alrededor del centro de la caja, no del origen. */
          const eje = x + w / 2;
          ctx.save();
          ctx.translate(eje, 0);
          ctx.scale(-1, 1);
          ctx.translate(-eje, 0);
          ctx.drawImage(src, dx, dy, dw, dh);
          ctx.restore();
        } else {
          ctx.drawImage(src, dx, dy, dw, dh);
        }
        ctx.globalAlpha = previo;
        break;
      }

      case RETRATO: {
        const id = I[p];
        const cr = encaja(F[p + 1], F[p + 2], F[p + 3], F[p + 4]);
        const x = cr[0], y = cr[1], w = cr[2], h = cr[3];
        const a = F[p + 5], grisor = F[p + 6];
        const t0 = F[p + 7], a0 = F[p + 8], t1 = F[p + 9], a1 = F[p + 10];
        p += 11;
        if (!R.lista(id)) break;
        const img = R.fuente(id);

        /* El apunte va a resolución de SALIDA: si se montara a la del diseño,
           el retrato sería lo único borroso de la pantalla a 4K. */
        const pw = Math.ceil(w * rejilla);
        const ph = Math.ceil(h * rejilla);
        const c = scratch(pw, ph);
        const sw = img.naturalWidth || img.width;
        const sh = img.naturalHeight || img.height;
        const k = Math.max(pw / sw, ph / sh);
        const dw = sw * k, dh = sh * k;
        if (grisor > 0) c.filter = "grayscale(" + grisor + ")";
        c.drawImage(img, (pw - dw) / 2, 0, dw, dh);
        c.filter = "none";

        const g = c.createLinearGradient(0, t0 * ph, 0, t1 * ph);
        g.addColorStop(0, "rgba(0,0,0," + a0 + ")");
        g.addColorStop(1, "rgba(0,0,0," + a1 + ")");
        c.globalCompositeOperation = "destination-in";
        c.fillStyle = g;
        c.fillRect(0, 0, pw, ph);

        const previo = ctx.globalAlpha;
        ctx.globalAlpha = previo * a;
        ctx.drawImage(apunte, 0, 0, pw, ph, x, y, w, h);
        ctx.globalAlpha = previo;
        break;
      }

      case TEXTO: {
        const id = I[p], fuente = I[p + 1], x = F[p + 2], y = F[p + 3];
        const col = I[p + 4], align = I[p + 5];
        p += 6;
        if (id < 0) break;
        R.aplica(ctx, fuente);
        ctx.textAlign = ALINEA[align];
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = color(col);
        ctx.fillText(R.cadena(id, fuente), x, y);
        break;
      }

      case TRAZO_RR: {
        const c = encaja(F[p], F[p + 1], F[p + 2], F[p + 3]);
        const x = c[0], y = c[1], w = c[2], h = c[3], r = F[p + 4];
        const g = F[p + 5];
        ctx.strokeStyle = color(I[p + 6]);
        p += 7;
        /* El trazo va POR DENTRO del borde, como un `box-shadow: inset`. */
        caminoRR(ctx, x + g / 2, y + g / 2, w - g, h - g, Math.max(0, r - g / 2));
        ctx.lineWidth = g;
        ctx.stroke();
        break;
      }

      case BRILLO_INT: {
        const c = encaja(F[p], F[p + 1], F[p + 2], F[p + 3]);
        const x = c[0], y = c[1], w = c[2], h = c[3], r = F[p + 4];
        const radio = F[p + 5];
        const col = color(I[p + 6]);
        p += 7;
        /* Un resplandor hacia dentro es la sombra que proyecta el hueco: se
           rellena todo MENOS la caja, se recorta a la caja, y lo único que
           entra es el desenfoque del borde. */
        ctx.save();
        caminoRR(ctx, x, y, w, h, r);
        ctx.clip();
        const m = radio * 2 + 4;
        ctx.beginPath();
        ctx.rect(x - m, y - m, w + m * 2, h + m * 2);
        if (r > 0) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
        else ctx.rect(x, y, w, h);
        ctx.shadowColor = col;
        ctx.shadowBlur = radio;
        ctx.fillStyle = "#000";
        ctx.fill("evenodd");
        ctx.restore();
        break;
      }

      case RADIAL: {
        const cx = F[p], cy = F[p + 1], radio = F[p + 2];
        const desenfoque = F[p + 3], recorte = F[p + 4];
        const c = I[p + 5];
        p += 6;
        paradas.length = 0; colores.length = 0;
        for (let k = 0; k < c; k++) { paradas.push(F[p]); colores.push(I[p + 1]); p += 2; }

        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radio);
        for (let k = 0; k < paradas.length; k++) g.addColorStop(Math.min(1, paradas[k]), color(colores[k]));

        /* El redondeo al 50% recorta ANTES de desenfocar, así que el corte va
           dentro del propio degradado y no como recorte del contexto: un
           recorte del contexto se aplicaría al resultado ya desenfocado. */
        let alcance = radio;
        if (recorte > 0 && recorte < radio) {
          const u = recorte / radio;
          const dentro = enParada(paradas, colores, u);
          g.addColorStop(Math.min(1, u), color(dentro));
          g.addColorStop(Math.min(1, u + 0.0005), color(dentro & 0x00ffffff));
          alcance = recorte;
        }

        ctx.save();
        if (desenfoque > 0) ctx.filter = "blur(" + desenfoque + "px)";
        ctx.fillStyle = g;
        const m = alcance + desenfoque * 3 + 4;
        ctx.fillRect(cx - m, cy - m, m * 2, m * 2);
        ctx.restore();
        break;
      }

      case ANILLO: {
        const cx = F[p], cy = F[p + 1], radio = F[p + 2], g = F[p + 3];
        ctx.strokeStyle = color(I[p + 4]);
        p += 5;
        ctx.beginPath();
        ctx.arc(cx, cy, radio, 0, Math.PI * 2);
        ctx.lineWidth = g;
        ctx.stroke();
        break;
      }

      case RUTA: {
        const id = I[p];
        const cu = encaja(F[p + 1], F[p + 2], F[p + 3], F[p + 4]);
        const x = cu[0], y = cu[1], w = cu[2], h = cu[3];
        const modo = I[p + 5], g = F[p + 6];
        const col = color(I[p + 7]);
        p += 8;
        const r = R.rutas[id];
        if (r === undefined) break;
        ctx.save();
        /* Un SVG encaja su viewBox sin deformarlo y lo centra, y recorta lo
           que se salga de su caja. */
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        const k = Math.min(w / r.ancho, h / r.alto);
        ctx.translate(x + (w - r.ancho * k) / 2, y + (h - r.alto * k) / 2);
        ctx.scale(k, k);
        if (modo === 1) {
          ctx.lineWidth = g;
          ctx.strokeStyle = col;
          ctx.stroke(r.ruta);
        } else {
          ctx.fillStyle = col;
          ctx.fill(r.ruta);
        }
        ctx.restore();
        break;
      }

      default:
        /* Una operación desconocida no se puede saltar sin saber cuánto ocupa:
           lo único honrado es parar y que se vea. */
        console.error("orden desconocida", op, "en", p - 1);
        return;
    }
  }
}
