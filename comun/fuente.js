/* LA FUENTE — el único sitio atado al servidor de ValoSpectra.
   ===========================================================

   El diseño de Easy dejó una costura: cada `datos*.js` traduce un contrato
   `match` a la forma que pinta cada pantalla, y se conectaba con un WebSocket
   plano a un servidor propio. Aquí se cambia SOLO esa capa: el overlay ahora
   lee de un servidor de ValoSpectra (socket.io, `logon` + `match_data`) y este
   módulo convierte su estado `IMatchData` en el mismo contrato `match` que las
   pantallas ya esperaban. Por eso NINGÚN pintor ha tenido que tocarse.

   Este fichero se queda con el transporte y con lo que hay que RECORDAR entre
   mensajes para deducir lo que ValoSpectra no manda como dato (el instante del
   plantado, el arranque del tiempo muerto, las transiciones de ronda y de fin
   de mapa). El mapeo puro vive aparte, en `traduccion.js`, para poder probarse
   solo.

   ## Una sola conexión, muchos suscriptores

   Cada pantalla vive en su propio iframe —su propio contexto de JS— así que
   este módulo se carga una vez por pantalla y abre una conexión por pantalla,
   igual que hacía el WebSocket original. Dentro de un mismo contexto, varios
   `suscribe` comparten el socket. */

import { io } from './vendor/socket.io.esm.min.js';
import {
  traduceEstado,
  mapaDecidido,
  equipoGanador,
  ceremoniaDe,
  actualizaClutch,
  actualizaEconomia,
} from './traduccion.js';

/* ── Dirección y sala ────────────────────────────────────────────────────── */

const params = new URLSearchParams(location.search);

/** El servidor de ValoSpectra. Se puede sobreescribir con `?endpoint=`. */
/* Cuando el overlay lo sirve el PROPIO programa en la máquina (modo local, el
   que esconde el token), se conecta a ese mismo origen —el servidor local del
   exe, que releva al de verdad con el token en memoria— en vez de al servidor
   público. Una dirección de OBS antigua, o el uso por dominio, no cambian. */
const enLocal =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1';
export const ENDPOINT =
  params.get('endpoint') ?? (enLocal ? location.origin : 'http://2.24.200.205:5200');

/**
 * El código de grupo de ValoSpectra. Se acepta `?groupCode=` y también
 * `?room=`, que es como el overlay de Easy nombraba la sala: así una dirección
 * de OBS vieja sigue valiendo cambiando solo el servidor.
 */
/* En modo local, el grupo de la URL no importa: el servidor local del exe
   ignora lo que diga el navegador y usa el grupo real de la cuenta. Se pone un
   valor cualquiera para que el overlay arranque la conexión (si va vacío, no
   conecta). En web/dominio sigue exigiéndose el groupCode de siempre. */
export const GRUPO =
  params.get('groupCode') ?? params.get('room') ?? (enLocal ? 'local' : '');

/**
 * El token que abre la puerta del servidor, si el servidor la tiene cerrada.
 *
 * Va en la URL de la fuente de navegador de OBS, junto al código de grupo, y lo
 * emite el servidor por cliente y con caducidad. Si el servidor no exige token
 * —que es como está por defecto—, esto viaja vacío y no cambia nada: una
 * dirección de OBS antigua sigue funcionando igual.
 */
export const TOKEN = params.get('token') ?? '';

/* ── El socket, compartido dentro del contexto ───────────────────────────── */

const oyentes = new Set();
let socket = null;
let ultimoMatch = null;
let ultimosEventos = [];

/* Estado que hay que recordar entre mensajes para deducir lo que ValoSpectra
   no manda como dato. Vive por contexto (una pantalla), que es justo lo que
   hace falta: cada pantalla detecta sus propias transiciones sobre el mismo
   flujo. */
const memoria = {
  spikePlantadaEn: null,
  spikeActiva: false,
  tiempoInicio: null,
  tiempoActivo: false,
  ultimaRondaFin: -1,
  finAnunciado: false,
  clutch: [-1, -1],
  /* El equipamiento con el que cada equipo entró en la ronda, para la ronda
     ahorrada. Al terminar ya no se puede leer: los muertos sueltan el arma. */
  economia: { ronda: -1, valor: [0, 0] },
  faseAnterior: '',
};

function alMatchData(raw) {
  if (!raw || !Array.isArray(raw.teams)) return;

  /* Clutch: se sigue en cada estado, y se reinicia al empezar una ronda. */
  if (raw.roundPhase === 'shopping' && memoria.faseAnterior !== 'shopping') {
    memoria.clutch = [-1, -1];
  }
  actualizaClutch(raw, memoria.clutch);
  actualizaEconomia(raw, memoria.economia);

  const decidido = mapaDecidido(raw);
  const match = traduceEstado(raw, decidido);
  if (match.roomCode === '') match.roomCode = GRUPO;

  /* La spike: ValoSpectra manda booleanos, el diseño quiere el instante del
     plantado para contar con su propio reloj. */
  const sp = raw.spikeState ?? { planted: false, defused: false, detonated: false };
  const plantada = sp.planted === true && sp.defused !== true && sp.detonated !== true;
  if (plantada && !memoria.spikeActiva) memoria.spikePlantadaEn = Date.now();
  if (!plantada) memoria.spikePlantadaEn = null;
  memoria.spikeActiva = plantada;
  match.spike = { status: plantada ? 'planted' : 'idle', plantedAt: memoria.spikePlantadaEn, site: '' };

  /* El tiempo muerto: activo mientras ValoSpectra lo diga; el instante de
     arranque se marca una vez para que la cuenta atrás la lleve el navegador. */
  const to = raw.timeoutState ?? { techPause: false, leftTeam: false, rightTeam: false, timeRemaining: 0 };
  const tiempoActivo = to.techPause === true || to.leftTeam === true || to.rightTeam === true;
  if (tiempoActivo) {
    const dur = raw.tools?.timeoutDuration ?? 60;
    if (!memoria.tiempoActivo) {
      memoria.tiempoInicio = Date.now() - Math.max(0, dur - (to.timeRemaining ?? dur)) * 1000;
    }
    match.timeout = {
      durationSec: dur,
      startedAt: memoria.tiempoInicio,
      kind: to.techPause ? 'technical' : 'tactical',
      teamIndex: to.leftTeam ? 0 : to.rightTeam ? 1 : null,
    };
  } else {
    memoria.tiempoInicio = null;
    match.timeout = null;
  }
  memoria.tiempoActivo = tiempoActivo;

  /* Los sucesos: instantes que ValoSpectra no manda como tales y que aquí se
     deducen de las transiciones del estado. */
  const eventos = [];

  if (raw.roundPhase === 'end' && memoria.ultimaRondaFin !== raw.roundNumber) {
    memoria.ultimaRondaFin = raw.roundNumber;
    const ganador = equipoGanador(raw);
    eventos.push({
      type: 'roundEnd',
      winnerIndex: ganador,
      winnerSide: raw.teams?.[ganador]?.isAttacking ? 'attack' : 'defense',
      ceremony: ceremoniaDe(raw, ganador, memoria.clutch, memoria.economia),
    });
  }

  if (decidido && !memoria.finAnunciado) {
    memoria.finAnunciado = true;
    const a = raw.teams?.[0]?.roundsWon ?? 0;
    const b = raw.teams?.[1]?.roundsWon ?? 0;
    eventos.push({ type: 'matchEnd', winnerIndex: a >= b ? 0 : 1 });
  }
  if (!decidido) memoria.finAnunciado = false;

  memoria.faseAnterior = raw.roundPhase;

  ultimoMatch = match;
  ultimosEventos = eventos;
  for (const oyente of oyentes) {
    oyente.onMatch?.(match);
    if (eventos.length > 0) oyente.onEvents?.(eventos);
  }
}

function arranca() {
  if (socket !== null || GRUPO === '') return;

  socket = io(ENDPOINT, { reconnection: true, transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    socket.emit('logon', JSON.stringify({ groupCode: GRUPO, token: TOKEN }));
  });

  /*
   * Puerta cerrada. Conviene que se vea POR QUÉ y no solo que el HUD está en
   * negro: en directo, un overlay vacío sin explicación son diez minutos de
   * nervios buscando el fallo donde no está.
   *
   * No se reintenta: el servidor corta la conexión, socket.io vuelve a
   * intentarlo solo, y con el mismo token volverá a salir lo mismo. Lo que hay
   * que hacer es cambiar la URL, no insistir.
   */
  socket.on('logon_denied', (data) => {
    let motivo = 'sin motivo';
    try {
      motivo = (typeof data === 'string' ? JSON.parse(data) : data)?.reason ?? motivo;
    } catch { /* el motivo es un extra, no vale la pena romperse por él */ }
    console.error(
      `[Easy HUD] El servidor ha rechazado la conexión: ${motivo}.` +
      (TOKEN === '' ? ' La URL de OBS no lleva ningún token.' : ' Revisa el token de la URL de OBS.'),
    );
  });

  socket.on('match_data', (data) => {
    let raw = data;
    if (typeof data === 'string') {
      try {
        raw = JSON.parse(data);
      } catch {
        return;
      }
    }
    alMatchData(raw);
  });
}

/**
 * Suscribe una pantalla a la fuente.
 *
 * `onMatch(match)` llega con cada estado nuevo; `onEvents(eventos)` solo cuando
 * hay sucesos deducidos (fin de ronda, fin de mapa). Devuelve una función para
 * darse de baja. Si ya había un estado, se entrega en el acto para que una
 * pantalla que se conecta tarde no se quede en blanco.
 *
 * @param {{ onMatch?: (match: any) => void, onEvents?: (eventos: any[]) => void }} oyente
 */
export function abreFuente(oyente) {
  oyentes.add(oyente);
  arranca();
  if (ultimoMatch !== null) {
    oyente.onMatch?.(ultimoMatch);
    if (ultimosEventos.length > 0) oyente.onEvents?.(ultimosEventos);
  }
  return () => oyentes.delete(oyente);
}
