/* ══ EL ASISTENTE ═══════════════════════════════════════════════════════════
   La primera vez no hay nada: ni servidor, ni torneo, ni equipos. Este módulo
   lleva de la mano hasta que lo hay, y entonces se aparta.

   ## No hay paso de licencia, y es a propósito

   La plantilla se elige AL CONTRATAR, en la web: quien tiene plan premium ve
   las premium y elige; quien no, no ve nada que elegir. Para cuando el cliente
   llega aquí, eso ya está decidido y firmado.

   Así que el panel no pide clave ni enseña selector. La licencia llega sola en
   la dirección con la que se abre el panel desde su cuenta —`?token=…`—, se
   guarda al vuelo y se borra de la barra de direcciones. Quien no traiga
   ninguna es del plan gratis, que es un estado legítimo y no un error: el
   instalador gratuito trae esta misma consola sin nada que elegir.

   Pedir una clave habría sido pedirle al cliente que copie a mano algo que
   nosotros ya sabemos. Es el paso donde más gente se cae y no compraba nada.

   ## Por qué los pasos van en este orden

   1. SERVIDOR — a qué partido pertenece todo lo demás.
   2..5        — lo que se puede saltar: el torneo puede arrancar con el
                 overlay en blanco y rellenarse en caliente.
   6. LISTO    — las direcciones para pegar en OBS.

   Todo lo que se puede saltar va DESPUÉS de todo lo que no. Un asistente que
   obliga a rellenar cinco pantallas antes de dejarte probar si la cosa conecta
   es un asistente que se abandona a la mitad.

   ## Lo que el asistente NO hace

   No comprueba la licencia. No puede: la firma se hace con un secreto que está
   en el servidor y sólo ahí. Lo que enseña es lo que dice el papel. La verdad
   la dice el servidor al conectar.                                          */

import {
  leeToken,
  diasQueQuedan,
  nombrePlantilla,
  plantillasDe,
  CATALOGO,
  PLANTILLA_LIBRE,
} from './licencia.js';

const $ = (id) => document.getElementById(id);

const PASOS = [
  { id: 'plantilla', nombre: 'Plantilla', obligatorio: true },
  { id: 'servidor', nombre: 'Servidor', obligatorio: true },
  { id: 'torneo', nombre: 'Torneo' },
  { id: 'equipos', nombre: 'Equipos' },
  { id: 'serie', nombre: 'Serie' },
  { id: 'patrocinio', nombre: 'Patrocinio' },
  { id: 'listo', nombre: 'Listo' },
];

const LLAVE_CONFIG = 'easy.panel.config';
const LLAVE_LICENCIA = 'easy.panel.licencia';

/* ── Lo que se recuerda entre sesiones ───────────────────────────────────── */

export function configuracion() {
  try {
    return JSON.parse(localStorage.getItem(LLAVE_CONFIG) ?? '{}');
  } catch {
    return {};
  }
}

export function guardaConfig(parche) {
  const c = { ...configuracion(), ...parche };
  try {
    localStorage.setItem(LLAVE_CONFIG, JSON.stringify(c));
  } catch {
    /* Navegación privada: la sesión funciona igual, sólo que no se recuerda. */
  }
  return c;
}

/**
 * La licencia se guarda en `localStorage`, no en `sessionStorage`.
 *
 * Es una decisión con precio y conviene tenerlo escrito: queda en el disco del
 * que la metió, así que quien se siente en ese equipo entra sin pedir permiso.
 * A cambio, la configuración se hace UNA vez y no en cada pestaña nueva — y un
 * asistente que hay que repetir cada vez que se cierra el navegador no es un
 * asistente, es un peaje.
 *
 * El botón de «olvidar la licencia» de Ajustes existe por esto, y es lo que
 * hay que usar en un equipo prestado.
 */
export function licencia() {
  try {
    return localStorage.getItem(LLAVE_LICENCIA) ?? '';
  } catch {
    return '';
  }
}

export function guardaLicencia(token) {
  try {
    localStorage.setItem(LLAVE_LICENCIA, token);
  } catch {
    /* idem */
  }
}

/**
 * Recoge la licencia de la dirección y la quita de la barra.
 *
 * El cliente llega aquí pulsando «abrir panel» en su cuenta, y ese enlace trae
 * el token puesto. Se guarda y se borra de la URL en el acto, por dos razones:
 * no queda en el historial ni en una captura de pantalla del móvil, y el
 * operador no acaba compartiendo por Discord un enlace que lleva su licencia
 * dentro creyendo que comparte «la web del panel».
 *
 * Si no viene ninguna, no pasa nada: es el plan gratis.
 */
export function capturaToken() {
  const enUrl = new URLSearchParams(location.search).get('token');
  if (enUrl === null || enUrl === '') return;

  guardaLicencia(enUrl);
  const limpia = new URL(location.href);
  limpia.searchParams.delete('token');
  history.replaceState(null, '', limpia);
}

export function olvidaTodo() {
  try {
    localStorage.removeItem(LLAVE_LICENCIA);
    localStorage.removeItem(LLAVE_CONFIG);
  } catch {
    /* nada que olvidar */
  }
}

/* ── La plantilla elegida ────────────────────────────────────────────────── */

/**
 * La que está puesta, siempre dentro de lo que la licencia permite.
 *
 * Se comprueba contra el derecho en CADA lectura y no sólo al elegir: una
 * licencia caduca, o se baja de plan, y lo que quedó guardado en el navegador
 * no se entera. Sin esto, el panel seguiría ofreciendo direcciones de una
 * plantilla que el servidor ya no va a entregar, y el realizador descubriría
 * el problema con OBS abierto.
 */
export function plantillaElegida() {
  const derecho = plantillasDe(licencia());
  const guardada = configuracion().plantilla;
  return derecho.includes(guardada) ? guardada : derecho[derecho.length - 1];
}

/* ── El raíl de pasos ────────────────────────────────────────────────────── */

let actual = 0;
let alTerminar = () => {};
let masLejos = 0;

/**
 * Los pasos que este cliente ve.
 *
 * El de plantilla desaparece del raíl cuando la licencia sólo da derecho a
 * una: no basta con saltarlo al avanzar, porque un paso listado y a la vez
 * inalcanzable es peor que no tenerlo — parece una avería, o peor, parece que
 * le falta algo que a otros sí les sale.
 */
function pasos() {
  const conEleccion = plantillasDe(licencia()).length > 1;
  return PASOS.filter((p) => p.id !== 'plantilla' || conEleccion);
}

function pintaRail() {
  const rail = $('raíl');
  rail.innerHTML = '';
  pasos().forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'paso';
    b.dataset.ir = String(i);
    b.dataset.estado = i === actual ? 'actual' : i < masLejos ? 'hecho' : 'pendiente';
    b.disabled = i > masLejos;
    b.innerHTML =
      `<span class="paso__n">${String(i + 1).padStart(2, '0')}</span>` +
      `<span>${p.nombre}</span>`;
    rail.append(b);
  });
}

function muestra(i) {
  const lista = pasos();
  actual = Math.max(0, Math.min(lista.length - 1, i));
  masLejos = Math.max(masLejos, actual);

  const suyo = lista[actual];
  for (const s of document.querySelectorAll('[data-paso]')) {
    s.hidden = s.dataset.paso !== suyo.id;
  }

  /* El número del título se escribe aquí y no en el HTML: si un paso no sale,
     los de detrás se corren, y un «03» de cabecera bajo un «02» del raíl es la
     clase de detalle que hace dudar de todo lo demás. */
  const titulo = document.querySelector(`[data-paso="${suyo.id}"] .display`);
  if (titulo !== null) {
    titulo.textContent = titulo.textContent.replace(
      /^\d+ · /,
      `${String(actual + 1).padStart(2, '0')} · `,
    );
  }

  pintaRail();

  /* «Atrás» en el primer paso no lleva a ningún sitio. Un botón que no hace
     nada enseña a desconfiar de los que sí hacen algo. */
  const atras = document.querySelector(`[data-paso="${suyo.id}"] [data-atras]`);
  if (atras !== null) atras.hidden = actual === 0;

  if (suyo.id === 'plantilla') pintaPlantillas();
  if (suyo.id === 'listo') pintaUrls();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Las tarjetas de plantilla ───────────────────────────────────────────── */

/* Esquema de cada plantilla: bloques en porcentaje sobre el marco 16:9. No es
   una captura —una captura envejece con el diseño y acaba mintiendo—, es dónde
   va cada cosa, que es lo que de verdad se compara al elegir. */
const ESQUEMAS = {
  [PLANTILLA_LIBRE]: [
    [34, 4, 32, 9], // marcador arriba
    [6, 78, 40, 7], // barra de equipo
    [54, 78, 40, 7],
  ],
  'cristal-v1': [
    [34, 4, 32, 9],
    [6, 76, 40, 9],
    [54, 76, 40, 9],
    [6, 20, 16, 46], // tarjetas laterales
    [78, 20, 16, 46],
    [38, 88, 24, 5], // cartel de ronda
  ],
};

function pintaPlantillas() {
  const derecho = plantillasDe(licencia());
  const puesta = plantillaElegida();
  const caja = $('plantillas');

  $('plan-nota').textContent =
    derecho.length > 1 ? `${derecho.length} incluidas en tu plan` : 'Incluida en tu plan';

  caja.innerHTML = derecho
    .map((id) => {
      const t = CATALOGO[id] ?? { nombre: id, nota: '' };
      const bloques = (ESQUEMAS[id] ?? [])
        .map(([x, y, w, h]) => `<i style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"></i>`)
        .join('');
      return (
        `<button class="plantilla" type="button" role="radio" data-plantilla="${id}" ` +
        `aria-checked="${id === puesta}">` +
        `<span class="plantilla__vista" aria-hidden="true">${bloques}</span>` +
        `<span class="plantilla__nombre">${t.nombre}</span>` +
        `<span class="apunte">${t.nota}</span>` +
        `<span class="plantilla__estado"><i class="punto" aria-hidden="true"></i>` +
        `<span>${id === puesta ? 'Elegida' : 'Disponible'}</span></span>` +
        `</button>`
      );
    })
    .join('');
}

/* ── Validación de cada paso ─────────────────────────────────────────────── */

/** @returns {string} vacío si se puede pasar, o el motivo por el que no. */
function valida(id) {
  if (id === 'servidor') {
    const punto = $('cfg-endpoint').value.trim();
    const grupo = $('cfg-grupo').value.trim();
    if (punto === '') return 'Falta la dirección del servidor.';
    if (grupo === '') return 'Falta el código de grupo.';

    /* La licencia dice para qué grupo vale. Si no coincide, el servidor lo va
       a rechazar de todas formas — más vale decirlo aquí, donde todavía se
       puede corregir, que a mitad de una emisión. */
    const c = leeToken(licencia());
    if (c !== null && c.grupo !== '*' && c.grupo !== grupo) {
      return `Esta licencia es para el grupo ${c.grupo}, no para ${grupo}.`;
    }

    guardaConfig({ endpoint: punto, grupo });
    return '';
  }

  return '';
}

/* ── La ficha de la licencia ─────────────────────────────────────────────── */

export function pintaFicha(donde, token, origen) {
  const caja = typeof donde === 'string' ? $(donde) : donde;
  if (caja === null) return;

  const c = leeToken(token);

  /* Sin licencia no se enseña un hueco ni un error: se enseña el plan que
     tiene. No tenerla es un estado legítimo —el instalador gratuito es esto
     mismo sin nada que elegir—, y un panel que dijera «falta la licencia»
     estaría llamando avería a un cliente. */
  if (c === null) {
    caja.innerHTML =
      '<div class="ficha">' +
      fila('Plan', nombrePlantilla(PLANTILLA_LIBRE)) +
      '</div>';
    return;
  }

  const dias = diasQueQuedan(c.caduca);
  const fecha = c.caduca.toISOString().slice(0, 10);
  const caducada = dias < 0;

  caja.innerHTML =
    '<div class="ficha">' +
    fila('Cliente', c.cliente) +
    /* La plantilla va la PRIMERA de las tres de abajo porque es lo que el
       cliente ha comprado y lo que va a querer comprobar de un vistazo. No es
       un selector: aquí no se elige, se lee lo que la licencia asigna. */
    fila('Plantilla', nombrePlantilla(plantillaElegida())) +
    fila('Grupo', c.grupo === '*' ? 'cualquiera' : c.grupo) +
    fila(
      'Caduca',
      caducada ? `${fecha} · caducada hace ${-dias} días` : `${fecha} · quedan ${dias} días`,
      caducada,
    ) +
    (origen === undefined ? '' : fila('Origen', origen)) +
    '</div>' +
    '<p class="apunte" style="margin-top:10px">Esto es lo que dice la licencia. ' +
    'Quien decide si vale es el servidor, al conectar.</p>';
}

const fila = (etiqueta, valor, rojo = false) =>
  '<div class="ficha__fila"><span class="etiqueta">' +
  etiqueta +
  '</span><span class="valor"' +
  (rojo ? ' style="color:var(--rec-claro)"' : '') +
  '>' +
  String(valor).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]) +
  '</span></div>';

/* ── Las direcciones de OBS ──────────────────────────────────────────────── */

const PANTALLAS = [
  ['Combate', 'combate'],
  ['Compra', 'compra'],
  ['Selección de agentes', 'seleccion'],
  ['Carteles de ronda', 'carteles/ceremonia.html'],
  ['Pausa', 'carteles/pausa.html'],
  ['Avisos y patrocinadores', 'carteles/avisos.html'],
  ['Victoria', 'victoria'],
];

/**
 * De la plantilla asignada a la carpeta donde vive.
 *
 * Hoy todas las pantallas cuelgan de la raíz, así que esto devuelve cadena
 * vacía y las direcciones salen como han salido siempre. El día que cada
 * plantilla tenga su carpeta —`/cristal-v1/combate/`— esta función es lo único
 * que hay que cambiar, y las siete direcciones se mueven con ella.
 */
const raizDe = (plantilla) => (plantilla === PLANTILLA_LIBRE ? '' : '');

function pintaUrls() {
  const cfg = configuracion();
  const raiz = raizDe(plantillaElegida());
  const base = location.origin + location.pathname.replace(/panel\/.*$/, '') + raiz;
  const cola = `?groupCode=${encodeURIComponent(cfg.grupo ?? '')}&token=${encodeURIComponent(licencia())}`;

  $('urls').innerHTML = PANTALLAS.map(([nombre, ruta]) => {
    /* Las pantallas que son carpeta llevan barra final —el índice está dentro—
       y las que son un fichero suelto, no. Una barra de más aquí manda la
       fuente de OBS a una ruta que no existe, y el realizador se encuentra un
       rectángulo transparente sin ningún error que leer. */
    const url = `${base}${ruta}${ruta.endsWith('.html') ? '' : '/'}${cola}`;
    return (
      `<div><span class="etiqueta" style="margin-bottom:5px">${nombre}</span>` +
      `<div class="copia"><input type="text" readonly value="${url.replace(/"/g, '&quot;')}" />` +
      `<button class="boton boton--secundario" type="button" data-copia>Copiar</button></div></div>`
    );
  }).join('');
}

/* ── Arranque ────────────────────────────────────────────────────────────── */

export function arranca(manos) {
  alTerminar = manos.alTerminar;
  const cfg = configuracion();

  /* Se rellena con lo que ya se sepa: si el asistente se reabre para corregir
     una cosa, no se empieza de cero. */
  $('cfg-endpoint').value = cfg.endpoint ?? manos.endpointPorDefecto ?? '';
  $('cfg-grupo').value = cfg.grupo ?? manos.grupoPorDefecto ?? '';

  $('plantillas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-plantilla]');
    if (b === null) return;
    guardaConfig({ plantilla: b.dataset.plantilla });
    pintaPlantillas();
  });

  $('raíl').addEventListener('click', (e) => {
    const b = e.target.closest('.paso');
    if (b !== null && !b.disabled) muestra(Number(b.dataset.ir));
  });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-avanza], [data-atras], [data-salta]');
    if (b === null) return;

    if (b.hasAttribute('data-atras')) {
      muestra(Math.max(0, actual - 1));
      return;
    }
    if (b.hasAttribute('data-salta')) {
      muestra(actual + 1);
      return;
    }

    const motivo = valida(pasos()[actual].id);
    if (motivo !== '') {
      manos.avisa(motivo, true);
      return;
    }
    manos.avisa('');
    muestra(actual + 1);
  });

  /* Copiar una dirección de OBS. */
  $('urls').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copia]');
    if (b === null) return;
    const campo = b.parentElement.querySelector('input');
    try {
      await navigator.clipboard.writeText(campo.value);
      b.textContent = 'Copiado';
      setTimeout(() => (b.textContent = 'Copiar'), 1400);
    } catch {
      /* Sin permiso de portapapeles se selecciona y que copie a mano. */
      campo.select();
    }
  });

  $('termina').addEventListener('click', () => {
    guardaConfig({ hecho: true });
    alTerminar();
  });

  muestra(0);
}

/** Para volver al asistente desde Ajustes. */
export function reabre() {
  masLejos = pasos().length - 1;
  muestra(0);
}
