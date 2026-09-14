/* ADAPTADOR — sustituye a los datos de ejemplo de la fase de compra.
   =================================================================

   El fichero que salió de diseño (`datos-compra.js`) era un tablero escrito a
   mano. Esto habla con el servidor y construye la misma forma, con los mismos
   nombres, así que el pintor no ha tenido que cambiar: solo se le llama
   cuando hay datos nuevos en lugar de una vez al cargar.

   La pantalla se rehace entera en cada cambio, y aquí sí se puede: el tablero
   de compra cambia cuando alguien compra, no diez veces por segundo. */

import { esMinimo, etiquetaRonda, serieDeMapas } from '../../comun/partida.js';
import { abreFuente } from '../../comun/fuente.js';

/** Pistolas, para saber qué hueco ocupa el arma que llega. */
const PISTOLAS = new Set(['classic', 'shorty', 'frenzy', 'ghost', 'sheriff', 'bandit']);

const MOTIVOS = {
  elimination: 'elim',
  detonate: 'detonate',
  defuse: 'defuse',
  timeout: 'time',
};

/**
 * El arma que llega, en su hueco. **Solo esa, sea la que sea.**
 *
 * El juego manda UNA arma —la que se lleva en la mano— y este tablero tiene
 * dos huecos. Se coloca en el que le toca por su clase y el otro se queda
 * vacío: no se rellena con lo que "seguramente" tenga.
 *
 * Se decidió así a propósito. En VALORANT todos llevan al menos la Classic,
 * o sea que se podría suponer; pero quien compró una Sheriff y lleva el
 * rifle en la mano aparecería con una Classic que no tiene. Un hueco vacío
 * no dice nada falso; un arma inventada, sí.
 *
 * El cuchillo va al hueco de secundaria: es el arma de reserva de todos, y
 * ese hueco es el que ocupa en el tablero.
 */
function armas(nombre) {
  if (nombre === null || nombre === '') return { primaria: null, secundaria: null };

  const clave = nombre.toLowerCase();
  return PISTOLAS.has(clave) || clave === 'melee'
    ? { primaria: null, secundaria: clave }
    : { primaria: clave, secundaria: null };
}

/**
 * Cargas por habilidad, en número.
 *
 * El tablero pinta un rombo por uso. Si la plataforma no manda las cargas
 * —hoy no se sabe si las manda—, se pone una: decir dos sin saberlo sería
 * afirmar que tiene dos usos.
 */
function cargas(player) {
  const hayDatos = player.provenance?.abilities === 'player';
  const ab = player.abilities ?? {};
  return ['grenade', 'ability1', 'ability2'].map((tecla) => {
    if (!hayDatos) return 1;
    const n = ab.charges?.[tecla] ?? null;
    return n === null ? (ab[tecla] ? 1 : 0) : n;
  });
}

/**
 * Las cinco filas, ordenadas por bajas descendentes.
 *
 * Es lo que hace el producto de referencia y tiene sentido en un tablero de
 * economía: lo que se busca de un vistazo es quién está llevando la ronda, no
 * en qué orden entró la gente a la partida.
 *
 * El comparador está completo a propósito. El suyo, con las bajas empatadas,
 * devuelve `-1` cuando el primero tiene menos muertes y **cero** cuando tiene
 * más —le falta el caso simétrico— así que su «menos muertes primero» no está
 * garantizado. Con cinco elementos y un motor estable casi nunca se nota, y
 * por eso lleva ahí tiempo.
 *
 * El tercer criterio es la posición, y no es un adorno: sin él, dos jugadores
 * con las mismas bajas y las mismas muertes podrían intercambiarse de sitio
 * entre dos repintados, y una fila que salta mientras se mira no se lee.
 */
function porBajas(a, b) {
  if (b.bajas !== a.bajas) return b.bajas - a.bajas;
  if (a.muertes !== b.muertes) return a.muertes - b.muertes;
  return a.posicion - b.posicion;
}

function jugador(player, agentes, posicion) {
  const stats = player.stats ?? { kills: 0, deaths: 0, assists: 0 };
  const danoReal = player.provenance?.damage === 'player';
  const { primaria, secundaria } = armas(player.weapon);
  const gasto = player.spentThisRound ?? 0;

  return {
    nick: player.identity?.name ?? '',
    agente: (agentes[player.agentInternal] ?? player.agentName ?? '').toLowerCase(),
    escudo: player.armor ?? 'none',
    secundaria,
    primaria,
    ult: player.ultimate?.points ?? 0,
    ultMax: player.ultimate?.max ?? 1,
    kda: `${stats.kills}/${stats.deaths}/${stats.assists}`,
    /*
     * EL DAÑO. Está en el estado y **no se pinta todavía**: el hueco en pantalla
     * lo decide Antonio, y el diseño es suyo.
     *
     * Lo que hace esto es que ese día no haya que tocar nada más que el HTML y
     * el CSS —el dato ya está aquí, con el mismo criterio que la vida—:
     *
     *   `adr` es `null` cuando no se sabe, NUNCA cero. Un jugador sin su
     *   cliente puesto no ha hecho 0 de daño. Pintar un cero ahí es afirmar
     *   algo falso sobre una persona con su nombre al lado.
     *
     * `danoConocido` está por lo mismo que `vidaConocida`: para que el diseño
     * pueda esconder la columna entera en lugar de dejar diez guiones.
     */
    adr: danoReal ? (player.damage?.adr ?? null) : null,
    dano: danoReal ? (player.damage?.total ?? 0) : null,
    danoRonda: danoReal ? (player.damage?.thisRound ?? 0) : null,
    cabezasPct: danoReal ? (player.damage?.headshotPct ?? null) : null,
    danoConocido: danoReal,
    /* Para ordenar. El diseño no los pinta por separado, pinta el K/D/A. */
    bajas: stats.kills,
    muertes: stats.deaths,
    posicion,
    /* El crédito del tablero es el de ANTES de comprar; el servidor manda el
       que queda y lo gastado, así que se suma. */
    credito: (player.money ?? 0) + gasto,
    gasto,
    cargas: cargas(player),
  };
}

function construye(match, agentes) {
  /*
   * El historial va por EQUIPO: la fila de arriba es el equipo 0, la de abajo
   * el equipo 1 (igual que el marcador). La victoria de cada ronda va a la fila
   * del equipo que la ganó, así se lee el cambio de momentum tras el cambio de
   * mitad —que era justo lo que se perdía cuando iba por bando—. El color de la
   * marca lo pone el BANDO que tenía ese equipo esa ronda (verde atacando, rojo
   * defendiendo), que es el lenguaje de color del resto del overlay.
   *
   * El índice de equipo es fijo (0/1), no se reordena con el tablero: si se
   * reordenara por bando, las marcas de un mismo equipo saltarían de fila en la
   * ronda 13 y no se leería la racha.
   */
  const rondas = new Map();
  match.teams.forEach((team, i) => {
    for (const r of team.roundHistory ?? []) {
      if (!r.won) continue;
      rondas.set(r.round, { equipo: i, bando: r.side, motivo: MOTIVOS[r.reason] ?? 'elim' });
    }
  });
  const jugadas = rondas.size === 0 ? 0 : Math.max(...rondas.keys());
  const ganadores = [];
  const bandos = [];
  const motivos = [];
  for (let n = 1; n <= jugadas; n += 1) {
    const r = rondas.get(n);
    /*
     * `null` cuando la fuente no dice quién ganó esa ronda —pasa cuando el
     * observador se conectó tarde o el estado perdió el registro—. NO se cae a
     * un equipo por defecto: eso pintaba un ganador falso. Sin dato, celda neutra.
     */
    ganadores.push(r ? r.equipo : null);
    bandos.push(r ? r.bando : null);
    motivos.push(r ? r.motivo : null);
  }

  /*
   * Las filas del tablero van por BANDO: la mitad izquierda es el ataque.
   * El contrato ordena los equipos como los puso el operador, así que hay que
   * ponerlos en orden de bando o el tablero saldría cambiado de lado cada
   * segunda mitad.
   */
  const orden = match.teams[0].side === 'attack' ? [0, 1] : [1, 0];
  const mapas = serieDeMapas(match);

  return {
    ronda: match.round,
    /* «compra 7», o «prórroga 2» si toca: lo mismo que dice el chip de
       combate, calculado en el mismo sitio para que no se contradigan. */
    etiquetaRonda: etiquetaRonda(match, 'compra'),
    minimo: esMinimo(match),
    equipos: orden.map((i) => {
      const team = match.teams[i];
      return {
        tricode: team.shortName,
        nombre: team.name,
        tanto: team.roundsWon,
        logo: team.logoUrl,
        tiempos: team.timeoutsRemaining,
        tiemposTotal: match.rules?.timeoutsPerTeam ?? 0,
      };
    }),
    serie: orden.map((i) => match.teams[i].mapsWon),
    /* Los marcadores de serie de verdad, con el mapa en curso señalado.
       Ojo: `serieDeMapas` los da por ÍNDICE DE EQUIPO y este tablero va por
       bando, así que se reordenan igual que todo lo demás. */
    serieMapas: orden.map((i) => mapas.estados[i]),
    titulosMapas: orden.map((i) => mapas.titulos[i]),
    mapasParaGanar: match.series?.mapsToWin ?? 0,
    jugadores: orden.map((i) =>
      match.teams[i].players.map((p, k) => jugador(p, agentes, k)).sort(porBajas),
    ),
    jugadas,
    ganadores,
    bandos,
    motivos,
  };
}

/* ── Entrada y salida del tablero ────────────────────────────────────────── */

/**
 * El tablero entra al empezar la compra y sale al empezar el combate.
 *
 * Es lo que hace que esta pantalla se pueda dejar puesta como una fuente fija
 * de OBS: aparece sola cuando toca y se va sola, sin que nadie toque nada
 * durante el partido.
 *
 * La salida hay que **esperarla**: si se escondiera el tablero en el mismo
 * momento de pedirla, no se vería. Por eso se oculta al acabar la animación
 * y no antes.
 */
const MS_MOVER = 300;
/** El desfase entre filas del CSS: la última acaba después que la primera. */
const MS_DESFASE = 38 * 4;

let faseAnterior = '';
let temporizador;

/**
 * Mientras el tablero entra o sale, NO se repinta.
 *
 * Es el fallo que hacía que la entrada se viera rota. El pintor rehace las
 * filas enteras, y unas filas nuevas heredan la clase de entrada del tablero
 * y **vuelven a lanzar la animación desde cero**. Durante la compra llegan
 * repintados cada pocos segundos —y a veces dos seguidos con 100 ms de
 * diferencia—, así que la animación se reiniciaba sin llegar a terminar
 * nunca: parecía lenta y parecía rota, y era lo mismo.
 *
 * Así que mientras dura el movimiento se guarda el último dato y se pinta al
 * acabar. Son 450 ms en los que la economía no cambia.
 */
let moviendo = false;
let pendiente = null;

function pintaSiSePuede(datos) {
  if (moviendo) { pendiente = datos; return; }
  window.pintaCompra(datos);
  animaCompras(datos);
}

function acabaMovimiento(tablero, ocultar) {
  moviendo = false;
  tablero.classList.remove('es-entra', 'es-sale');
  if (ocultar) tablero.style.visibility = 'hidden';
  if (pendiente !== null) {
    const datos = pendiente;
    pendiente = null;
    pintaSiSePuede(datos);
  }
}

function mueveTablero(fase, datos) {
  /** @type {HTMLElement} */
  const tablero = document.querySelector('.tablero');
  if (tablero === null || fase === faseAnterior) return;

  const entraba = faseAnterior === 'shopping';
  faseAnterior = fase;
  clearTimeout(temporizador);

  if (fase === 'shopping') {
    /*
     * Se pinta ANTES de animar. Si se animara primero, el tablero entraría
     * con el contenido de la ronda anterior y daría un salto al llegar el
     * nuevo.
     */
    window.pintaCompra(datos);
    pendiente = null;
    tablero.style.visibility = '';
    tablero.classList.remove('es-sale');
    tablero.classList.add('es-entra');
    moviendo = true;
    temporizador = setTimeout(() => acabaMovimiento(tablero, false), MS_MOVER + MS_DESFASE);
    return;
  }

  // Solo se sale si se estaba dentro; si no, se arranca ya escondido.
  if (!entraba) {
    tablero.style.visibility = 'hidden';
    return;
  }

  tablero.classList.remove('es-entra');
  tablero.classList.add('es-sale');
  moviendo = true;
  temporizador = setTimeout(() => acabaMovimiento(tablero, true), MS_MOVER + MS_DESFASE);
}

/* ── La animación de compra ──────────────────────────────────────────────── */

/**
 * Cuando alguien gasta, su fila lo acusa.
 *
 * Se compara con lo que gastaba antes: el estado dice cuánto lleva gastado,
 * no que acabe de comprar. Y se lanza DESPUÉS de pintar, porque el tablero se
 * rehace y la clase se perdería.
 */
const gastoAnterior = new Map();

function animaCompras(datos) {
  const mitades = document.querySelectorAll('.mitad');
  datos.jugadores.forEach((equipo, lado) => {
    equipo.forEach((p, k) => {
      const clave = `${lado}:${k}`;
      const previo = gastoAnterior.get(clave);
      gastoAnterior.set(clave, p.gasto);
      if (previo === undefined || p.gasto <= previo) return;

      // Las mitades salen en orden de fila: izquierda, derecha, izquierda…
      const mitad = mitades[k * 2 + lado];
      if (mitad === undefined) return;
      mitad.classList.add('es-compra');
      setTimeout(() => mitad.classList.remove('es-compra'), 420);
    });
  });
}

/* ── Conexión ────────────────────────────────────────────────────────────── */

/*
 * La fuente es ValoSpectra (ver `comun/fuente.js`): entrega el mismo contrato
 * `match` que este tablero ya sabía leer, así que el pintor no cambia. Solo se
 * mantiene la firma para no repintar sin motivo y el manejo de entrada/salida
 * del tablero, que pinta por su cuenta.
 */
let firma = '';

const { AGENTE_POR_INTERNO } = await import('./catalogo.js');

abreFuente({
  onMatch: (match) => {
    const datos = construye(match, AGENTE_POR_INTERNO);
    const ahora = JSON.stringify(datos);
    const cambio = ahora !== firma;
    firma = ahora;

    const antes = faseAnterior;
    mueveTablero(match.phase, datos);
    if (antes === faseAnterior && cambio) pintaSiSePuede(datos);
  },
});

/*
 * Módulo, aunque el `import` sea dinámico: sin esto TypeScript lo trata como
 * un script suelto y no admite el `await` de nivel superior.
 */
export {};
