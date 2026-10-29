# La fuente de OBS

```
http://2.24.200.205:5300/?groupCode=CODIGO
```

Para el test: `http://2.24.200.205:5300/?groupCode=123`

**Una sola fuente de navegador, 1920×1080, y no se toca en todo el torneo.**
Dentro van las pantallas y las capas, y aparece lo que toca.

## De dónde salen los datos

El diseño y las animaciones son de Easy; los datos vienen del servidor propio
que corre en el VPS (`2.24.200.205`, puerto 5200). El observador
—el cliente que instalaste— saca el estado del juego por Overwolf y lo manda a
ese servidor; el overlay lo pide con el mismo `groupCode` que puso el operador.

El único fichero atado a ese servidor es `comun/fuente.js`: abre la conexión
(socket.io, `logon` + `match_data`) y traduce el estado del servidor al mismo
contrato que las pantallas ya pintaban (la traducción pura está en
`comun/traduccion.js`, con su test en `scratchpad`). Lo que el servidor no manda
como dato se **deduce** ahí —quién ganó la ronda, la ceremonia, el clutch, el
instante del plantado, el fin de mapa— y lo que ni se ve ni se deduce se queda
**sin pintar**: el **ADR / daño** no lo reporta el servidor, así que esa columna
va vacía en vez de enseñar un cero falso.

## Qué se ve y cuándo

Una pantalla de fondo y tres capas encima. La pantalla de fondo, la primera que
aplique:

| | |
|---|---|
| **Victoria** | La partida ha terminado |
| **Selección** | Fase de selección de agentes |
| **Compra** | Fase de compra |
| **Combate** | Lo demás, que es casi siempre |

Encima de la pantalla de fondo, **siempre montadas** y cada una escondida hasta
que le toca:

- **Ceremonia de ronda**: sale al acabar la ronda y se va sola.
- **Pausa**: tiempo muerto o pausa técnica. No tapa el marcador ni las tarjetas.
- **Avisos**: el rótulo del operador (**solo en la fase de compra**, como en el
  original: en combate taparía el juego), los **patrocinadores** y la **marca de
  agua**. Estos dos últimos están siempre que el operador los active.
## Por qué marcos y no todo en una página

Cada pantalla trae su hoja de estilos, y cuatro clases se repiten entre ellas
(`banda`, `muro`, `reticula`, `extruido`). Cargadas juntas, la última gana y
rompe a las otras — y el CSS se aplica **aunque el elemento esté oculto**, así
que esconder no basta.

Un marco es un ámbito de estilos de verdad: cada diseño queda exactamente como
se hizo, sin tocarle una línea.

El precio es una conexión por pantalla. El servidor solo reparte estado, así
que siete sockets le cuestan lo mismo que uno.

## Nada tapa el juego

Las pantallas son **transparentes**: detrás va el vídeo y nada en el camino
lo oscurece. Lo que se quitó, porque venía de mirar los diseños sueltos en un
navegador:

- La **captura del juego** que cada paquete traía de fondo para encuadrar.
- El **color de página** opaco (`var(--ink)`) de cada pantalla.
- El **velo** de la ceremonia, que atenuaba la pantalla entera en cada ronda
  ganada. El cartel destaca por sí mismo.

La única que sigue cubriendo es la de **victoria**, y es su diseño: el muro
tipográfico y el escudo necesitan suelo, y además es el final del mapa.

Y esta fuente se encarga de que **la barra superior la dibuje una sola pantalla**: la de
combate la lleva siempre; a las demás se les pasa `&barra=0`, o se verían dos
barras solapadas.

## Lo que cambia sin que nadie toque la fuente

Se enciende solo con lo que dice el servidor, y por eso la fuente se deja
puesta y no se vuelve a tocar durante el partido:

- **El modo mínimo** (`tools.minimal`). Lo conmuta el operador desde el panel
  (botón «Minimal HUD» de los mandos, o Settings → On-air display) y apaga la
  franja de arriba —marcador, chip de ronda, aletas, marcadores de serie e
  historial de mapas— para cuando el realizador pone su propio marcador. Las
  tarjetas de jugador se quedan. Se puede deshacer en mitad de la emisión.
- **La prórroga.** El chip de ronda deja de contar rondas y dice
  «prórroga 1», «prórroga 2». La ronda en la que empieza sale de las reglas
  del servidor (`firstOtRound`), no hay ningún 25 escrito.
- **La cuenta de la spike** sale de `spikeDetonationTime` del servidor: si se
  recarga la fuente de OBS con la spike plantada, sigue donde iba. Si el reloj
  del PC y el del servidor difieren más de 3 s, se usa el instante en que el
  overlay la vio plantada.

Y los **marcadores de serie** salen de los mapas de verdad: el servidor anota
qué mapa se juega y cómo acabó, así que las casillas dicen cuáles ganó cada
equipo y cuál está en marcha. La tira de mapas de arriba a la izquierda enseña
los jugados, el actual y el **siguiente** («Next: X», o «Decider: X» si es el
decisivo).

## Campos del servidor que el overlay lee

Rama `copia-funcional`. Adaptados de ValoSpectra/Spectra-Frontend
(Elastic License 2.0). Todos se configuran desde el panel (Settings) y viajan
en `match_data`:

| Campo | Qué hace en pantalla |
|---|---|
| `tools.seedingInfo` | Cabeza de serie bajo el tricode de cada equipo (combate y compra). Va con el equipo: si cambian de lado, el texto se va con él. |
| `tools.nameOverrides` | Alias de jugador en tarjetas, tablero de compra, selección y pie de la cámara. El nombre real se sigue usando para armar la cámara. |
| `tools.roundWinBox` | Decoración de la ceremonia de ronda: nada (por defecto), logo y fondo del torneo, o un patrocinador elegido por equipo ganador y tipo de ronda. |
| `tools.minimal` | Modo mínimo (arriba). |
| `toastInfo.eventLogoEnabled` | El rótulo lleva también el logo del torneo. |
| `tools.playercamsInfo.removeTricodes` | El servidor quita el tricode del nombre; el overlay no cambia (usa `fullName` para cámaras y alias). |
| `iconNameSuffix` | El retrato de Clove («Not Dead Yet»), Vyse y Astra se marca con un aro. Clove muerta sigue mostrando su habilidad E. |
| `switchRound` / `firstOtRound` | El historial de la compra corta donde dice el formato y pone la marca «⇄» de cambio de lado y «OT n» en cada prórroga. |

**Decisiones**: los defensores van siempre a la izquierda (verde) y los
atacantes a la derecha (rojo); no hay modo 1v1; el crédito de la compra es el
de antes de comprar. El arte de especiales de Riot no se guarda en el
repositorio, por eso los iconos especiales se marcan con un aro y no se
cambian.
## Parámetros

| | |
|---|---|
| `groupCode` | Obligatorio. El código de grupo del observador (se acepta `room` como alias) |
| `&endpoint=` | Cambia el servidor. Por defecto `http://2.24.200.205:5200` |
| `&dev=1` | Escribe en una esquina qué pantalla está saliendo y por qué |
| `&demo=1` | Solo para maquetar: cada pantalla enseña sus datos de ejemplo. No se usa en directo |
| `&palabra=CAMPEÓN` | Cambia la palabra de la pantalla de victoria |

## Para verlo funcionando

```bash
npm run escena -- directo
```

Levanta una partida y te da la URL ya con el fondo puesto.

Y para las cuatro que en una partida normal hay que esperar —o no llegan
nunca— cada una monta su situación y la repite:

```bash
npm run escena -- duelo
```

```bash
npm run escena -- minimo
```

```bash
npm run escena -- serie
```

```bash
npm run escena -- prorroga
```
