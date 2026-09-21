/* ══ Efectos visuales del panel (portados de React Bits a vanilla, sin libs) ══
   Cada uno es CSS-first: el JS solo pone variables --*, y panel.css hace el resto.
   Nada de esto toca color de marca fuera de lo ya usado (blanco/gris; el rojo
   sigue reservado a la antena). */

/* ── "Spotlight Card": el brillo sigue el cursor dentro del contenedor.
   Un solo listener delegado por contenedor (sobrevive a los repintados de
   innerHTML porque escucha en el padre, no en las cards). */
export function activaSpotlight(contenedor) {
  if (!contenedor || contenedor.dataset.spotOn) return;
  contenedor.dataset.spotOn = '1';
  contenedor.addEventListener('mousemove', (e) => {
    const tarjeta = e.target.closest('.spot');
    if (!tarjeta) return;
    const r = tarjeta.getBoundingClientRect();
    tarjeta.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    tarjeta.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  });
}

/* ── "Line Sidebar": los ítems del raíl reaccionan a la distancia vertical
   del cursor (más cerca = más brillo/escala). Se resetea al salir. */
export function activaRailProximidad(rail) {
  if (!rail || rail.dataset.railOn) return;
  rail.dataset.railOn = '1';
  const ALCANCE = 90; // px de radio de influencia
  rail.addEventListener('mousemove', (e) => {
    for (const it of rail.querySelectorAll('.menu__item')) {
      const r = it.getBoundingClientRect();
      const centro = r.top + r.height / 2;
      const d = Math.min(1, Math.abs(e.clientY - centro) / ALCANCE);
      it.style.setProperty('--cerca', String(1 - d));
    }
  });
  rail.addEventListener('mouseleave', () => {
    for (const it of rail.querySelectorAll('.menu__item')) it.style.setProperty('--cerca', '0');
  });
}

/* ── "Pill Nav": barra deslizante bajo la pill activa. Se llama tras repintar
   #m-pills (el indicador vive en el ::after del contenedor, no en los hijos,
   asi que sobrevive al innerHTML de las pills). */
export function indicaPill(contenedor) {
  if (!contenedor) return;
  const activo = contenedor.querySelector('.is-on');
  if (!activo) {
    contenedor.style.setProperty('--ind-w', '0px');
    return;
  }
  contenedor.style.setProperty('--ind-x', `${activo.offsetLeft}px`);
  contenedor.style.setProperty('--ind-w', `${activo.offsetWidth}px`);
}
