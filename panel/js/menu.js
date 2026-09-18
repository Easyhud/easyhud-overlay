/* ══ MENÚ DE INICIO — dashboard con sidebar ═════════════════════════════════
   Tras entrar, ocupa toda la ventana. El sidebar cambia la sección visible; el
   contenido tiene la acción de cada modo.

     · Quick Match → un mapa (BO1). Botón «Start» → aplica BO1 y cierra.
     · BOX Match   → elegís formato (BO2/BO3/BO5) → aplica y cierra. Los equipos
                     se llenan en el panel; el veto de mapas es la fase 2.
     · Tournament / Roles → placeholders (crecerá acá).

   No reinventa la config: setea el mismo `#set-s-formato` que ya existe en
   Settings y dispara su `change`, que el panel parchea al servidor. */

const $ = (id) => document.getElementById(id);

/** Aplica el formato reusando el camino de config del panel. */
function aplicaFormato(needed) {
  const sel = $('set-s-formato');
  if (sel === null) return;
  sel.value = String(needed);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Cambia la sección visible del dashboard y sincroniza rail + sidebar. */
function activa(panel) {
  for (const it of document.querySelectorAll('.menu__item')) {
    it.classList.toggle('is-activo', it.dataset.panel === panel);
  }
  for (const s of document.querySelectorAll('.menu__panel')) {
    s.classList.toggle('is-activo', s.dataset.panel === panel);
  }
  /* Rail: el «+» (torneo) se activa con su panel; Home con el resto. */
  const railAdd = document.querySelector('.rail__ico--add');
  const railHome = document.querySelector('.rail__ico[data-rail="home"]');
  if (railAdd !== null) railAdd.classList.toggle('is-activo', panel === 'torneo');
  if (railHome !== null) railHome.classList.toggle('is-activo', panel !== 'torneo');
}

let alElegir = null;

/** Monta los manejadores. `cb(modo)` lo llama el shell para ocultar el menú. */
export function montaMenu(cb) {
  alElegir = cb;

  /* Cada botón con `data-panel` (sidebar o rail «+») muestra su sección. */
  for (const b of document.querySelectorAll('button[data-panel]')) {
    b.addEventListener('click', () => activa(b.dataset.panel));
  }

  /* El icono Home del rail vuelve al contexto Broadcast (sección Quick). */
  document
    .querySelector('.rail__ico[data-rail="home"]')
    ?.addEventListener('click', () => activa('quick'));

  /* Quick: BO1 y a emitir. */
  $('menu-quick')?.addEventListener('click', () => {
    aplicaFormato(1);
    alElegir?.('quick');
  });

  /* BOX: el formato ES el botón de arranque. */
  for (const b of document.querySelectorAll('.menu__panel[data-panel="box"] .menu__fmt')) {
    b.addEventListener('click', () => {
      aplicaFormato(Number(b.dataset.needed)); // BO2/BO3=2, BO5=3
      /* El rótulo (BO2/BO3/BO5) se guarda para el veto de la fase 2: BO2 y BO3
         clinchan a 2, pero BO2 juega 2 mapas máximo y BO3 hasta 3. */
      try {
        localStorage.setItem('easy.formato', b.dataset.format || '');
      } catch {
        /* sin storage no pasa nada: el formato de serie ya se aplicó arriba */
      }
      alElegir?.('box');
    });
  }
}

/** Enseña u oculta el menú. Al abrir, arranca en la primera sección (Quick). */
export function muestraMenu(visible) {
  const caja = $('menu-inicio');
  if (caja === null) return;
  caja.hidden = !visible;
  if (visible) activa('quick');
}
