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
    boton.textContent = 'Copiado';
    setTimeout(() => {
      boton.textContent = antes;
    }, 1200);
  });
}

function modoPanel() {
  mudaCampos('panel');
  $('asistente').hidden = true;
  $('panel').hidden = false;
  $('nav').hidden = false;
  $('rotulo-asistente').hidden = true;

  $('estado-codigo').textContent = cuenta.grupo || '···';
  pintaObs();

  if (enlace !== null) enlace.cierra();
  pintaEstado('Conectando', false);

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
      if (ok) {
        pintaEstado(M === null ? 'Esperando partido' : 'En antena', M !== null);
        $('a-sesion').textContent = `Grupo ${cuenta.grupo} · mando abierto.`;
      } else {
        pintaEstado('Sólo lectura', false);
        $('a-sesion').textContent = `Grupo ${cuenta.grupo} · sin mando (${motivo}).`;
      }
      pintaMandos();
    },
    alFallar: (msg) => avisa(msg, true),
    alSala: (s) => {
      SALA = s;
      pintaGod();
    },
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

$('nav').addEventListener('click', (e) => {
  const celda = e.target.closest('.nav__celda');
  if (celda !== null) vistaActiva(celda.dataset.vista);
});

/* ══ Los mandos de directo ═════════════════════════════════════════════════
   Cada uno declara cómo se LEE su estado del partido y qué orden manda. La
   orden es siempre un interruptor sin argumento: se le dice al servidor que
   cambie, no a qué posición ir.                                            */

const MANDOS = [
  {
    orden: 'pausaTecnica',
    titulo: 'Pausa técnica',
    puesta: (m) => m?.timeoutState?.techPause === true,
    encendido: 'En pausa',
    apagado: 'Fuera',
  },
  {
    orden: 'tiempoMuertoIzq',
    titulo: () => `T. muerto · ${nombreEquipo(0)}`,
    puesta: (m) => m?.timeoutState?.leftTeam === true,
    encendido: 'Corriendo',
    apagado: (m) => `Le quedan ${m?.tools?.timeoutCounter?.left ?? 0}`,
  },
  {
    orden: 'tiempoMuertoDer',
    titulo: () => `T. muerto · ${nombreEquipo(1)}`,
    puesta: (m) => m?.timeoutState?.rightTeam === true,
    encendido: 'Corriendo',
    apagado: (m) => `Le quedan ${m?.tools?.timeoutCounter?.right ?? 0}`,
  },
  {
    orden: 'kdaCreditos',
    titulo: 'Mostrar KDA',
    puesta: (m) => m?.showAliveKDA === true,
    encendido: 'KDA',
    apagado: 'Créditos',
  },
];

function nombreEquipo(i) {
  const t = M?.teams?.[i];
  return t?.teamTricode || t?.teamName || (i === 0 ? 'Izquierda' : 'Derecha');
}

function montaMandos() {
  const caja = $('mandos');
  caja.innerHTML = '';
  for (const m of MANDOS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mando';
    b.dataset.orden = m.orden;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML =
      '<span class="mando__titulo"></span>' +
      '<span class="mando__pie"><i class="punto" aria-hidden="true"></i><span></span></span>';
    caja.append(b);
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
  }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-orden]');
  if (b === null || b.disabled) return;
  enlace?.orden(b.dataset.orden);
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

/* Una fila de jugador: punto de estado (rojo = su cliente está dentro), nick y
   agente. Muerto → tachado; sin cliente → en gris. */
function filaJugador(p) {
  const online = conCliente(p);
  const vivo = p.isAlive !== false;
  const agente = p.agentProper || p.agentInternal || '';
  return (
    `<div class="jug" data-online="${online}" data-vivo="${vivo}">` +
    `<i class="punto" aria-hidden="true"></i>` +
    `<span class="jug__nick">${escapa(p.name ?? '—')}</span>` +
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
  return (
    `<div class="jug" data-online="${online}" data-vivo="true" data-sala="1">` +
    `<i class="punto" aria-hidden="true"></i>` +
    `<span class="jug__nick">${escapa(nick)}</span>` +
    `<span class="jug__agente">${online ? 'con cliente' : 'en sala'}</span>` +
    `</div>`
  );
}

/* La sala se coloca por BANDO, no por índice: teamTwo son los atacantes y
   teamOne los defensores (así lo da el cliente de Riot). Cada lado del panel se
   rellena con el equipo cuyo bando coincide, para que salga con su color. Sin
   partido aún (no se sabe el bando de cada lado), se cae a defensa a la
   izquierda y ataque a la derecha. */
function salaDeLado(i) {
  if (SALA === null) return [];
  const ataque = SALA.equipoDos ?? [];
  const defensa = SALA.equipoUno ?? [];
  const t = M?.teams?.[i];
  if (t) return t.isAttacking ? ataque : defensa;
  return i === 0 ? defensa : ataque;
}

/* Firma de la sala, para el control de repintado (incluye quién está online). */
function salaFirma() {
  if (SALA === null) return '';
  const l = (a) => (a ?? []).map((j) => j.nombre + '#' + j.tag + (salaOnline(j) ? '*' : '')).join(',');
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
          .map((p) => `${p.name}:${p.agentProper || p.agentInternal}:${p.isAlive}:${conCliente(p)}`)
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
      $(`nombre-${i}`).textContent = '—';
      $(`meta-${i}`).textContent = enSala.length ? `En sala · ${enSala.length}` : 'sin partido';
      $(`roster-${i}`).innerHTML =
        enSala.map(filaSala).join('') || '<span class="apunte">Sin jugadores todavía.</span>';
      $(`logo-${i}`).style.backgroundImage = '';
      $(`score-${i}`).textContent = '0';
      // Sin partido: izquierda defensa, derecha ataque (arbitrario, como el mapeo).
      $(`lado-${i}`).dataset.bando = i === 0 ? 'def' : 'atk';
    }
    const obs = SALA?.observadores?.length ?? 0;
    $('d-ronda').textContent = SALA
      ? `En sala${obs ? ` · ${obs} obs.` : ''} (BETA)`
      : 'Sin partido';
    return;
  }

  const firma = firmaEquipos() + '|' + (M.roundNumber ?? '') + '|s' + salaFirma();
  if (marco.dataset.firmaGod === firma) return;
  marco.dataset.firmaGod = firma;

  (M.teams ?? []).forEach((t, i) => {
    if (i > 1) return;
    const jugadores = t.players ?? [];
    const conectados = jugadores.filter(conCliente).length;
    $(`nombre-${i}`).textContent = t.teamName || (i === 0 ? 'Izquierda' : 'Derecha');
    $(`meta-${i}`).textContent =
      `${t.isAttacking ? 'Ataque' : 'Defensa'} · ${conectados}/${jugadores.length || 5} conectados`;
    $(`score-${i}`).textContent = String(t.roundsWon ?? 0);
    // Tinte por bando, como en el juego.
    $(`lado-${i}`).dataset.bando = t.isAttacking ? 'atk' : 'def';
    $(`logo-${i}`).style.backgroundImage = t.teamUrl ? `url('${encodeURI(t.teamUrl)}')` : '';
    const enSala = salaDeLado(i);
    $(`roster-${i}`).innerHTML =
      jugadores.map(filaJugador).join('') ||
      enSala.map(filaSala).join('') ||
      '<span class="apunte">Sin jugadores todavía.</span>';
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
    caja.innerHTML = '<p class="apunte">Sin partido conectado.</p>';
    return;
  }
  const firma = firmaEquipos();
  if (caja.dataset.firma === firma) return;
  caja.dataset.firma = firma;

  caja.innerHTML = (M.teams ?? [])
    .map((t, i) => {
      const lado = i === 0 ? 'Izquierda' : 'Derecha';
      const bando = t.isAttacking ? 'Ataque' : 'Defensa';
      const jugadores = t.players ?? [];
      const conectados = jugadores.filter(conCliente).length;
      return (
        `<div class="equipo">` +
        `<span class="etiqueta">${lado} · ${bando} · ${t.roundsWon ?? 0} rondas</span>` +
        `<span class="valor" style="display:block;margin-top:4px">${escapa(t.teamName ?? '—')}</span>` +
        `<span class="apunte" style="display:block;margin-bottom:8px">${conectados}/${jugadores.length || 5} con cliente conectado</span>` +
        (jugadores.map(filaJugador).join('') || '<span class="apunte">Sin jugadores todavía.</span>') +
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

const FASES = {
  combat: 'Combate',
  shopping: 'Compra',
  end: 'Fin de ronda',
  game_end: 'Fin de mapa',
};

function pintaTira() {
  $('d-torneo').textContent = M?.tools?.tournamentInfo?.name || '—';
  $('d-mapa').textContent = M?.map || '—';
  $('d-fase').textContent = M === null ? '—' : (FASES[M.roundPhase] ?? M.roundPhase ?? '—');
  const ronda = $('d-ronda');
  if (ronda !== null && M !== null) ronda.textContent = `Ronda ${M.roundNumber ?? 1}`;
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
    $('estado-reloj').textContent = '--:--';
    if (reloj !== null) reloj.textContent = '--:--';
    return;
  }
  const resto = Math.max(0, Math.round(to.timeRemaining ?? 0));
  const txt = `${Math.floor(resto / 60)}:${String(resto % 60).padStart(2, '0')}`;
  $('estado-reloj').textContent = txt;
  if (reloj !== null) reloj.textContent = txt;
}

function pinta() {
  pintaTira();
  pintaMandos();
  pintaCampos();
  pintaGod();
  pintaEquipos();
  pintaReloj();
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

montaMandos();

try {
  vistaActiva(sessionStorage.getItem('easy.panel.vista') ?? 'directo');
} catch {
  vistaActiva('directo');
}

setInterval(pintaReloj, 250);

/** Muestra el aviso de «inicia sesión» cuando no hay cuenta abierta. */
function pideLogin(motivo) {
  $('panel').hidden = true;
  const a = $('asistente');
  a.hidden = false;
  a.innerHTML =
    '<div style="display:flex;justify-content:center;padding:60px 0">' +
    '<div class="panel" style="width:min(440px,100%)">' +
    '<div class="panel__cabeza"><h2 class="display">Sin sesión</h2></div>' +
    '<div class="panel__cuerpo">' +
    `<p class="apunte">${motivo ?? 'Entra con tu cuenta de Easy HUD en el programa para abrir la consola de realización.'}</p>` +
    '</div></div></div>';
  $('rotulo-asistente').hidden = false;
  pintaEstado('Sin sesión', false);
}

/**
 * Arranca el panel con la sesión que le pasa el programa.
 *
 * El panel vive SOLO dentro del exe. No hay versión web: la sesión no se pide
 * por cookie ni hay pantalla de login aquí, llega inyectada en la dirección
 * (`endpoint`/`groupCode`/`token`) que pone el propio programa desde su sesión
 * ya iniciada.
 *
 * Que no haya modo web es a propósito y se decidió así: tenerlo en dos sitios
 * —servido por el VPS y empaquetado en el exe— era el mismo fichero bajo dos
 * raíces distintas, y eso ya produjo dos fallos reales (el botón de salir
 * dejaba el panel en blanco, y la dirección de OBS salía con el token dentro).
 * Una sola casa, un solo modo.
 */
function inicia() {
  const p = new URLSearchParams(location.search);
  const grupo = p.get('groupCode');
  const token = p.get('token');

  if (!grupo || !token) {
    return pideLogin('El programa todavía no ha entregado una sesión de emisión.');
  }

  cuenta = {
    endpoint: p.get('endpoint') || location.origin,
    grupo,
    token,
    /* Dónde apuntar OBS. Lo manda el programa, que es quien sabe en qué puerto
       levantó su servidor local; el valor de aquí es solo el reparto por
       defecto para no quedarnos sin nada que enseñar. */
    obs: p.get('obs') || 'http://localhost:5310/',
  };
  modoPanel();
}

inicia();

/* Cerrar sesión es cosa del programa, no del panel: el panel no tiene cookie
   que borrar ni sitio a donde navegar. Mientras la sesión siga viviendo en el
   shell, el botón no se pinta — antes navegaba a `/salir`, que dentro del exe
   resuelve a una ruta inexistente y dejaba el panel en blanco sin vuelta
   atrás. Vuelve cuando el login se mude aquí. */
const botonSalir = $('a-salir');
if (botonSalir !== null) botonSalir.hidden = true;
