/* ══ EL PANEL ═══════════════════════════════════════════════════════════════
   Dos modos, y el segundo no existe hasta que el primero está resuelto:

     ASISTENTE — la primera vez, o cuando se vuelve a configurar.
     PANEL     — las pestañas del día a día.

   ## La regla que gobierna el modo panel

   El panel NO tiene estado propio. Lo que enseña es siempre lo último que
   mandó el servidor, que es exactamente lo que está saliendo por antena. Si un
   botón parece encendido, es que ESTÁ encendido; no porque lo hayamos pulsado.

   Eso importa porque el mismo interruptor lo puede accionar la tecla del PC
   del observador, otra persona con el panel abierto en su móvil, o el propio
   servidor cuando se acaba la cuenta atrás. Un panel que se creyera su propia
   versión de la verdad mentiría en los tres casos, y mentiría justo cuando más
   caro sale: en directo.

   La única excepción son los campos de texto mientras se escriben. Se marcan
   como sucios y se dejan en paz hasta que se guardan, porque si no, cada
   mensaje del servidor —y llegan varios por segundo— borraría lo que el
   operador está tecleando.

   ## Los campos se MUDAN, no se duplican

   El nombre del torneo se toca en el asistente y también en su pestaña. Son el
   mismo nodo del DOM, que cambia de sitio según el modo. Dos copias del mismo
   campo acaban discrepando el día que alguien toca una y no la otra, y el día
   que eso pase será en antena.                                              */

import { conecta } from './enlace.js';
import { atajos, guardaAtajos } from './atajos.js';

/* Cada mando de directo lleva la MISMA tecla global que su atajo. Se enseña en
   la esquina inferior izquierda del cuadro y se puede recambiar ahí mismo. */
const ORDEN_ATAJO = {
  pausaTecnica: 'techPause',
  tiempoMuertoIzq: 'leftTimeout',
  tiempoMuertoDer: 'rightTimeout',
  kdaCreditos: 'switchKdaCredits',
};

/* Qué mando está esperando una tecla nueva (rebind inline), o null. */
let capturandoTecla = null;
const $ = (id) => document.getElementById(id);
const nodos = new Map();

/** Lo último que dijo el servidor. Nunca se escribe desde la interfaz. */
let M = null;
let enlace = null;
let mandando = false;

/* La sala leída del cliente de Riot por el observador (feature BETA): quién va
   entrando y en qué lado, ANTES de que haya roster de partida. Se enseña como
   respaldo cuando el equipo aún no tiene jugadores del juego. */
let SALA = null;

/* La ESCENA del juego, tal como la ve el observer (GEP): «Agent Select»,
   «Main Menu», «Practice Range»… Es la verdad en vivo del cliente de Riot y la
   señal fiable de la fase: en el menú/lobby NO estamos en partida (aunque el
   server tenga un partido viejo), y en «Agent Select» sí. Llega por IPC. */
let escena = '';

/* Aplica una sala recibida (del socket o del IPC local). Un `null` significa
   «ya no estás en el lobby custom»; se conserva la última sala para el panel de
   config, pero la fase la decide la escena, no la sala. */
function aplicaSala(valor) {
  if (valor) SALA = valor;
  pintaMatch();
  pintaPrepEquipos();
  pintaEstadoVivo();
}

window.addEventListener('escena', (e) => {
  escena = String(e.detail || '');
  pinta();
});

/* La serie que MUESTRA el panel. Se lleva local para verse al instante al
   terminar un mapa (el server no re-empuja el match tras el game_end), y se
   reconcilia con el server cuando éste alcanza el valor (siembra del mapa
   siguiente / edición manual en Settings). */
let serieLocal = null;
function serieActual() {
  return serieLocal ?? M?.tools?.seriesInfo ?? { needed: 1, wonLeft: 0, wonRight: 0, mapInfo: [] };
}

/* Fin de mapa: detección LOCAL del observador (fiable, no depende de la
   ingesta). Suma +1 al ganador en la serie local (se ve al toque), guarda el
   mapa en el historial (para el banner) y lo manda al server por su canal.
   Anti-duplicado por matchId (o firma mapa+score si no hay id). */
let ultimaSerieClave = '';
window.addEventListener('serie-fin', (e) => {
  const d = e.detail || {};
  const clave = d.matchId || `${d.map}-${d.izq}-${d.der}`;
  if (!clave || clave === ultimaSerieClave) return;
  ultimaSerieClave = clave;

  const base = serieActual();
  const entrada = {
    type: 'past',
    map: d.map || M?.map || '',
    left: { logo: M?.teams?.[0]?.teamUrl ?? '', score: d.izq ?? 0 },
    right: { logo: M?.teams?.[1]?.teamUrl ?? '', score: d.der ?? 0 },
  };
  serieLocal = {
    needed: base.needed ?? 1,
    wonLeft: (base.wonLeft ?? 0) + (d.ganador === 0 ? 1 : 0),
    wonRight: (base.wonRight ?? 0) + (d.ganador === 1 ? 1 : 0),
    mapInfo: [...(Array.isArray(base.mapInfo) ? base.mapInfo : []), entrada],
  };
  pinta();
  enlace?.parchea({ seriesInfo: serieLocal });
});

/* ══ Avisos ════════════════════════════════════════════════════════════════
   Se usan poco y a propósito: un panel que avisa de todo enseña a no leer los
   avisos. Sólo aparece lo que impide trabajar.                             */

function avisa(texto, rojo = false) {
  const caja = $('avisos');
  caja.innerHTML = '';
  if (texto === '') return;
  const d = document.createElement('div');
  d.className = rojo ? 'aviso aviso--rojo' : 'aviso';
  d.textContent = texto;
  caja.append(d);
}

/* ══ La mudanza de los campos compartidos ══════════════════════════════════ */

const COMPARTIDOS = ['torneo', 'equipos', 'serie', 'patrocinio'];

function mudaCampos(aDonde) {
  for (const id of COMPARTIDOS) {
    const enAsistente = document.querySelector(`[data-paso="${id}"] .panel__cuerpo`);
    const enPanel = document.querySelector(`[data-espejo="${id}"]`);
    if (enAsistente === null || enPanel === null) continue;

    const origen = aDonde === 'panel' ? enAsistente : enPanel;
    const destino = aDonde === 'panel' ? enPanel : enAsistente;
    while (origen.firstChild !== null) destino.append(origen.firstChild);
  }
}

/* ══ Modo panel ════════════════════════════════════════════════════════════ */

/**
 * La dirección que el operador pone en OBS.
 *
 * Es la del servidor local del propio programa, no la del sitio web. Dos cosas
 * importan de eso: NO lleva token ni código de grupo dentro —el token se queda
 * en la memoria del proceso y nunca llega a una barra de direcciones—, y es la
 * MISMA en todas las máquinas, así que se puede dictar por teléfono.
 */
function pintaObs() {
  const campo = $('a-obs');
  if (campo === null) return;
  campo.value = cuenta.obs;

  const boton = $('a-obs-copiar');
  if (boton === null || boton.dataset.listo === '1') return;
  boton.dataset.listo = '1';
  boton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(cuenta.obs);
    } catch {
      /* Sin permiso de portapapeles: se selecciona y que copie a mano. */
      campo.select();
    }
    const antes = boton.textContent;
    boton.textContent = 'Copied';
    setTimeout(() => {
      boton.textContent = antes;
    }, 1200);
  });
}

function modoPanel() {
  mudaCampos('panel');
  $('asistente').hidden = true;
  $('panel').hidden = false;
  $('bt-ajustes')?.removeAttribute('hidden');
  $('bt-home')?.removeAttribute('hidden');

  /* El código de grupo ya no se muestra en la cabecera (exe local): sigue vivo
     en la sesión y en Settings, pero no ocupa sitio en antena. */
  pintaObs();

  if (enlace !== null) enlace.cierra();
  permiso = 'conectando';
  pintaEstado('Connecting', false);

  enlace = conecta({
    endpoint: cuenta.endpoint,
    grupo: cuenta.grupo,
    token: cuenta.token,
    alEstado: (m) => {
      const primero = M === null;
      M = m;
      if (primero) avisa('');
      pinta();
    },
    alEntrar: ({ ok, motivo }) => {
      mandando = ok;
      permiso = ok ? 'ok' : 'sin-mando';
      $('a-sesion').textContent = ok
        ? `Group ${cuenta.grupo} · controls open.`
        : `Group ${cuenta.grupo} · no control (${motivo}).`;
      pintaEstadoVivo();
      pintaMandos();
    },
    alFallar: (msg) => avisa(msg, true),
    alSala: (s) => aplicaSala(s),
  });

  pinta();
}

/* ══ Navegación del panel ══════════════════════════════════════════════════ */

function vistaActiva(nombre) {
  for (const b of document.querySelectorAll('.nav__celda')) {
    const suya = b.dataset.vista === nombre;
    if (suya) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  for (const v of document.querySelectorAll('.vista')) {
    v.hidden = v.id !== `vista-${nombre}`;
  }
  try {
    sessionStorage.setItem('easy.panel.vista', nombre);
  } catch {
    /* da igual, se abre en Directo */
  }
}

/* Ya no hay barra de navegación: la única vista operativa es Match. Settings se
   abre/cierra con el engranaje de la barra (alterna Match ⇄ Settings). */
let vistaAhora = 'prepartida';
function muestraVista(nombre) {
  vistaAhora = nombre;
  vistaActiva(nombre);
}
$('bt-ajustes')?.addEventListener('click', () =>
  muestraVista(vistaAhora === 'ajustes' ? 'prepartida' : 'ajustes'),
);

/* ══ Los mandos de directo ═════════════════════════════════════════════════
   Cada uno declara cómo se LEE su estado del partido y qué orden manda. La
   orden es siempre un interruptor sin argumento: se le dice al servidor que
   cambie, no a qué posición ir.                                            */

const MANDOS = [
  {
    orden: 'pausaTecnica',
    titulo: 'Tech pause',
    puesta: (m) => m?.timeoutState?.techPause === true,
    encendido: 'Paused',
    apagado: 'Off',
  },
  {
    orden: 'tiempoMuertoIzq',
    titulo: () => `Timeout · ${nombreEquipo(0)}`,
    puesta: (m) => m?.timeoutState?.leftTeam === true,
    encendido: 'Running',
    apagado: (m) => `${m?.tools?.timeoutCounter?.left ?? 0} left`,
  },
  {
    orden: 'tiempoMuertoDer',
    titulo: () => `Timeout · ${nombreEquipo(1)}`,
    puesta: (m) => m?.timeoutState?.rightTeam === true,
    encendido: 'Running',
    apagado: (m) => `${m?.tools?.timeoutCounter?.right ?? 0} left`,
  },
  {
    orden: 'kdaCreditos',
    titulo: 'Show KDA',
    puesta: (m) => m?.showAliveKDA === true,
    encendido: 'KDA',
    apagado: 'Credits',
  },
];

function nombreEquipo(i) {
  const t = M?.teams?.[i];
  return t?.teamTricode || t?.teamName || (i === 0 ? 'Left' : 'Right');
}

function montaMandos() {
  const caja = $('mandos');
  caja.innerHTML = '';
  for (const m of MANDOS) {
    const wrap = document.createElement('div');
    wrap.className = 'mando-caja';

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mando';
    b.dataset.orden = m.orden;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML =
      '<span class="mando__titulo"></span>' +
      '<span class="mando__pie"><i class="punto" aria-hidden="true"></i><span></span></span>';
    wrap.append(b);

    /* La tecla del mando: botón propio en la esquina inferior izquierda. Va
       fuera del botón grande —no dentro— para que se pueda pulsar aunque el
       mando esté deshabilitado (sin partido todavía). */
    const atajoId = ORDEN_ATAJO[m.orden];
    if (atajoId) {
      const tecla = document.createElement('button');
      tecla.type = 'button';
      tecla.className = 'mando__tecla';
      tecla.dataset.tecla = atajoId;
      tecla.title = 'Change this control’s key';
      wrap.append(tecla);
    }

    caja.append(wrap);
    nodos.set(m.orden, b);
  }
}

function pintaMandos() {
  for (const m of MANDOS) {
    const b = nodos.get(m.orden);
    if (b === undefined) continue;

    const puesta = m.puesta(M);
    b.setAttribute('aria-pressed', puesta ? 'true' : 'false');
    b.querySelector('.mando__titulo').textContent =
      typeof m.titulo === 'function' ? m.titulo(M) : m.titulo;

    const pie = puesta ? m.encendido : m.apagado;
    b.querySelector('.mando__pie span').textContent = typeof pie === 'function' ? pie(M) : pie;

    /* Sin partido o sin mando no hay nada que mandar. Un botón que no va tiene
       que parecer un botón que no va, no fallar en silencio al pulsarlo. */
    b.disabled = M === null || !mandando;

    /* La tecla del mando (esquina inferior izquierda). Atenuada si el atajo está
       apagado; «…» mientras espera una tecla nueva. */
    const atajoId = ORDEN_ATAJO[m.orden];
    const tecla = b.parentElement?.querySelector('.mando__tecla');
    if (atajoId && tecla) {
      const d = atajos();
      const activo = d.enabled?.[atajoId] === true;
      tecla.textContent = capturandoTecla === atajoId ? 'Press a key…' : d[atajoId] || '—';
      tecla.dataset.activo = activo ? 'si' : 'no';
      tecla.dataset.capturando = capturandoTecla === atajoId ? 'si' : 'no';
    }
  }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-orden]');
  if (b === null || b.disabled) return;
  /* «Switch teams» intercambia la identidad izquierda↔derecha: el marcador de
     serie va ATADO al equipo, así que también se intercambia (wonLeft↔wonRight)
     para que el número se mueva con ellos. */
  if (b.dataset.orden === 'intercambiaEquipos') {
    const s = serieActual();
    serieLocal = {
      needed: s.needed ?? 1,
      wonLeft: s.wonRight ?? 0,
      wonRight: s.wonLeft ?? 0,
      mapInfo: Array.isArray(s.mapInfo) ? s.mapInfo : [],
    };
    enlace?.parchea({ seriesInfo: serieLocal });
    pinta();
  }
  enlace?.orden(b.dataset.orden);
});

/* Rebind inline de la tecla de un mando: clic en su chip → espera una tecla →
   la guarda, la enciende y avisa al shell para que el proceso principal registre
   el atajo global en caliente. El chip está FUERA del botón del mando, así que
   este clic no dispara la orden. */
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.mando__tecla');
  if (chip === null) return;
  capturandoTecla = capturandoTecla === chip.dataset.tecla ? null : chip.dataset.tecla;
  /* Al abrir la captura hay que soltar los atajos globales (si no, pulsar la
     tecla dispara el mando en vez de capturarse). Al cerrarla sin cambiar,
     reaplicar los atajos los vuelve a registrar. */
  if (capturandoTecla !== null) {
    window.dispatchEvent(new CustomEvent('suspende-atajos'));
  } else {
    window.dispatchEvent(new CustomEvent('aplicar-atajos'));
  }
  pintaMandos();
});

window.addEventListener(
  'keydown',
  (e) => {
    if (capturandoTecla === null) return;
    if (e.key === 'Escape') {
      capturandoTecla = null;
      /* Cancelar: reaplicar los atajos los vuelve a registrar como estaban. */
      window.dispatchEvent(new CustomEvent('aplicar-atajos'));
      pintaMandos();
      return;
    }
    /* Un modificador suelto todavía no es tecla: se espera a la siguiente. */
    if (e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control') return;
    e.preventDefault();
    e.stopPropagation();
    let s = '';
    if (e.ctrlKey) s += 'Ctrl+';
    if (e.altKey) s += 'Alt+';
    if (e.shiftKey) s += 'Shift+';
    s += e.key.toUpperCase();
    const d = atajos();
    d[capturandoTecla] = s;
    if (typeof d.enabled !== 'object' || d.enabled === null) d.enabled = {};
    /* Recambiar una tecla implica quererla activa: si no, el chip enseñaría una
       tecla que no hace nada. */
    d.enabled[capturandoTecla] = true;
    guardaAtajos();
    window.dispatchEvent(new CustomEvent('aplicar-atajos'));
    capturandoTecla = null;
    pintaMandos();
  },
  true,
);

/* El lápiz de la vista god (junto al nombre o en el logo) abre y cierra el
   bloque de edición de ESA tarjeta —nombre, tricode y logo—. Delegado, como
   todo lo demás, porque las tarjetas se repintan por firma. */
document.addEventListener('click', (e) => {
  const lapiz = e.target.closest('[data-editar]');
  if (lapiz === null) return;
  const tarjeta = lapiz.closest('.god__equipo, .prep__jefe');
  if (tarjeta === null) return;
  const abierto = tarjeta.toggleAttribute('data-editando');
  if (abierto) {
    const primero = tarjeta.querySelector('.edita input');
    primero?.focus();
    primero?.select?.();
  }
});

/* ══ El rótulo ═════════════════════════════════════════════════════════════ */

$('rot-pon').addEventListener('click', () => {
  const segundos = Number($('rot-duracion').value) || 0;
  const equipo = $('rot-equipo').value;
  enlace?.orden('rotulo', {
    active: true,
    title: $('rot-titulo').value.trim(),
    message: $('rot-mensaje').value.trim(),
    /* 0 quiere decir «hasta que lo quite yo». El servidor espera `null` para
       eso, no un cero, que interpretaría como «cero segundos». */
    duration: segundos > 0 ? segundos : null,
    selectedTeam: equipo === '0' ? 'left' : equipo === '1' ? 'right' : undefined,
    eventLogoEnabled: equipo === '',
  });
});

$('rot-quita').addEventListener('click', () => {
  enlace?.orden('rotulo', { active: false, title: '', message: '', duration: null });
});

/* ══ Campos de configuración ═══════════════════════════════════════════════ */

function leeRuta(obj, ruta) {
  return ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function construyeParche(ruta, valor) {
  const partes = ruta.split('.');
  const raiz = {};
  let nodo = raiz;
  for (let i = 0; i < partes.length - 1; i += 1) {
    nodo[partes[i]] = {};
    nodo = nodo[partes[i]];
  }
  nodo[partes[partes.length - 1]] = valor;
  return raiz;
}

function valorDeCampo(el) {
  if (el.type === 'number') return Number(el.value);
  if (el.tagName === 'SELECT' && (el.value === 'true' || el.value === 'false')) {
    return el.value === 'true';
  }
  if (el.tagName === 'SELECT' && el.dataset.clave?.endsWith('needed')) return Number(el.value);
  return el.value;
}

/* Delegado en `document` y no atado a cada campo: los campos se mudan de sitio
   entre los dos modos, y un oyente por nodo se perdería en la mudanza. */
document.addEventListener('input', (e) => {
  if (e.target.dataset?.clave !== undefined || e.target.dataset?.eq !== undefined) {
    e.target.closest('.campo')?.setAttribute('data-sucio', 'si');
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;

  if (el.dataset?.clave !== undefined) {
    enlace?.parchea(construyeParche(el.dataset.clave, valorDeCampo(el)));
    el.closest('.campo')?.removeAttribute('data-sucio');
    return;
  }

  /* Edición de equipo desde la vista god: nombre, tricode o logo. Se manda solo
     el lado tocado —el servidor aplica por índice y respeta lo que no venga—.
     Es un override del panel sobre lo que puso el observador al conectar. */
  if (el.dataset?.eq !== undefined) {
    const i = Number(el.dataset.eq);
    const cambio = { [el.dataset.campo]: el.value };
    enlace?.parchea({ equipos: i === 0 ? [cambio] : [null, cambio] });
    el.closest('.campo')?.removeAttribute('data-sucio');
    return;
  }

  /* Los patrocinadores son una lista: una URL por línea, que es la forma más
     rápida de pegar cinco de golpe desde un correo. */
  if (el.id === 'p-lista') {
    const urls = el.value
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    enlace?.parchea({ sponsorInfo: { sponsors: urls } });
  }
});

function pintaCampos() {
  if (M === null) return;
  for (const el of document.querySelectorAll('[data-clave]')) {
    if (el.closest('.campo')?.dataset.sucio === 'si') continue;
    const v = leeRuta(M.tools, el.dataset.clave);
    if (v === undefined || v === null) continue;
    const texto = String(v);
    if (el.value !== texto) el.value = texto;
  }

  const lista = $('p-lista');
  if (lista !== null && lista.closest('.campo')?.dataset.sucio !== 'si' && !lista.matches(':focus')) {
    const texto = (M.tools?.sponsorInfo?.sponsors ?? []).join('\n');
    if (lista.value !== texto) lista.value = texto;
  }
}

/* ══ Equipos y vista god ═══════════════════════════════════════════════════
   El color del equipo viene del partido y se usa solo como filete lateral —el
   manual lo prohíbe como acento de interfaz—. La vista god enfrenta a los dos
   equipos con logo, alineación y estado de conexión de cada jugador.        */

/* «Conectado» = el cliente del propio jugador está mandando algo. El observador
   ve a los diez de la partida; el cliente de cada jugador añade su vida y
   habilidades. Si `auxiliaryAvailable` está todo en falso, el jugador está en
   la sala pero SU cliente no entró — justo lo que el realizador comprueba
   antes de salir en directo. */
function conCliente(p) {
  const a = p?.auxiliaryAvailable;
  return a != null && (a.health === true || a.abilities === true || a.scoreboard === true);
}

/* Iconos de rango. Se pide una vez el catálogo de competitivetiers al CDN de
   Valorant y se arma el mapa tier→icono, igual que en el overlay. El número de
   tier (0..27) llega en `p.rank`, resuelto por el cliente del observador. */
const ICONOS_RANGO = new Map();
(async () => {
  try {
    const r = await fetch('https://valorant-api.com/v1/competitivetiers');
    const data = (await r.json())?.data ?? [];
    const set = data[data.length - 1];
    for (const t of set?.tiers ?? []) if (t.smallIcon) ICONOS_RANGO.set(t.tier, t.smallIcon);
    /* Repinta: fuerza la firma para que el roster se rehaga con los iconos. */
    const marco = $('vista-directo');
    if (marco) marco.dataset.firmaGod = '';
    const caja = $('equipos');
    if (caja) caja.dataset.firma = '';
    pinta();
  } catch {
    /* sin red: el panel funciona igual, solo sin iconos de rango */
  }
})();
const iconoRango = (tier) => (tier && tier > 0 ? ICONOS_RANGO.get(tier) ?? '' : '');

/* Catálogo de mapas: se pide una vez a Valorant y se arma nombre→imagen (el
   splash, la misma arte del selector del juego). Se indexa por displayName y
   por el último tramo de mapUrl, porque el GEP a veces da uno u otro. */
const MAPAS = new Map();
(async () => {
  try {
    const r = await fetch('https://valorant-api.com/v1/maps');
    const data = (await r.json())?.data ?? [];
    for (const m of data) {
      const img = m.splash || m.listViewIcon || '';
      if (!img) continue;
      const entrada = { splash: m.splash || img, icon: m.listViewIcon || img };
      if (m.displayName) MAPAS.set(m.displayName.toLowerCase(), entrada);
      if (m.mapUrl) {
        const seg = m.mapUrl.split('/').filter(Boolean).pop();
        if (seg) MAPAS.set(seg.toLowerCase(), entrada);
      }
    }
    pintaMapaTile();
  } catch {
    /* sin red: el panel funciona igual, solo sin imagen de mapa */
  }
})();
const imagenMapa = (nombre) => {
  if (!nombre) return '';
  const e = MAPAS.get(String(nombre).toLowerCase());
  /* splash = arte del mapa en alta (1920×1080). Más pesado que la carta, pero
     se ve mucho mejor en el tile y se cachea tras la primera carga. */
  return e ? e.splash : '';
};

/* El tile del mapa en la vista Broadcast: imagen de fondo + nombre. Toma el
   mapa del partido en vivo; si no, el de la sala. Se oculta si no hay mapa. */
let mapaPintado = null;
function pintaMapaTile() {
  const tile = $('mapa-tile');
  if (tile === null) return;
  const vivo = M?.map && String(M.map).toLowerCase() !== 'loading' ? M.map : '';
  const sala = SALA?.mapa && String(SALA.mapa).toLowerCase() !== 'loading' ? SALA.mapa : '';
  const nombre = vivo || sala;
  const nom = $('mapa-tile-nombre');
  if (!nombre) {
    tile.hidden = true;
    mapaPintado = null;
    return;
  }
  tile.hidden = false;
  if (nom) nom.textContent = nombre;
  /* Solo recomputa la imagen cuando cambia el mapa (evita recargas y parpadeo). */
  if (nombre === mapaPintado) return;
  mapaPintado = nombre;

  const key = nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
  const local = `assets/maps/${key}.webp`;
  /* Se prueba el WebP local ligero (empaquetado, ~70 KB, carga instantánea). Si
     el mapa no está empaquetado (uno nuevo), cae al splash de valorant-api. */
  const prueba = new Image();
  prueba.onload = () => {
    if (mapaPintado !== nombre) return;
    tile.style.backgroundImage = `url('${local}')`;
    tile.dataset.sinimg = 'no';
  };
  prueba.onerror = () => {
    if (mapaPintado !== nombre) return;
    const img = imagenMapa(nombre);
    tile.style.backgroundImage = img ? `url('${encodeURI(img)}')` : '';
    tile.dataset.sinimg = img ? 'no' : 'si';
  };
  prueba.src = local;
}

/* Una fila de jugador: punto de estado (rojo = su cliente está dentro), icono de
   rango, nick y agente. Muerto → tachado; sin cliente → en gris. */
function filaJugador(p) {
  const online = conCliente(p);
  const vivo = p.isAlive !== false;
  const agente = p.agentProper || p.agentInternal || '';
  const urlRango = iconoRango(p.rank);
  const rango = urlRango ? `<img class="jug__rango" src="${urlRango}" alt="" />` : '';
  /* El rango va SIEMPRE pegado a la izquierda del nombre: por eso rango+nick van
     juntos en `.jug__id`, que no se invierte aunque la fila del equipo derecho
     sí lo haga. */
  return (
    `<div class="jug" data-online="${online}" data-vivo="${vivo}">` +
    `<i class="punto" aria-hidden="true"></i>` +
    `<span class="jug__id">${rango}<span class="jug__nick">${escapa(p.name ?? '—')}</span></span>` +
    `<span class="jug__agente">${escapa(online ? agente : 'sin cliente')}</span>` +
    `</div>`
  );
}

/* ¿Este jugador de la sala ya tiene su cliente conectado y enviando? Se cruza
   su puuid con la lista `conectados` que manda el servidor (los aux vivos). */
function salaOnline(j) {
  return SALA?.conectados?.includes(j.puuid) === true;
}

/* Una fila de la SALA (BETA): jugador que está en la sala de Riot. Si su cliente
   ya está enviando, punto encendido y "con cliente"; si no, "en sala". */
function filaSala(j) {
  const nick = j.tag ? `${j.nombre}#${j.tag}` : j.nombre;
  const online = salaOnline(j);
  const urlRango = iconoRango(j.rango);
  const rango = urlRango ? `<img class="jug__rango" src="${urlRango}" alt="" />` : '';
  return (
    `<div class="jug" data-online="${online}" data-vivo="true" data-sala="1">` +
    `<i class="punto" aria-hidden="true"></i>` +
    `<span class="jug__id">${rango}<span class="jug__nick">${escapa(nick)}</span></span>` +
    `<span class="jug__agente">${online ? 'con cliente' : 'en sala'}</span>` +
    `</div>`
  );
}

/* La sala imita la pantalla de VALORANT: ATACANTES a la IZQUIERDA (rojo) y
   DEFENSORES a la DERECHA (teal), fijo. Solo cambian los jugadores, nunca el
   lado ni el color. teamTwo son los atacantes y teamOne los defensores (así lo
   da el cliente de Riot). Ya en partida, si se sabe el bando de cada lado se
   respeta (los lados del marcador sí pueden cambiar en el descanso). */
function salaDeLado(i) {
  if (SALA === null) return [];
  const ataque = SALA.equipoDos ?? [];
  const defensa = SALA.equipoUno ?? [];
  const t = M?.teams?.[i];
  if (t) return t.isAttacking ? ataque : defensa;
  return i === 0 ? ataque : defensa;
}

/* Firma de la sala, para el control de repintado (incluye quién está online). */
function salaFirma() {
  if (SALA === null) return '';
  const l = (a) =>
    (a ?? [])
      .map((j) => j.nombre + '#' + j.tag + (salaOnline(j) ? '*' : '') + 'r' + (j.rango ?? ''))
      .join(',');
  return `${l(SALA.equipoUno)}~${l(SALA.equipoDos)}~${l(SALA.observadores)}`;
}

/* Firma de lo visible, para no repintar en cada mensaje (llegan varios por
   segundo) y no tirar el foco. Incluye conexión y vivo de cada jugador. */
function firmaEquipos() {
  return (M.teams ?? [])
    .map(
      (t) =>
        `${t.teamName}|${t.teamTricode}|${t.teamUrl}|${t.isAttacking}|${t.roundsWon}|` +
        (t.players ?? [])
          .map((p) => `${p.name}:${p.agentProper || p.agentInternal}:${p.isAlive}:${conCliente(p)}:${p.rank ?? 0}`)
          .join(','),
    )
    .join('~');
}

/* ── La vista god (la principal del realizador) ──────────────────────────── */

function pintaGod() {
  if ($('roster-0') === null) return;
  const marco = $('vista-directo');

  if (M === null) {
    for (const i of [0, 1]) {
      const enSala = salaDeLado(i);
      // Como en el lobby de VALORANT: la izquierda es ATACANTES, la derecha
      // DEFENSORES. Fijo; solo cambia quién los ocupa.
      $(`nombre-${i}`).textContent = i === 0 ? 'ATTACKERS' : 'DEFENDERS';
      $(`meta-${i}`).textContent = enSala.length ? `In lobby · ${enSala.length}` : 'no match';
      $(`roster-${i}`).innerHTML =
        enSala.map(filaSala).join('') || '<span class="apunte">No players yet.</span>';
      $(`logo-${i}`).style.backgroundImage = '';
      $(`score-${i}`).textContent = '0';
      // Modo sala: izquierda ATAQUE (rojo), derecha DEFENSA (teal), como en la
      // pantalla de VALORANT. Fijo: solo cambian los equipos, no el color.
      $(`lado-${i}`).dataset.bando = i === 0 ? 'atk' : 'def';
    }
    const obs = SALA?.observadores?.length ?? 0;
    $('d-ronda').textContent = SALA
      ? `In lobby${obs ? ` · ${obs} obs.` : ''} (BETA)`
      : 'No match';
    return;
  }

  const firma = firmaEquipos() + '|' + (M.roundNumber ?? '') + '|s' + salaFirma();
  if (marco.dataset.firmaGod === firma) return;
  marco.dataset.firmaGod = firma;

  (M.teams ?? []).forEach((t, i) => {
    if (i > 1) return;
    const jugadores = t.players ?? [];
    const conectados = jugadores.filter(conCliente).length;
    $(`nombre-${i}`).textContent = t.teamName || (i === 0 ? 'Left' : 'Right');
    $(`meta-${i}`).textContent =
      `${t.isAttacking ? 'Attack' : 'Defense'} · ${conectados}/${jugadores.length || 5} connected`;
    $(`score-${i}`).textContent = String(t.roundsWon ?? 0);
    // Tinte por bando, como en el juego.
    $(`lado-${i}`).dataset.bando = t.isAttacking ? 'atk' : 'def';
    $(`logo-${i}`).style.backgroundImage = t.teamUrl ? `url('${encodeURI(t.teamUrl)}')` : '';
    const enSala = salaDeLado(i);
    $(`roster-${i}`).innerHTML =
      jugadores.map(filaJugador).join('') ||
      enSala.map(filaSala).join('') ||
      '<span class="apunte">No players yet.</span>';
    /* El filete del equipo toma su color del partido, solo aquí. */
    const el = $(`lado-${i}`);
    if (t.teamColor) el.style.setProperty('--equipo', t.teamColor);

    /* Prellenar los campos de edición con lo que hay, sin pisar lo que el
       operador esté escribiendo (campo enfocado o marcado como sucio). */
    for (const [suf, val] of [
      ['nombre', t.teamName],
      ['tri', t.teamTricode],
      ['logo', t.teamUrl],
    ]) {
      const inp = $(`ed-${suf}-${i}`);
      if (inp === null) continue;
      if (document.activeElement === inp || inp.closest('.campo')?.dataset.sucio === 'si') continue;
      const v = val ?? '';
      if (inp.value !== v) inp.value = v;
    }
  });
}

/* ── La pestaña Equipos (correcciones) mantiene la lista simple ──────────── */

function pintaEquipos() {
  const caja = $('equipos');
  if (caja === null) return;
  if (M === null) {
    caja.innerHTML = '<p class="apunte">No match connected.</p>';
    return;
  }
  const firma = firmaEquipos();
  if (caja.dataset.firma === firma) return;
  caja.dataset.firma = firma;

  caja.innerHTML = (M.teams ?? [])
    .map((t, i) => {
      const lado = i === 0 ? 'Left' : 'Right';
      const bando = t.isAttacking ? 'Attack' : 'Defense';
      const jugadores = t.players ?? [];
      const conectados = jugadores.filter(conCliente).length;
      return (
        `<div class="equipo">` +
        `<span class="etiqueta">${lado} · ${bando} · ${t.roundsWon ?? 0} rounds</span>` +
        `<span class="valor" style="display:block;margin-top:4px">${escapa(t.teamName ?? '—')}</span>` +
        `<span class="apunte" style="display:block;margin-bottom:8px">${conectados}/${jugadores.length || 5} with client connected</span>` +
        (jugadores.map(filaJugador).join('') || '<span class="apunte">No players yet.</span>') +
        `</div>`
      );
    })
    .join('');
}

const escapa = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/* ══ La tira de estado ═════════════════════════════════════════════════════ */

function pintaTira() {
  /* La esencia del torneo en la cabecera: su logo y su nombre. Sale solo cuando
     hay alguno de los dos; el mapa y el estado los pinta pintaEstadoVivo. */
  const torneo = $('estado-torneo');
  if (torneo !== null) {
    const n = M?.tools?.tournamentInfo?.name || '';
    const logo = M?.tools?.tournamentInfo?.logoUrl || '';
    torneo.hidden = !(n || logo);
    const nom = $('estado-torneo-nombre');
    if (nom) nom.textContent = n;
    const img = $('estado-torneo-logo');
    if (img) {
      if (logo) {
        if (img.getAttribute('src') !== logo) img.src = logo;
        img.hidden = false;
      } else {
        img.hidden = true;
        img.removeAttribute('src');
      }
    }
  }
  const ronda = $('d-ronda');
  if (ronda !== null && M !== null) ronda.textContent = `Round ${M.roundNumber ?? 1}`;
}

function pintaEstado(texto, vivo) {
  $('estado-texto').textContent = texto;
  $('estado').dataset.vivo = vivo ? 'si' : 'no';
  /* Mismo estado, replicado en la cinta de la vista god. */
  const t = $('estado-directo-txt');
  if (t !== null) t.textContent = texto;
  const e = $('estado-directo');
  if (e !== null) e.dataset.vivo = vivo ? 'si' : 'no';
}

/* El permiso de emisión (sesión/mando) es aparte del estado del JUEGO. Lo
   guardamos para poder recomputar la cabecera en cada actualización sin perder
   «Read only» o «No session». */
let permiso = 'sin-sesion'; // 'sin-sesion' | 'conectando' | 'sin-mando' | 'ok'

/* El estado del juego, tal como se puede leer desde el panel: la fase de ronda
   (M.roundPhase) y si hay sala/party abierta. El «Agent Select» exacto vive en
   el cliente (la escena de VALORANT) y aún no baja al panel; mientras, el
   pre-partida se resuelve como Lobby / Loading. */
function estadoJuego() {
  /* El estado sigue la MISMA autoridad que la vista: la escena en vivo. */
  if (escena === 'Agent Select') return { texto: 'Agent select', vivo: true };
  if (escena.startsWith('Round ')) {
    const n = M?.roundNumber ?? escena.slice(6).trim();
    return { texto: `In game · R${n}`, vivo: true };
  }
  return { texto: SALA ? 'Lobby' : 'Waiting for match', vivo: false };
}

/* Pinta la cabecera con el estado VIVO: permiso primero (sin sesión / sin
   mando), y si todo va, el estado del juego. Actualiza también la celda de mapa
   a la derecha. */
function pintaEstadoVivo() {
  const mapaCelda = $('estado-mapa');
  const ponMapa = (txt) => {
    if (mapaCelda === null) return;
    const on = !!txt;
    mapaCelda.hidden = !on;
    mapaCelda.textContent = on ? txt : '';
  };
  if (permiso === 'sin-sesion') return pintaEstado('No session', false), ponMapa('');
  if (permiso === 'conectando') return pintaEstado('Connecting', false), ponMapa('');
  if (permiso === 'sin-mando') return pintaEstado('Read only', false), ponMapa('');
  const { texto, vivo } = estadoJuego();
  pintaEstado(texto, vivo);
  /* Mapa: del partido en vivo, o si aún no hay (estamos en lobby), el de la sala.
     Así «Breeze» sale en la cabecera desde el lobby, no solo dentro del juego. */
  const vivoMap = M?.map && String(M.map).toLowerCase() !== 'loading' ? M.map : '';
  const salaMap = SALA?.mapa && String(SALA.mapa).toLowerCase() !== 'loading' ? SALA.mapa : '';
  ponMapa(vivoMap || salaMap);
}

/* El reloj de la cuenta atrás del tiempo muerto. Lo lleva el navegador: el
   servidor manda cuánto queda cuando le toca, y entre mensaje y mensaje esto
   sigue contando para que no vaya a saltos. Misma decisión que en el cartel de
   pausa del overlay. */
function pintaReloj() {
  const to = M?.timeoutState;
  const activo =
    to != null && (to.techPause === true || to.leftTeam === true || to.rightTeam === true);
  const reloj = $('reloj-god');
  if (!activo) {
    if (reloj !== null) reloj.textContent = '--:--';
    return;
  }
  const resto = Math.max(0, Math.round(to.timeRemaining ?? 0));
  const txt = `${Math.floor(resto / 60)}:${String(resto % 60).padStart(2, '0')}`;
  if (reloj !== null) reloj.textContent = txt;
}

/* ── Cámaras de jugador (VDO.Ninja) ─────────────────────────────────────────
   El botón crea una sala (código aleatorio) y la manda al servidor; de ahí baja
   a los exes de los jugadores. `enabledPlayers` lo rellenan los propios exes al
   publicar, así que aquí solo se enseña cuántos hay. */
$('cam-generar')?.addEventListener('click', async () => {
  const boton = $('cam-generar');
  const estado = $('cam-estado');
  const inp = $('cam-sala');
  const act = $('cam-activar');

  /* Si la serie ya terminó (el botón dice «New matchup»), esto arranca un
     enfrentamiento nuevo: reinicia el marcador de serie a 0-0 antes de crear. */
  const s = serieActual();
  const needed = s.needed ?? 1;
  if (needed > 1 && ((s.wonLeft ?? 0) >= needed || (s.wonRight ?? 0) >= needed)) {
    serieLocal = { needed, wonLeft: 0, wonRight: 0, mapInfo: [] };
    ultimaSerieClave = '';
    enlace?.parchea({ seriesInfo: serieLocal });
    pinta();
  }

  /* El puente lo pone el shell (solo dentro del exe del observador). */
  const crear = window.__easyCreaSala;
  if (typeof crear !== 'function') {
    if (estado) estado.textContent = 'Create lobby only works inside the observer exe.';
    return;
  }
  boton.disabled = true;
  const antes = boton.textContent;
  boton.textContent = 'Creating…';
  if (estado) estado.textContent = 'Creating the VALORANT custom and pulling the code…';
  try {
    const res = await crear();
    if (res && res.ok && res.codigo) {
      /* Solo fija la SALA (identifier). Las cámaras son aparte: el operador las
         activa con el toggle. El MISMO código sirve de sala de VDO.Ninja. */
      enlace?.parchea({ playercamsInfo: { identifier: res.codigo } });
      if (inp) inp.value = res.codigo;
      if (estado) {
        estado.textContent = `Lobby created · code ${res.codigo} · you’re in spectator. Share the code so they can join.`;
      }
    } else if (estado) {
      estado.textContent = res
        ? `Couldn’t create the lobby: ${res.error ?? 'unknown error'}`
        : 'Create lobby only works inside the observer exe.';
    }
  } catch {
    if (estado) estado.textContent = 'Error creating the lobby.';
  } finally {
    boton.disabled = false;
    boton.textContent = antes;
  }
});

/* CALL PLAYERS (mockup): en el diseño invita a los jugadores a unirse a la sala.
   Hoy NO existe una acción de servidor para invitar —los exes de jugador entran
   con el código de sala, no hay puente de invitación—, así que el botón queda
   presente pero sin efecto. No se inventa backend aquí.
   TODO: cablear a la acción real de invitar/llamar cuando el shell exponga el
   puente correspondiente (p. ej. window.__easyLlamaJugadores). */
$('cam-llamar')?.addEventListener('click', () => {
  /* Inerte a propósito — ver el comentario de arriba. */
});

/* El raíl de iconos de la lobby reabre el dashboard (#menu-inicio) en la sección
   pedida. La lobby vive FUERA del dashboard (que es quien tiene la navegación),
   así que no puede llamar a su router directamente: dispara un evento que db.js
   escucha en montaDashboard. También lo usa el «← Matches» de la fila superior. */
document.addEventListener('click', (e) => {
  const ir = e.target.closest('[data-lobby-ir]');
  if (ir === null) return;
  window.dispatchEvent(new CustomEvent('abre-dashboard', { detail: ir.dataset.lobbyIr }));
});

/* El tick que va DENTRO de cada cuadradito cuando está encendido. El color y la
   propia marca solo se ven si el slot lleva data-mod/data-hud = "si" (lo hace el
   CSS); aquí siempre se pinta y el CSS decide. */
const TICK =
  '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2.5 6.2l2.3 2.3L9.5 3.5" /></svg>';

/* Un slot de la lobby. El rol decide qué se muestra a la derecha del nombre:
   - observador → los dos cuadraditos (moderador gris, HUD azul), con tick dentro
     cuando están encendidos. Es la ÚNICA columna con cuadraditos.
   - jugador    → si tiene el CLIENTE de Easy HUD conectado. «Ready» sale solo
     cuando lo tiene; si no, «No app». (El IsReady del juego u otros flags no
     cuentan para esto.)
   - coach      → solo nombre y rango. */
function slotPrep(j, rol) {
  if (!j) {
    const txt =
      rol === 'observador'
        ? 'Waiting for observer…'
        : rol === 'coach'
          ? 'No coach'
          : 'Waiting for player…';
    return `<div class="prep__slot prep__slot--vacio">${txt}</div>`;
  }
  const nick = j.tag ? `${j.nombre}#${j.tag}` : j.nombre;
  const url = iconoRango(j.rango);
  const rango = url ? `<img class="jug__rango" src="${url}" alt="" />` : '';
  /* Cuadro de 26px a la izquierda del nombre (look de «agent square» del mockup):
     el icono de rango si lo hay, o una casilla vacía para que la fila cuadre. */
  const cuadro = url ? rango : '<span class="jug__rango jug__rango--vacia"></span>';

  if (rol === 'observador') {
    const mod = j.moderador ? 'si' : 'no';
    const hud = j.hudBroadcast ? 'si' : 'no';
    return (
      `<div class="prep__slot" data-mod="${mod}" data-hud="${hud}">` +
      `<span class="prep__cuadros" aria-hidden="true">` +
      `<i class="prep__cuad prep__cuad--mod">${TICK}</i>` +
      `<i class="prep__cuad prep__cuad--hud">${TICK}</i>` +
      `</span>${rango}` +
      `<span class="jug__nick">${escapa(nick)}</span></div>`
    );
  }

  if (rol === 'coach') {
    return `<div class="prep__slot">${cuadro}<span class="jug__nick">${escapa(nick)}</span></div>`;
  }

  /* jugador: estado del cliente de Easy HUD. Hoy `easyHud` aún no lo alimenta
     nadie (falta el exe del jugador), así que sale «No app» hasta que ese
     cliente reporte su presencia. */
  const tiene = !!j.easyHud;
  const insignia = tiene
    ? '<span class="prep__ready">Ready</span>'
    : '<span class="prep__noapp">No app</span>';
  return (
    `<div class="prep__slot" data-app="${tiene ? 'si' : 'no'}">` +
    `${cuadro}<span class="jug__nick">${escapa(nick)}</span>${insignia}</div>`
  );
}

function pintaSlots(id, jugadores, minimo, rol) {
  const caja = $(id);
  if (caja === null) return;
  const arr = jugadores ?? [];
  const total = Math.max(minimo, arr.length);
  let html = '';
  for (let i = 0; i < total; i += 1) html += slotPrep(arr[i], rol);
  caja.innerHTML = html;
}

/* ── La vista Match: la misma en dos fases ──────────────────────────────────
   LOBBY: 3 columnas del party (Attackers · Defenders · Observers), config a la
   izquierda. VIVO: Defenders a la derecha, marcador+controles al centro,
   Observers en fila abajo. Mismo diseño de columnas; solo cambia el grid. */

/* Config de sala (izquierda) + código: se pinta SIEMPRE, en ambas fases. */
let ultimaSalaSync = '';
function pintaConfigSala() {
  const s = SALA;
  const cam = M?.tools?.playercamsInfo ?? {};
  const id = s?.codigo || cam.identifier || '';
  const pub = Array.isArray(cam.enabledPlayers) ? cam.enabledPlayers : [];

  const codigoVivo = s?.codigo ?? '';
  if (codigoVivo && codigoVivo !== cam.identifier && codigoVivo !== ultimaSalaSync) {
    ultimaSalaSync = codigoVivo;
    enlace?.parchea({ playercamsInfo: { identifier: codigoVivo } });
  }

  const inp = $('cam-sala');
  if (inp && document.activeElement !== inp) inp.value = id || '—';

  const set = (nid, v) => {
    const el = $(nid);
    if (el) el.textContent = v || '—';
  };
  set('prep-modo', s?.modo);
  set('prep-mapa', s?.mapa);
  set('prep-servidor', s?.servidor);
  set('prep-cerrada', s ? (s.cerrada ? 'Closed' : 'Open') : '—');

  /* Fila superior de la lobby (mockup): mapa y torneo junto al indicador LOBBY.
     Mismos datos que ya se muestran; sin nuevas fuentes. */
  set('prep-top-mapa', s?.mapa);
  const topTo = $('prep-top-torneo');
  if (topTo) topTo.textContent = M?.tools?.tournamentInfo?.name || '';

  const estado = $('cam-estado');
  if (estado) {
    estado.textContent = !id
      ? 'No lobby yet. Press “Create lobby”.'
      : cam.enable && pub.length
        ? `Lobby live · ${pub.length} camera${pub.length === 1 ? '' : 's'} publishing.`
        : cam.enable
          ? 'Lobby created · cameras on · waiting for players to publish.'
          : 'Lobby created · share the code.';
  }
}

/* Slots de la fase LOBBY: los del party (lector de sala). */
let firmaPrep = '';
function pintaSlotsLobby() {
  const s = SALA;
  const firma = JSON.stringify([
    s?.equipoUno, s?.equipoDos, s?.observadores, s?.coachesUno, s?.coachesDos,
  ]);
  if (firma === firmaPrep) return;
  firmaPrep = firma;
  pintaSlots('prep-atk', s?.equipoDos, 5, 'jugador'); // atacantes = teamTwo
  pintaSlots('prep-def', s?.equipoUno, 5, 'jugador'); // defensores = teamOne
  pintaSlots('prep-atk-coach', s?.coachesDos, 1, 'coach');
  pintaSlots('prep-def-coach', s?.coachesUno, 1, 'coach');
  pintaSlots('prep-obs', s?.observadores, Math.max(6, (s?.observadores?.length ?? 0) + 1), 'observador');
}

/* Un slot de jugador EN VIVO, con el estilo del lobby: rango + nick, atenuado
   si su cliente no está conectado. */
function slotJugadorVivo(p) {
  if (!p) return '<div class="prep__slot prep__slot--vacio">—</div>';
  const nick = p.name || '—';
  const url = iconoRango(p.rank);
  const cuadro = url
    ? `<img class="jug__rango" src="${url}" alt="" />`
    : '<span class="jug__rango jug__rango--vacia"></span>';
  const online = conCliente(p) ? 'si' : 'no';
  return (
    `<div class="prep__slot" data-online="${online}">` +
    `${cuadro}<span class="jug__nick">${escapa(nick)}</span></div>`
  );
}
function pintaSlotsVivo(id, jugadores) {
  const caja = $(id);
  if (caja === null) return;
  const arr = jugadores ?? [];
  const total = Math.max(5, arr.length);
  let html = '';
  for (let i = 0; i < total; i += 1) html += slotJugadorVivo(arr[i]);
  caja.innerHTML = html;
}

/* Columnas en fase VIVO: rosters del partido (team 0 izq, team 1 der), marcador
   y ronda al centro, observadores abajo. */
let firmaVivo = '';
function pintaColumnasVivo() {
  const t0 = M?.teams?.[0];
  const t1 = M?.teams?.[1];
  const s0 = $('score-0');
  if (s0) s0.textContent = String(t0?.roundsWon ?? 0);
  const s1 = $('score-1');
  if (s1) s1.textContent = String(t1?.roundsWon ?? 0);
  const ronda = $('d-ronda');
  if (ronda) ronda.textContent = `Round ${M?.roundNumber ?? 1}`;
  const ponMeta = (i, t) => {
    const m = $(`prep-meta-${i}`);
    if (!m) return;
    const lado = t?.isAttacking ? 'Attack' : 'Defense';
    m.textContent = t?.teamTricode ? `${t.teamTricode} · ${lado}` : lado;
  };
  ponMeta(0, t0);
  ponMeta(1, t1);

  const pFirma = (p) => `${p?.name}|${p?.rank}|${conCliente(p)}`;
  const firma = JSON.stringify([
    (t0?.players ?? []).map(pFirma),
    (t1?.players ?? []).map(pFirma),
    SALA?.observadores,
  ]);
  if (firma === firmaVivo) return;
  firmaVivo = firma;
  pintaSlotsVivo('prep-atk', t0?.players);
  pintaSlotsVivo('prep-def', t1?.players);
  const ca = $('prep-atk-coach');
  if (ca) ca.innerHTML = '';
  const cd = $('prep-def-coach');
  if (cd) cd.innerHTML = '';
  pintaSlots('prep-obs', SALA?.observadores, Math.max(2, SALA?.observadores?.length ?? 0), 'observador');
}

/* «Vivo» = ya empezó la selección de agentes o el propio juego. El server marca
   `agentSelectStartTime` en la primera data de roster (que llega en la selección
   de agentes), así que con eso la vista se transforma DESDE la selección, no solo
   al entrar en combate. */
/* «En partida» SOLO con evidencia POSITIVA de la escena en vivo del juego:
   selección de agentes, o una ronda en curso. El estado del server (M) persiste
   viejo aunque cancelen la partida, así que NO se usa para entrar en vivo —si se
   usara, la vista se quedaría pegada en «vivo» al volver al lobby—. Sin escena
   clara, se asume lobby (el fallo seguro). */
function partidaEnCurso() {
  if (escena === 'Agent Select') return true;
  if (escena.startsWith('Round ')) return true; // «Round N» = en juego
  return false;
}

function pintaMatch() {
  const cont = $('match-cols');
  if (cont === null) return;
  const enVivo = partidaEnCurso();
  cont.dataset.fase = enVivo ? 'vivo' : 'lobby';
  pintaConfigSala();
  pintaSerie();
  if (enVivo) pintaColumnasVivo();
  else pintaSlotsLobby();
}

/* La serie (BO): con formato > BO1 sale un contador de mapas ganados a la
   derecha de cada equipo, y el botón «Create lobby» dice qué mapa de la serie
   estás por crear (1, 2, 3…). El marcador lo lleva el server solo (game_end). */
function pintaSerie() {
  /* Reconcilia: cuando el server alcanza (o supera) el marcador local —el mapa
     siguiente ya sembró, o el operador editó en Settings—, se adopta el del
     server y se suelta el local. Mientras el server va detrás (justo tras el
     game_end), manda el local para verse al instante. */
  const sm = M?.tools?.seriesInfo;
  if (
    serieLocal &&
    sm &&
    (sm.wonLeft ?? 0) >= serieLocal.wonLeft &&
    (sm.wonRight ?? 0) >= serieLocal.wonRight
  ) {
    serieLocal = null;
  }
  const s = serieActual();
  const needed = s?.needed ?? 1;
  const bo = needed > 1;
  const izq = s?.wonLeft ?? 0;
  const der = s?.wonRight ?? 0;
  /* Campeón de la serie: el equipo que llegó a los mapas necesarios (2 en BO3,
     3 en BO5…). Se enmarca en blanco con una estrella a la izquierda. */
  const camp0 = bo && izq >= needed;
  const camp1 = bo && der >= needed;

  const c0 = $('prep-serie-0');
  const c1 = $('prep-serie-1');
  if (c0) {
    c0.hidden = !bo;
    c0.textContent = String(izq);
    c0.dataset.campeon = camp0 ? 'si' : 'no';
  }
  if (c1) {
    c1.hidden = !bo;
    c1.textContent = String(der);
    c1.dataset.campeon = camp1 ? 'si' : 'no';
  }

  /* El botón: si la serie ya terminó (hay campeón) el siguiente paso es un
     enfrentamiento nuevo, no otro mapa; si no, «Create lobby N» (el mapa que
     toca). No se toca mientras crea (deshabilitado) ni enfocado. */
  const btn = $('cam-generar');
  if (btn && !btn.disabled && document.activeElement !== btn) {
    btn.textContent =
      camp0 || camp1 ? 'New matchup' : bo ? `Create lobby ${izq + der + 1}` : 'Create lobby';
  }
}

/* Copiar el código de sala. */
$('cam-copiar')?.addEventListener('click', async () => {
  const inp = $('cam-sala');
  const v = inp?.value ?? '';
  if (!v || v === '—') return;
  try {
    await navigator.clipboard.writeText(v);
    const b = $('cam-copiar');
    if (b) {
      const antes = b.textContent;
      b.textContent = 'Copied';
      setTimeout(() => (b.textContent = antes), 1200);
    }
  } catch {
    /* sin portapapeles */
  }
});

/* Los cards de identidad de equipo en Pre-partida: logo y nombre. El lado
   (rojo/teal) es fijo por posición (izquierda=ataque, derecha=defensa); lo que
   cambia es la identidad, que también se prellena en los inputs (eso lo hace
   pintaGod, que comparte los ids ed-*). */
function pintaPrepEquipos() {
  if ($('pl-0') === null) return;
  for (const i of [0, 1]) {
    const t = M?.teams?.[i];
    const nombre = $(`prep-nombre-${i}`);
    const logo = $(`prep-logo-${i}`);
    const meta = $(`prep-meta-${i}`);
    if (nombre) nombre.textContent = t?.teamName || (i === 0 ? 'Attackers' : 'Defenders');
    if (logo) logo.style.backgroundImage = t?.teamUrl ? `url('${encodeURI(t.teamUrl)}')` : '';
    /* Meta como en el diseño: «TRICODE · Attack/Defense» (el lado es fijo por
       posición: izq=ataque, der=defensa). Sin tricode, solo el lado. */
    if (meta) {
      const lado = i === 0 ? 'Attack' : 'Defense';
      meta.textContent = t?.teamTricode ? `${t.teamTricode} · ${lado}` : lado;
    }
  }
}

function pinta() {
  pintaTira();
  pintaMandos();
  pintaCampos();
  pintaMatch();
  pintaEquipos();
  pintaReloj();
  pintaPrepEquipos();
  pintaEstadoVivo();
}

/* ══ Arranque ══════════════════════════════════════════════════════════════
   El panel NO configura nada. La cuenta ya sabe a qué servidor y grupo va; el
   observador, al conectar, crea el partido; el panel solo lo DETECTA y lo
   gobierna. Así que al abrir:

     1. Se pregunta a la cuenta (cookie de sesión) por el grupo y el token.
     2. Se conecta al servidor —por el propio dominio, cifrado— y aparece la
        vista god: poblada si el observador está en directo, o «esperando» si
        todavía no ha conectado.

   Sin IP, sin código de grupo, sin asistente. */

/** Lo que la cuenta nos dice: a dónde conectar y con qué. Vive en memoria. */
let cuenta = null;

/* La sala leída localmente (por IPC del proceso principal, sin pasar por el
   servidor): la fuente más fiable para el Pre-partida, porque no depende de que
   la conexión al servidor esté viva. Gana sobre la que llega por socket. */
window.addEventListener('sala-local', (e) => aplicaSala(e.detail));

montaMandos();

/* Sin nav: siempre arranca en Match. Settings se abre con el engranaje. */
muestraVista('prepartida');

setInterval(pintaReloj, 250);

/**
 * Arranca el panel con la sesión que le da el shell.
 *
 * El panel vive SOLO dentro del exe y ya no se arranca solo: no lee la barra
 * de direcciones ni pide nada por cookie. Quien tiene la sesión es el shell
 * —el mismo documento, `shell.js`— y se la entrega aquí.
 *
 * Que no haya versión web es a propósito. Tener el panel en dos sitios —
 * servido por el VPS y empaquetado en el exe— era el mismo fichero bajo dos
 * raíces distintas, y eso ya produjo dos fallos reales: el botón de salir
 * dejaba el panel en blanco, y la dirección de OBS salía con el token dentro.
 * Una sola casa, un solo modo.
 *
 * @param {{endpoint: string, grupo: string, token: string, obs: string}} sesion
 */
export function arranca(sesion) {
  cuenta = sesion;
  modoPanel();
}

/** Empuja un patch de configuración a emisión (para el «Start» del dashboard).
   Reusa el mismo camino que los campos del panel: `enlace.parchea`. */
export function iniciaConfig(patch) {
  enlace?.parchea(patch);
}

/** Lo apaga cuando la sesión se va o caduca. Deja de mandar y suelta el socket. */
export function apaga() {
  if (enlace !== null) {
    enlace.cierra();
    enlace = null;
  }
  cuenta = null;
  M = null;
  mandando = false;
  SALA = null;
  permiso = 'sin-sesion';
  const caja = $('panel');
  if (caja !== null) caja.hidden = true;
  const nav = $('nav');
  if (nav !== null) nav.hidden = true;
  pintaEstado('No session', false);
}
