/* ══ CONFIRMAR LO DESTRUCTIVO ═══════════════════════════════════════════════
   Un clic de más en directo no se deshace. Antes de lo que cambia lo que sale
   en antena (intercambiar equipos o bandos, cerrar sesión, crear otra sala con
   una partida en marcha) el panel pregunta, y dice qué va a pasar en una frase.

   Es un `<dialog>` propio, no `window.confirm()`: el diálogo nativo bloquea todo
   el programa (también los atajos globales del observador) y no se puede dar
   estilo ni explicar el efecto. Aquí:

     - Escape y «Cancel» cancelan; el foco empieza en «Cancel» (Intro sin mirar
       no ejecuta lo destructivo).
     - Solo puede haber uno abierto: un segundo `confirma` mientras hay uno
       abierto devuelve `false` en vez de apilarse.                            */

let abierto = null;

/**
 * @param {{ titulo: string, texto: string, ok?: string, cancelar?: string, peligro?: boolean }} o
 * @returns {Promise<boolean>} true si el operador confirma.
 */
export function confirma({ titulo, texto, ok = 'Confirm', cancelar = 'Cancel', peligro = true }) {
  if (abierto !== null) return Promise.resolve(false);
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg dlg--confirma';
    dlg.setAttribute('aria-labelledby', 'confirma-tit');

    const form = document.createElement('form');
    form.method = 'dialog';
    form.className = 'dlg__form';

    const h = document.createElement('h2');
    h.className = 'display';
    h.id = 'confirma-tit';
    h.textContent = titulo;

    const p = document.createElement('p');
    p.className = 'apunte';
    p.style.margin = '0';
    p.textContent = texto;

    const pie = document.createElement('div');
    pie.className = 'dlg__pie';
    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'boton boton--terciario';
    no.textContent = cancelar;
    const si = document.createElement('button');
    si.type = 'submit';
    si.className = 'boton' + (peligro ? ' boton--peligro' : '');
    si.textContent = ok;
    pie.append(no, si);

    form.append(h, p, pie);
    dlg.append(form);
    document.body.append(dlg);
    abierto = dlg;

    let resultado = false;
    const acaba = () => {
      abierto = null;
      dlg.remove();
      resolve(resultado);
    };
    no.addEventListener('click', () => dlg.close());
    form.addEventListener('submit', () => {
      resultado = true;
    });
    dlg.addEventListener('close', acaba);
    dlg.addEventListener('cancel', () => {
      resultado = false;
    });

    dlg.showModal();
    no.focus();
  });
}
