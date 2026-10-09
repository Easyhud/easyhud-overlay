/* EL PUENTE — del estado del diseño a la memoria del módulo.
   =========================================================

   Del otro lado del puente, `combate/js/datos.js` ya ha hecho su trabajo: ha
   hablado con el servidor y ha traducido su contrato al vocabulario del
   diseño. Esto NO vuelve a traducir nada ni añade nada: coge ese mismo estado
   —el que lee la versión DOM, campo por campo— y lo deja escrito como números
   en una zona de memoria.

   Es deliberado que aquí no haya ni una decisión. Si el observador no manda la
   vida de alguien, aquí sale `vidaConocida` a cero, igual que allí, y es el
   wasm quien decide que eso se pinta como un hueco. La regla de "un cero falso
   se lee como una baja" vive donde se pinta, no donde se copia.

   Lo único que el puente resuelve por su cuenta es el reloj de la spike: el
   estado trae el INSTANTE del plantado en hora del día, y el wasm mide
   intervalos con el reloj monótono del navegador. Traducir de un reloj al otro
   hay que hacerlo aquí, donde se sabe qué hora es. */

/* Las ranuras. Este mapa y el de `assembly/estado.ts` son el mismo acuerdo
   escrito dos veces; si uno cambia, el otro también. */
const G_MINIMO = 0, G_FASE = 1, G_MAPAS = 2, G_TXT_RONDA = 3, G_SPIKE_FIN = 4,
  G_TXT_MARCA = 5, G_CONECTADO = 6, G_TXT_SIN_DATO = 7,
  G_IMG_OJO = 8, G_IMG_SPIKE = 9, G_IMG_CREDITOS = 10;

const EQ_BASE = 16, EQ_PASO = 8;
const EQ_LOGO = 0, EQ_TRI = 1, EQ_TANTOS = 2, EQ_N_SERIE = 3, EQ_SERIE = 4;

const JU_BASE = 32, JU_PASO = 32;
const JU_PRESENTE = 0, JU_NICK = 1, JU_KDA = 2, JU_AGENTE = 3, JU_ULTI = 4,
  JU_ARMA = 5, JU_VIVO = 6, JU_VIDA_OK = 7, JU_VIDA = 8, JU_ESCUDO = 9,
  JU_ULT = 10, JU_ULT_MAX = 11, JU_CREDITO = 12, JU_SPIKE = 13,
  JU_OBSERVADO = 14, JU_TXT_ESCUDO = 15, JU_HAB = 16, JU_TXT_VIDA = 25;

const FASES = { buy: 0, combat: 1, roundEnd: 2, agentSelect: 3, mapEnd: 4 };

/** Los valores de escudo del diseño. `regen` vale lo mismo que `light`. */
const ESCUDOS = { heavy: 50, light: 25, regen: 25, none: 0 };

/**
 * El arte local del overlay.
 *
 * En la versión DOM son rutas relativas a `combate/`, y esta página vive en
 * otra carpeta. Se resuelven contra la ubicación de este módulo para que
 * funcione igual servido desde cualquier sitio.
 */
const LOCAL = (nombre) => new URL("../../combate/assets/" + nombre, import.meta.url).href;

export class Puente {
  constructor(memoria, base, recursos) {
    this.base = base;
    this.R = recursos;
    this.buffer = null;
    this.memoria = memoria;
    this.mira();

    this.idOjo = recursos.imagen(LOCAL("ojo.svg"));
    this.idSpike = recursos.imagen(LOCAL("spike-ink.png"));
    this.idCreditos = recursos.imagen(LOCAL("credits-icon.webp"));

    /* La marca de agua es texto fijo del marcado, no dato del servidor. */
    this.idMarca = recursos.texto("EASY OPEN · easyhud.net");
    this.idSinDato = recursos.texto("sin dato de vida");
  }

  /** La memoria puede crecer; entonces las vistas viejas dejan de valer. */
  mira() {
    if (this.buffer === this.memoria.buffer) return;
    this.buffer = this.memoria.buffer;
    this.i = new Int32Array(this.buffer, this.base, 512);
    this.f = new Float32Array(this.buffer, this.base, 512);
  }

  /**
   * Vuelca una foto del estado.
   *
   * @param estado El estado del diseño, tal cual lo publica `datos.js`.
   * @param ahora  El reloj monótono, para traducir el instante del plantado.
   */
  escribe(estado, ahora) {
    this.mira();
    const i = this.i;
    const f = this.f;
    const R = this.R;

    i[G_MINIMO] = estado.minimo === true ? 1 : 0;
    i[G_FASE] = FASES[estado.fase] ?? 1;
    i[G_MAPAS] = estado.mapasParaGanar ?? 2;
    i[G_TXT_RONDA] = R.texto(estado.etiquetaRonda ?? "");
    i[G_TXT_MARCA] = this.idMarca;
    i[G_TXT_SIN_DATO] = this.idSinDato;
    i[G_CONECTADO] = 1;
    i[G_IMG_OJO] = this.idOjo;
    i[G_IMG_SPIKE] = this.idSpike;
    i[G_IMG_CREDITOS] = this.idCreditos;

    /* De la hora del día al reloj monótono: se manda el instante en que
       explota, no los segundos que quedan, para que la cuenta vaya suave a
       sesenta fotogramas por segundo aunque el estado llegue a saltos. */
    const plantada = estado.spike?.plantadaEn ?? null;
    if (plantada === null) {
      f[G_SPIKE_FIN] = -1;
      R.sitioSpike = "";
    } else {
      const resto = Math.max(0, (estado.spikeSegundos ?? 45) - (Date.now() - plantada) / 1000);
      f[G_SPIKE_FIN] = ahora + resto * 1000;
      R.sitioSpike = estado.spike.sitio ?? "";
    }

    for (let t = 0; t < 2; t++) {
      const b = EQ_BASE + t * EQ_PASO;
      const equipo = estado.equipos?.[t] ?? {};
      i[b + EQ_LOGO] = R.imagen(equipo.logo ?? "");
      i[b + EQ_TRI] = R.texto(equipo.tricode ?? "");
      i[b + EQ_TANTOS] = R.texto(String(equipo.tantos ?? 0));

      const casillas = estado.serie?.estados?.[t] ?? [];
      i[b + EQ_N_SERIE] = Math.min(8, casillas.length);
      let empaque = 0;
      for (let k = 0; k < casillas.length && k < 8; k++) {
        const v = casillas[k] === "gana" ? 1 : (casillas[k] === "en-curso" ? 2 : 0);
        empaque |= v << (k * 3);
      }
      i[b + EQ_SERIE] = empaque;
    }

    for (let lado = 0; lado < 2; lado++) {
      const fila = estado.jugadores?.[lado] ?? [];
      for (let k = 0; k < 5; k++) {
        this.jugador(lado, k, fila[k]);
      }
    }
  }

  jugador(lado, k, p) {
    const i = this.i;
    const f = this.f;
    const R = this.R;
    const b = JU_BASE + (lado * 5 + k) * JU_PASO;

    if (p === undefined || p === null) {
      i[b + JU_PRESENTE] = 0;
      return;
    }

    i[b + JU_PRESENTE] = 1;
    i[b + JU_NICK] = R.texto(p.nick ?? "");
    i[b + JU_KDA] = R.texto(p.kda ?? "0/0/0");
    i[b + JU_AGENTE] = R.imagen(iconoAgente(p.agente));
    i[b + JU_ULTI] = R.imagen(iconoUltimate(p.agente));
    i[b + JU_ARMA] = R.imagen(iconoArma(p.arma));
    i[b + JU_VIVO] = p.vivo ? 1 : 0;

    /* La vida solo es una medida si viene del cliente del propio jugador. En
       cualquier otro caso el servidor manda un 0 o un 100 deducidos de si está
       vivo, y eso no es vida. */
    const conDato = p.vivo && p.vidaConocida === true;
    i[b + JU_VIDA_OK] = p.vidaConocida === true ? 1 : 0;
    f[b + JU_VIDA] = conDato ? (p.vida ?? 0) : 0;
    i[b + JU_TXT_VIDA] = R.texto(String(p.vivo ? (conDato ? p.vida : 0) : 0));

    const escudo = ESCUDOS[p.escudo] ?? 0;
    i[b + JU_ESCUDO] = escudo;
    i[b + JU_TXT_ESCUDO] = R.texto(String(escudo));

    i[b + JU_ULT] = p.ult ?? 0;
    i[b + JU_ULT_MAX] = Math.max(1, p.ultMax ?? 1);
    i[b + JU_CREDITO] = R.texto((p.credito ?? 0).toLocaleString("es-ES"));
    i[b + JU_SPIKE] = p.spike === true ? 1 : 0;
    i[b + JU_OBSERVADO] = p.observado === true ? 1 : 0;

    for (let h = 0; h < 3; h++) {
      const dato = p.habilidades?.[h];
      const hay = p.vivo && dato !== null && dato !== undefined;
      i[b + JU_HAB + h * 3] = hay ? R.imagen(iconoHabilidad(p.agente, h)) : -1;
      i[b + JU_HAB + h * 3 + 1] = hay ? dato.tiene : 0;
      i[b + JU_HAB + h * 3 + 2] = hay ? Math.max(1, dato.max) : 0;
    }
  }
}

/* El catálogo y las direcciones del CDN son los MISMOS de la versión DOM: se
   importan, no se copian. Un identificador que se desviara sería un icono roto
   en directo. */
import { iconoAgente, iconoArma, iconoHabilidad, iconoUltimate } from "../../combate/js/cdn.js";
