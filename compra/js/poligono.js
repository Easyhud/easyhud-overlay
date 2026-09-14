window.HUD = window.HUD || {};
(() => {
/* Insignia de definitiva: polígono con TANTOS LADOS COMO PUNTOS cuesta la
   ultimate (8 → octógono, 7 → heptágono, 6 → hexágono) y un tramo encendido
   por punto cargado. */

/* Recorte del polígono de n lados, con el primer vértice arriba. */
function recortePoligono(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i / n) - Math.PI / 2;
    pts.push((50 + 50 * Math.cos(a)).toFixed(2) + '% ' + (50 + 50 * Math.sin(a)).toFixed(2) + '%');
  }
  return 'clip-path:polygon(' + pts.join(',') + ');';
}

/* Cada punto es un TRAMO del anillo: banda entre el lado exterior y el
   interior, recortada la misma distancia lineal en ambos extremos. Con holgura
   angular las juntas salen en cuña (anchas fuera, finas dentro); con recorte
   lineal el grosor y la junta son constantes. */
function tramos(n, cargados, color) {
  const out = [];
  const paso = Math.PI * 2 / n;
  const R = 50;     // radio exterior, en % de la caja
  const r = 39;     // radio interior: grosor de la banda
  const junta = 2.4; // media junta, en las mismas unidades
  const P = (x, y) => x.toFixed(2) + '% ' + y.toFixed(2) + '%';

  for (let i = 0; i < n; i++) {
    const a0 = paso * i - Math.PI / 2;
    const a1 = paso * (i + 1) - Math.PI / 2;
    const ux = Math.cos(a1) - Math.cos(a0);
    const uy = Math.sin(a1) - Math.sin(a0);
    const ul = Math.hypot(ux, uy) || 1;
    const dx = (ux / ul) * junta;
    const dy = (uy / ul) * junta;

    const o0x = 50 + R * Math.cos(a0) + dx, o0y = 50 + R * Math.sin(a0) + dy;
    const o1x = 50 + R * Math.cos(a1) - dx, o1y = 50 + R * Math.sin(a1) - dy;
    const i1x = 50 + r * Math.cos(a1) - dx, i1y = 50 + r * Math.sin(a1) - dy;
    const i0x = 50 + r * Math.cos(a0) + dx, i0y = 50 + r * Math.sin(a0) + dy;

    out.push('position:absolute;inset:0;'
      + 'clip-path:polygon(' + P(o0x, o0y) + ',' + P(o1x, o1y) + ',' + P(i1x, i1y) + ',' + P(i0x, i0y) + ');'
      + 'transition:background .42s var(--ease);'
      + 'background:' + (i < cargados ? color : 'rgb(255 255 255 / 14%)') + ';');
  }
  return out;
}

  Object.assign(window.HUD, { recortePoligono, tramos });
})();
