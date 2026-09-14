/* ══ EL ENLACE DEL PANEL ════════════════════════════════════════════════════
   El panel habla por DOS caminos, y la separación es deliberada:

     - Escucha `match_data` por el mismo sitio que el overlay (puerto de
       salida, sala = código de grupo). Ve exactamente lo que sale en antena,
       ni más ni menos. Si el panel y la emisión discrepan, es un fallo.

     - Manda por el espacio `/operador`, que es otro socket y otra puerta.

   ## Por qué dos, y no uno

   El token que ve el overlay viaja en la URL de la fuente de navegador de OBS:
   el cliente lo ve, puede pasárselo a un amigo y no hay forma de evitarlo. Es
   un billete al portador, y sirve para lo que sirve: que un desconocido no se
   alimente de este servidor.

   Mover la emisión no puede colgar de un billete así. Por eso el mando va por
   su propio canal, con su propio token, con el rol firmado dentro.

   ## Las órdenes

   Ninguna orden reimplementa nada del servidor. Cada una se traduce al MISMO
   paquete que manda la tecla correspondiente del PC del observador y entra por
   la misma puerta. El panel y las teclas no pueden desincronizarse porque son
   la misma cosa vista desde dos sitios.                                     */

import { io } from '../../comun/vendor/socket.io.esm.min.js';

/**
 * Abre las dos conexiones.
 *
 * La dirección, el grupo y la licencia NO se leen aquí de la URL: los decide
 * el asistente y los guarda. Este módulo sólo transporta.
 *
 * @param {object} p
 * @param {string} p.endpoint
 * @param {string} p.grupo
 * @param {string} p.token
 * @param {(match: object) => void} p.alEstado         llega el estado de antena
 * @param {(e: {ok: boolean, motivo?: string}) => void} p.alEntrar
 * @param {(msg: string) => void} p.alFallar
 */
export function conecta({ endpoint, grupo, token, alEstado, alEntrar, alFallar, alSala }) {
  /* ── Lo que sale en antena ─────────────────────────────────────────────── */
  const mirada = io(endpoint, { transports: ['websocket'] });

  mirada.on('connect', () => {
    mirada.emit('logon', JSON.stringify({ groupCode: grupo, token }));
  });

  mirada.on('match_data', (crudo) => {
    try {
      alEstado(typeof crudo === 'string' ? JSON.parse(crudo) : crudo);
    } catch (e) {
      console.error('[panel] match_data ilegible', e);
    }
  });

  /* La sala leída del cliente de Riot por el observador (BETA): quién va
     entrando y en qué lado, ANTES de que empiece la partida. */
  mirada.on('sala', (crudo) => {
    if (!alSala) return;
    try {
      alSala(typeof crudo === 'string' ? JSON.parse(crudo) : crudo);
    } catch (e) {
      console.error('[panel] sala ilegible', e);
    }
  });

  mirada.on('logon_denied', (crudo) => {
    alFallar(`El servidor no deja ver este grupo: ${motivoDe(crudo)}`);
  });

  mirada.on('connect_error', () => {
    alFallar(`No se llega a ${endpoint}. ¿Está encendido el servidor?`);
  });

  /* ── El mando ──────────────────────────────────────────────────────────── */
  const mando = io(`${endpoint}/operador`, { transports: ['websocket'] });

  mando.on('connect', () => {
    mando.emit('operador_logon', JSON.stringify({ groupCode: grupo, token }));
  });

  mando.on('operador_listo', () => alEntrar({ ok: true }));
  mando.on('operador_denegado', (crudo) => alEntrar({ ok: false, motivo: motivoDe(crudo) }));
  mando.on('operador_error', (crudo) => alFallar(motivoDe(crudo)));
  mando.on('disconnect', () => alEntrar({ ok: false, motivo: 'conexión perdida' }));

  /* El canal de operador todavía no existe en el servidor. Mientras no exista,
     socket.io reintenta en silencio y el panel se queda en sólo lectura, que
     es exactamente lo que debe pasar: se mira, no se toca. */
  mando.on('connect_error', () => alEntrar({ ok: false, motivo: 'el servidor no tiene canal de mando' }));

  return {
    /**
     * Manda una orden de directo. Son las que ya existen como teclas.
     *
     * `pausaTecnica`, `kdaCreditos`, `intercambiaLados` e `intercambiaBandos`
     * son INTERRUPTORES en el servidor: no se les dice a qué posición ir, se
     * les dice que cambien. Mandar la posición deseada invitaría a pelearse
     * con la tecla del observador si los dos actúan a la vez.
     */
    orden(tipo, datos) {
      mando.emit('orden', JSON.stringify({ tipo, datos: datos ?? null }));
    },

    /**
     * Cambia la configuración guardada. Es un PARCHE, no un reemplazo: sólo
     * viajan las claves que se tocan, para que dos personas con el panel
     * abierto en dos sitios no se pisen los campos que no han mirado.
     */
    parchea(parche) {
      mando.emit('configura', JSON.stringify(parche));
    },

    cierra() {
      mirada.close();
      mando.close();
    },
  };
}

function motivoDe(crudo) {
  try {
    return JSON.parse(crudo).reason ?? 'rechazado';
  } catch {
    return 'rechazado';
  }
}
