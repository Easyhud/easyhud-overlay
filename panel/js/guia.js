/* ══ «¿QUÉ HAGO AHORA?» ═════════════════════════════════════════════════════
   Un panel vacío no dice qué falta. Esta función mira lo que el panel sabe —la
   conexión, el partido, la sala, los clientes de los jugadores— y devuelve EL
   siguiente paso, en una frase y con un nivel:

     bien    todo en orden, se puede emitir
     espera  falta algo que llega solo (conectando, jugadores entrando)
     falta   falta algo que tiene que hacer el operador

   Lógica pura, sin DOM: se prueba con estados de ejemplo.                    */

/**
 * @param {{
 *   permiso: 'sin-sesion' | 'conectando' | 'sin-mando' | 'ok',
 *   M: any,
 *   escena: string,
 *   hayLobby: boolean,
 * }} s
 * @returns {{ nivel: 'bien' | 'espera' | 'falta', titulo: string, texto: string, accion: null | 'reconectar' | 'crear-sala' }}
 */
export function siguientePaso(s) {
  if (s.permiso === 'sin-sesion') {
    return { nivel: 'falta', titulo: 'Not signed in', texto: 'Sign in with your account to start. Nothing can be controlled until you do.', accion: null };
  }
  if (s.permiso === 'conectando') {
    return { nivel: 'espera', titulo: 'Connecting…', texto: 'Connecting to the server. This takes a few seconds.', accion: null };
  }
  if (s.permiso === 'sin-mando') {
    return {
      nivel: 'falta',
      titulo: 'Read only',
      texto: 'You can see the broadcast but not control it. Press “Reconnect everything”; if it stays like this, sign out and in again.',
      accion: 'reconectar',
    };
  }

  const M = s.M;
  const equipos = M?.teams ?? [];
  const jugadores = equipos.flatMap((t) => t.players ?? []);

  if (M === null || M === undefined) {
    return s.hayLobby
      ? { nivel: 'espera', titulo: 'Lobby open', texto: 'Waiting for the observer to enter the match. Open the game and spectate the custom game.', accion: null }
      : { nivel: 'falta', titulo: 'No match yet', texto: 'Start a match from Matches, then press “Create lobby” and share the code with the players.', accion: 'crear-sala' };
  }

  if (jugadores.length === 0) {
    return { nivel: 'espera', titulo: 'Waiting for the players', texto: 'The match exists but nobody has joined. Share the lobby code; each player must have Easy HUD open.', accion: null };
  }

  const sinCliente = jugadores.filter((p) => {
    const a = p?.auxiliaryAvailable;
    return !(a && (a.health === true || a.abilities === true || a.scoreboard === true));
  }).length;
  const fase = String(M.roundPhase ?? '');

  if (fase.toUpperCase() === 'LOBBY' || /^agent select$/i.test(s.escena)) {
    if (jugadores.length < 10) {
      return { nivel: 'espera', titulo: 'Players joining', texto: `${jugadores.length}/10 players in. The game starts when everyone has picked an agent.`, accion: null };
    }
    return { nivel: 'bien', titulo: 'Agent select', texto: 'All 10 players are in. Waiting for the game to start.', accion: null };
  }

  if (sinCliente > 0) {
    return {
      nivel: 'falta',
      titulo: `${sinCliente} player${sinCliente === 1 ? '' : 's'} without the app`,
      texto: 'Their health and abilities will not show on air. Ask them to open Easy HUD, or use “Call players”. You can go on air without them.',
      accion: null,
    };
  }
  return { nivel: 'bien', titulo: 'Ready', texto: `Round ${M.roundNumber ?? 1}. Everything is connected.`, accion: null };
}
