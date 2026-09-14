/* ══ ACCESO ═════════════════════════════════════════════════════════════════
   La puerta del observador.

   Se dibuja ENCIMA del panel, no en su sitio: así el panel de debajo no se
   desmonta, no pierde lo que el operador tuviera escrito, y al entrar esto
   simplemente desaparece.

   ## Por qué el observador necesita cuenta

   Sin ella, cualquiera que se baje el instalador alimenta el servidor. El
   token del overlay cierra quién MIRA; esto cierra quién EMITE, y es la mitad
   que faltaba: la licencia se ata a una cuenta, no a un fichero que se puede
   pasar por Discord.                                                        */

import { entra } from './sesion.js';

const $ = (id) => document.getElementById(id);

let entrando = false;

/** Pinta el estado del formulario: bloqueado mientras comprueba. */
function marcha(activa) {
  entrando = activa;
  const campos = [$('ac-correo'), $('ac-contrasena'), $('ac-entrar')];
  for (const el of campos) {
    if (el !== null) el.disabled = activa;
  }
  const boton = $('ac-entrar');
  if (boton !== null) boton.textContent = activa ? 'Comprobando…' : 'Entrar';
  const rotulo = $('ac-marcha');
  if (rotulo !== null) {
    rotulo.dataset.vivo = activa ? 'si' : 'no';
    const texto = rotulo.querySelector('[data-texto]');
    if (texto !== null) texto.textContent = activa ? 'Entrando' : 'Observador';
  }
}

function falla(motivo) {
  const el = $('ac-fallo');
  if (el === null) return;
  el.textContent = motivo;
  el.hidden = motivo === '';
}

async function intenta(ev) {
  ev?.preventDefault();
  if (entrando) return;

  marcha(true);
  falla('');

  const correo = $('ac-correo')?.value ?? '';
  const contrasena = $('ac-contrasena')?.value ?? '';

  const motivo = await entra(correo, contrasena);

  /*
   * La contraseña se borra pase lo que pase, también cuando ha ido bien.
   * Mientras siga en el campo sigue estando en memoria del proceso y en
   * cualquier volcado que se genere; y si el intento ha fallado, dejarla
   * escrita «para que lo intente otra vez» es dejarla a la vista de quien pase
   * por delante del PC.
   */
  const campo = $('ac-contrasena');
  if (campo !== null) campo.value = '';

  marcha(false);
  if (motivo !== '') falla(motivo);
  /* Si ha entrado no se hace nada más aquí: el shell escucha el cambio de
     sesión y se encarga de esconder esto y arrancar el panel. */
}

/** Monta los manejadores. Se llama una vez, al cargar. */
export function montaAcceso() {
  $('ac-form')?.addEventListener('submit', intenta);
  $('ac-web')?.addEventListener('click', (ev) => {
    ev.preventDefault();
    /* Abrir en el navegador del sistema es cosa del proceso principal: una
       ventana de Electron no es sitio para navegar por la web. */
    window.electronAPI?.openExternalLink?.('https://easyhud.net');
  });
}

/** Enseña u oculta la puerta. */
export function muestraAcceso(visible) {
  const caja = $('acceso');
  if (caja === null) return;
  caja.hidden = !visible;
  if (visible) {
    falla('');
    marcha(false);
    /* El foco al correo: en un torneo se entra con prisa y sin ratón. */
    $('ac-correo')?.focus();
  }
}
