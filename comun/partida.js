/* LO QUE TODAS LAS PANTALLAS CALCULAN IGUAL.
   =========================================

   Tres cuentas que salían tres veces, una por pantalla, y que tienen que dar
   el mismo resultado en las tres o el overlay se contradice consigo mismo:
   la etiqueta de la ronda, los marcadores de la serie y el modo mínimo.

   Vive aparte porque las pantallas son páginas distintas —cada una con su
   hoja de estilos y su pintor— pero el estado que leen es el mismo. Lo que se
   comparte es la LECTURA del contrato, nunca el pintado: cada diseño pinta
   lo suyo.
*/

/**
 * Lo que dice el chip de la ronda.
 *
 * En prórroga **no se sigue contando**: el número 26 no le dice nada a nadie,
 * y «PRÓRROGA 2» sí. La ronda en la que empieza sale de las reglas, que son
 * configurables a propósito —un torneo puede jugar a 9 o a 13—, así que esto
 * no lleva ningún 25 escrito.
 *
 * ## Cada prórroga son DOS rondas, no una
 *
 * Es el fallo que tenía esto: contaba una prórroga por ronda, así que las
 * rondas 25, 26, 27 y 28 salían como «prórroga 1, 2, 3 y 4». En VALORANT una
 * prórroga se juega **entera**, con las dos mitades —cada equipo ataca una
 * vez— y se gana por dos de diferencia. Las rondas 25 y 26 son la **misma**
 * prórroga.
 *
 * Se descubrió leyendo el producto de referencia, que lo cuenta por pares
 * (`round-number.component.ts:16-20` en el análisis del 11 de septiembre).
 * No es cuestión de estilo: decirle al público «prórroga 4» cuando va la
 * segunda es un dato mal.
 *
 * @param {any} match Estado de la partida del contrato.
 * @param {string} [prefijo] Lo que va delante en juego normal: `ronda`, `compra`.
 * @returns {string}
 */
export function etiquetaRonda(match, prefijo = 'ronda') {
  const ronda = match?.round ?? 1;
  const empieza = match?.rules?.overtimeStartRound ?? 0;

  if (empieza > 0 && ronda >= empieza) {
    /* Dos rondas por prórroga: (25,26) es la 1, (27,28) la 2, y así. */
    return `prórroga ${Math.floor((ronda - empieza) / 2) + 1}`;
  }
  return `${prefijo} ${ronda}`;
}

/**
 * Los marcadores de la serie, uno por mapa que hay que ganar.
 *
 * Hasta ahora esto solo contaba `mapsWon`, que lo lleva el operador a mano.
 * El contrato trae además `series.maps` —nombre, estado y marcador de cada
 * mapa— que **no lo leía nadie**: el dato viajaba entero y se tiraba.
 *
 * Con él, los marcadores dicen dos cosas más:
 *
 * - Cuáles ganó cada equipo sale del **resultado real** de cada mapa, no de
 *   que alguien se acordara de subir el contador.
 * - El mapa que se está jugando se señala aparte. Antes no se distinguía «va
 *   0-0 en la serie» de «este es el primero y está en marcha».
 *
 * Si `series.maps` viene vacío —una sala que nadie configuró— se cae a
 * `mapsWon` y queda exactamente como estaba. No se inventa nada.
 *
 * @param {any} match
 * @returns {{
 *   cuantos: number,
 *   estados: Array<Array<'gana' | 'en-curso' | 'vacio'>>,
 *   titulos: string[][],
 * }}
 */
export function serieDeMapas(match) {
  const cuantos = Math.max(0, match?.series?.mapsToWin ?? 0);
  const mapas = Array.isArray(match?.series?.maps) ? match.series.maps : [];

  const jugados = mapas.filter((m) => m?.state === 'past' && Array.isArray(m.score));
  const enCurso = mapas.some((m) => m?.state === 'live');

  /** Cuántos ganó cada equipo, del resultado de los mapas ya jugados. */
  const ganados = [0, 0];
  for (const mapa of jugados) {
    const [a, b] = mapa.score;
    if (a === b) continue; // Un mapa empatado no lo ganó nadie.
    ganados[a > b ? 0 : 1] += 1;
  }

  /* Sin mapas anotados, el contador del operador. */
  if (jugados.length === 0) {
    ganados[0] = match?.teams?.[0]?.mapsWon ?? 0;
    ganados[1] = match?.teams?.[1]?.mapsWon ?? 0;
  }

  const estados = [0, 1].map((i) =>
    Array.from({ length: cuantos }, (_, k) => {
      if (k < ganados[i]) return /** @type {const} */ ('gana');
      if (k === ganados[i] && enCurso) return /** @type {const} */ ('en-curso');
      return /** @type {const} */ ('vacio');
    }),
  );

  /*
   * Qué mapa es cada casilla, para el atributo `title`.
   *
   * El diseño no tiene sitio para escribir los nombres —los marcadores son
   * rectángulos de veinte píxeles— así que no se pintan. Se dejan a mano
   * porque al revisar una emisión saber qué mapa es cada casilla vale, y no
   * cuesta un píxel.
   *
   * Va por EQUIPO y en el mismo orden que las casillas, no en el orden de la
   * serie. Son dos cosas distintas: la casilla 2 del equipo de la izquierda
   * es «el segundo mapa que ganó», no «el segundo mapa que se jugó», y
   * ponerle el nombre del segundo de la serie sería mentir.
   */
  const nombre = (m) => {
    const marcador = Array.isArray(m?.score) ? ` ${m.score[0]}-${m.score[1]}` : '';
    return `${m?.name ?? ''}${marcador}`.trim();
  };
  const enJuego = mapas.find((m) => m?.state === 'live');

  const titulos = [0, 1].map((i) => {
    const suyos = jugados
      .filter((m) => {
        const [a, b] = m.score;
        return a !== b && (a > b ? 0 : 1) === i;
      })
      .map(nombre);
    return estados[i].map((estado, k) => {
      if (estado === 'gana') return suyos[k] ?? '';
      if (estado === 'en-curso') return nombre(enJuego);
      return '';
    });
  });

  return { cuantos, estados, titulos };
}

/**
 * Qué columnas lleva el historial de rondas de la compra, y dónde se corta.
 *
 * Antes iba escrito a fuego (1–12 y 13–24). Con un formato más corto o más
 * largo —el propio servidor dice cuándo cambian de lado y cuándo empieza la
 * prórroga— el corte quedaba mal. Ahora sale de las reglas:
 *
 *  - `reglas.switchRound`: la primera ronda de la segunda mitad (13).
 *  - `reglas.overtimeStartRound`: la primera ronda de la prórroga (25).
 *
 * Si no vienen, se asume el formato normal. La primera mitad va a la izquierda;
 * la segunda, a la derecha, con una marca de «cambio de lado» al principio y
 * una marca «OT n» antes de cada prórroga (cada una son DOS rondas). La segunda
 * mitad crece con la prórroga: las columnas aparecen según se juegan.
 *
 * Adaptado de ValoSpectra/Spectra-Frontend (Elastic License 2.0) — components/shopping/roundreasons/roundreasons.component.html
 * (marcas de `switchRound` y de `firstOtRound`).
 *
 * @param {{ switchRound?: number, overtimeStartRound?: number } | undefined} reglas
 * @param {number} jugadas La última ronda con resultado.
 * @returns {{ izq: Array<{ ronda: number }>, der: Array<{ ronda: number } | { cambio: true } | { ot: number }> }}
 */
export function planHistorial(reglas, jugadas) {
  const corte = (reglas?.switchRound ?? 0) > 1 ? reglas.switchRound : 13;
  const primeraOt = (reglas?.overtimeStartRound ?? 0) > corte ? reglas.overtimeStartRound : 2 * (corte - 1) + 1;
  const ultima = Math.max(primeraOt - 1, Math.max(0, jugadas ?? 0));

  const izq = [];
  for (let n = 1; n < corte; n += 1) izq.push({ ronda: n });

  const der = [{ cambio: true }];
  for (let n = corte; n <= ultima; n += 1) {
    if (n >= primeraOt && (n - primeraOt) % 2 === 0) der.push({ ot: (n - primeraOt) / 2 + 1 });
    der.push({ ronda: n });
  }
  return { izq, der };
}

/**
 * ¿Va el overlay en modo mínimo?
 *
 * Lo conmuta el operador desde su panel y sirve para **liberar la franja de
 * arriba**: cuando el realizador pone su propio marcador en OBS, dos
 * marcadores a la vez se pisan. Se quita la barra y se queda lo que solo
 * puede dar este overlay, que son las tarjetas.
 *
 * @param {any} match
 * @returns {boolean}
 */
export function esMinimo(match) {
  return match?.broadcast?.minimal === true;
}

/**
 * Los colores de un equipo, por su BANDO de ahora, no por su lado de pantalla.
 *
 * Era el «equipos al revés» del directo: cada pantalla pintaba la izquierda
 * con el color de ataque y la derecha con el de defensa, fijo. En la primera
 * mitad coincide (el equipo de la izquierda empieza atacando) y en la segunda
 * mitad —y en cada ronda de prórroga— sale justo al revés. Y la compra, para
 * «arreglarlo», cambiaba a los equipos de lado cada mitad, así que el marcador
 * de arriba saltaba de sitio entre la compra y el combate.
 *
 * La regla, para todas las pantallas: **cada equipo se queda en su lado**
 * (el que dicen `teams[0]` y `teams[1]`, igual que el marcador) y **el color
 * sigue al bando**. Si el bando no viene, se cae al de siempre por posición.
 *
 * @param {'attack' | 'defense' | string | undefined} bando
 * @param {number} posicion 0 = izquierda, 1 = derecha (solo para el defecto).
 * Colores: **el defensor es VERDE y el atacante ROJO**, en todas las pantallas. (Los nombres de
 * las variables vienen del diseño original, donde `--atk` era el verde: por eso el atacante usa
 * `--def` y el defensor `--atk`. Los valores de los tokens no se tocan porque otras cosas los usan.)
 *
 * @param {{ claroVerde?: string }} [op] La compra usa otro verde claro (el del defensor).
 * @returns {{ c: string, cl: string, ataca: boolean }}
 */
export function coloresDeBando(bando, posicion, op = {}) {
  const ataca = bando === 'attack' ? true : bando === 'defense' ? false : posicion === 0;
  return ataca
    ? { c: 'var(--def)', cl: 'var(--def-light)', ataca } // atacante: rojo
    : { c: 'var(--atk)', cl: op.claroVerde ?? 'var(--atk-light)', ataca }; // defensor: verde
}
