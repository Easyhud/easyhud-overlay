# Contexto de datos para el rediseño del HUD

Documento para pegar como contexto en una herramienta de diseño, junto con
`easy-hud-static.html`. **No contiene criterio de diseño**: solo qué variables
existen, de dónde salen, cuáles pueden faltar y qué restricciones técnicas hay.

---

## Qué es

Easy HUD son gráficos de emisión para torneos de VALORANT. El HUD es una página
web que se pone como fuente de navegador en OBS, encima del vídeo del juego.

Tres piezas: unos clientes leen el juego, un servidor junta el estado, y el
overlay lo pinta. El overlay **solo pinta**: no calcula nada, no pide nada, no
guarda nada.

## Cómo llega el dato

Dos canales distintos:

**Estado completo**, unas 10 veces por segundo, y solo si algo cambió. Es una
foto de cómo están las cosas ahora.

**Sucesos**, cuando ocurren. Son instantes, no estados: una baja, una
ceremonia, un plantado. Si se pierde, se pierde.

Todo lo que depende de un reloj llega como **instante** (`plantedAt`,
`startedAt`, en milisegundos epoch), nunca como cuenta atrás. El overlay
calcula lo que queda con su propio reloj: así va suave aunque la red vaya a
saltos.

---

## LA REGLA QUE MANDA: procedencia

El estado **no rellena huecos con valores plausibles**. Dice qué sabe y de
dónde lo sabe. Cada jugador lleva un bloque `provenance` con cuatro campos, y
cada uno vale uno de estos:

| Valor | Significa |
|---|---|
| `observer` | Lo dice el cliente del observador de la partida |
| `player` | Lo dice el propio cliente de ese jugador |
| `derived` | Lo ha deducido el servidor. Plausible, no medido |
| `operator` | Lo ha puesto a mano el operador. Manda sobre todo |
| `none` | **No hay dato** |

Las dos consecuencias que un rediseño no puede romper:

**La vida solo es real si `provenance.health` vale `player`.** En cualquier
otro caso el número que llega es un 0 o un 100 derivados de si está vivo. Con
procedencia distinta de `player`, **no se pinta barra ni número de vida**: se
esconde. Una barra que solo tiene dos posiciones parece una medida sin serlo.

**Las habilidades solo son reales si `provenance.abilities` vale `player`.**
Pero aquí la regla se aplica al revés que con la vida, y conviene entender por
qué: **sin datos se pinta el kit completo a brillo normal.**

No es una excepción. Sin cliente de jugador no existe la distinción entre
disponible y gastada, así que no hay nada que señalar. Un icono a brillo normal
dice "este agente tiene esta habilidad" —cierto, y útil— sin afirmar
disponibilidad. Atenuarlos para marcar "no lo sé" no comunica eso: comunica que
algo está roto.

Con datos, entonces sí: brillo para disponible, atenuado para gastada.

La diferencia con la vida es que una barra de vida **siempre afirma una
medida**, y por eso hay que esconderla cuando no la hay. Un icono de habilidad
puede existir sin afirmar estado.

Esto pasa de verdad y a menudo: la vida y las habilidades salen de un cliente
que corre cada jugador en su PC, y en un torneo comunitario es normal que
algunos no lo instalen. El HUD tiene que estar bien con los diez, con cinco y
con ninguno.

---

## Variables

### Partida

| Campo | Tipo | Notas |
|---|---|---|
| `phase` | `lobby` · `agentSelect` · `shopping` · `combat` · `roundEnd` · `gameOver` | Qué se pinta depende de esto |
| `round` | número | Empieza en 1. 0 antes de empezar |
| `map` | texto | Nombre del mapa. Puede venir vacío |
| `observedRiotId` | texto o `null` | A quién sigue la cámara del observador |

No existe una entidad "ronda": la ronda es un número más una fase.

### Reglas (configurables por partida, no constantes)

`roundsToWin` (13 por defecto), `switchRound` (13: primera ronda de la segunda
mitad, donde los equipos cambian de bando), `overtimeStartRound` (25),
`overtimeRoundsToWin` (2), `timeoutsPerTeam` (2), `timeoutDurationSec` (60).

En prórroga la ronda se numera desde el inicio de la prórroga: "prórroga 2", no
"ronda 27".

### Spike

`status`: `none` · `carried` · `planted` · `defused` · `detonated`
`plantedAt`: instante del plantado en ms epoch, o `null`.

El post-plant dura 45 segundos. El overlay calcula lo que queda desde
`plantedAt`.

### Equipos

Siempre **exactamente dos**. Los índices 0 y 1 son estables durante la partida:
0 se pinta a la izquierda, 1 a la derecha. El bando lo pone el juego y **cambia
a mitad de partida**; la posición en pantalla no cambia nunca.

| Campo | Tipo | Notas |
|---|---|---|
| `side` | `attack` · `defense` | Cambia en `switchRound` |
| `name` | texto | Nombre completo. Lo teclea el operador |
| `shortName` | texto | Trigrama. Normalmente 3 letras, pero es texto libre |
| `logoUrl` | texto | URL. **Puede venir vacío**, y suele venirlo |
| `seeding` | texto | Línea libre: "Grupo A", "Semifinal". Puede estar vacía |
| `roundsWon` | número | |
| `mapsWon` | número | Mapas de la serie. Lo lleva el operador |
| `timeoutsRemaining` | número | |
| `players` | hasta 5 | **Puede estar vacío** antes de que llegue el roster |
| `roundHistory` | lista | Una entrada por ronda jugada |

Cada entrada de `roundHistory`: `round`, `side` (el bando que tenía ese equipo
esa ronda), `won`, y `reason`: `elimination` · `defuse` · `detonate` ·
`timeout` · `unknown`. `unknown` es un valor legítimo y aparece.

### Jugador

| Campo | Tipo | Notas |
|---|---|---|
| `identity.riotId` | texto | Clave primaria. Es lo único estable |
| `identity.displayName` | texto | **Lo que se pinta.** Nicks reales, pueden ser largos, llevar espacios, emojis o etiquetas de equipo delante |
| `position` | 0–4 | Orden dentro del equipo |
| `agentName` | texto | Nombre comercial: `Neon`, `KAY/O`. Puede estar vacío antes de la selección |
| `agentInternal` | texto | Nombre en clave del juego: `Sprinter`. No se pinta |
| `alive` | booleano | |
| `health` | 0–100 | **Solo real con `provenance.health === 'player'`** |
| `armor` | `none` · `light` · `heavy` · `regen` | |
| `weapon` | texto | Nombre comercial del arma más cara. **Puede venir vacío** |
| `hasSpike` | booleano | |
| `isObserved` | booleano | Si es a quien sigue la cámara. Cambia cada pocos segundos |
| `abilities` | 3 booleanos: `grenade` (C), `ability1` (Q), `ability2` (E) | Hay al menos una carga lista, o ninguna. **No significa «sin usar»** |
| `abilities.charges` | 3 números o `null`, **opcional** | Cargas que quedan, **solo si la plataforma las da**. Si no viene, se pinta un solo estado y NO contadores |
| `ultimate.points` / `.max` / `.ready` | números y booleano | `max` varía por agente, entre 6 y 8 |
| `money` | número | 0 a ~9000 |
| `stats` | `kills`, `deaths`, `assists`, `killsThisRound` | |

#### Las cargas de las habilidades, con detalle

Es la parte más fácil de diseñar mal, así que va explicada.

Lo único garantizado es el booleano, y significa **hay al menos una carga
lista** o **no queda ninguna**. No significa «usada»: muchas habilidades se
recargan durante la ronda —el teleport de Chamber, el dash de Neon, las de
Reyna—, así que el `false` vuelve a `true` sin que empiece una ronda nueva.

`charges` llega **solo si la plataforma manda el número**. Y hoy no se sabe si
lo manda: el análisis del producto de referencia lo leyó como booleano y el
catálogo público de claves no publica ejemplo de esta clave. El cliente acepta
las dos formas, así que una partida grabada lo resuelve sin tocar código.

Lo que hay que respetar al diseñar:

- **Si `charges` viene**, se pueden pintar contadores o puntos, y un `0` es un
  cero de verdad.
- **Si no viene**, un solo estado por habilidad: lista o gastada. Nada de
  puntitos, porque no se sabría cuántos encender.
- **Un hueco no es un cero.** `null` es «no se sabe» y se pinta como el resto
  de lo desconocido, no como vacío.

Y no se puede deducir el número: con un booleano, gastar una de dos cargas no
cambia nada; las que se recargan lo cambian dos veces; y las cargas **se
compran**, así que ni el máximo es fijo por agente. El catálogo de Riot tampoco
publica las cargas — solo nombre, descripción e icono.

La ultimate es el caso contrario, y por eso sí se puede pintar con puntos:
`points` y `max` son números reales que llegan del scoreboard del observador,
para los diez y siempre.

#### Y una cosa que no existe

**La vida de los diez sin que cada jugador corra su cliente.** No hay otra
vía.

### Marca de la emisión

`tournamentName`, `tournamentLogoUrl` (puede estar vacío), `watermark` (texto
libre del organizador), `showKdaInCombat` (booleano: si el operador quiere ver
K/D/A en vez de dinero mientras están vivos), `minimal` (booleano: modo
reducido).

`palette`: `attack`, `defense`, `accent`, `background`, `text`. **Son variables
del estado de la partida, no constantes**: el operador las cambia en vivo y un
mismo servidor sirve a torneos con marcas distintas. Cualquier color de bando
que se use tiene que salir de aquí.

`toast`: `visible`, `title`, `message`, `teamIndex` (0, 1 o `null`). Es un
rótulo libre que escribe el operador: "volvemos en cinco", un problema técnico,
un anuncio.

`sponsors`: `enabled`, `rotateMs`, `urls[]`. Imágenes que rotan.

### Serie

`mapsToWin` (1 = un solo mapa) y `maps[]` con `name`, `state`
(`past` · `live` · `upcoming`) y `score` (`[n, n]` o `null`).

---

## Sucesos

| Suceso | Lleva |
|---|---|
| `kill` | matador, víctima, hasta 4 asistencias, arma, `headshot`, `teamkill` |
| `spikePlanted` / `spikeDefused` / `spikeDetonated` | quién lo hizo |
| `roundStart` | — |
| `roundEnd` | equipo ganador, bando, motivo, ceremonia (hoy siempre `roundWin`) |
| `matchStart` / `matchEnd` | — |
| `timeoutStart` / `timeoutEnd` | tipo y equipo |
| `stale` / `fresh` | milisegundos de silencio |

En un `kill`, el nombre del matador o de la víctima **puede no resolverse**: la
fuente los identifica por nombre y no siempre casan con el roster. Cuando pasa,
el `riotId` viene vacío y solo hay nombre. Ese caso tiene que verse distinto de
un jugador identificado, porque significa que no se sabe de qué equipo es.

**Ceremonias: hay una sola, `roundWin`.** Y es una decisión, no una carencia
temporal.

La plataforma no da ninguna ceremonia. Ni ace, ni clutch, ni flawless: todas
habría que deducirlas contando el killfeed y muestreando quién está vivo, y esa
deducción se equivoca en cuanto se pierde una baja —un cliente reconectando, un
mensaje descartado—. Un cartel de ACE equivocado delante de público no se
arregla con una disculpa, y el que no se lleva el suyo lo recuerda.

Así que el cartel de fin de ronda dice lo que se sabe con certeza: **quién ganó
la ronda y por qué** (eliminación, desactivada, detonada, tiempo). El diseño no
necesita prever cinco variantes: una.

`stale` significa que el cliente del observador dejó de mandar datos. El HUD
**congela lo último que tenía y lo señala**; nunca se vacía. En directo, un
marcador quieto con un aviso se puede explicar; un marcador que desaparece, no.

---

## Piezas

### Existen (están en el HTML)

| Pieza | De qué vive |
|---|---|
| Barra superior | trigramas, logos, seeding, `roundsWon`, `round`, bandos, pips de serie |
| Pastilla de spike | `spike.status` + `spike.plantedAt` |
| Tarjetas de combate, 10 | todo el bloque Jugador |
| Killfeed | sucesos `kill` |
| Aviso de estado | conexión y `stale` |
| Rótulo del operador | `broadcast.toast` |
| Marca de agua | `broadcast.watermark` |

### No existen todavía (hay que diseñarlas)

| Pieza | Cuándo aparece | De qué vive |
|---|---|---|
| Scoreboard de fase de compra | `phase === 'shopping'` | los 10 jugadores con K/D/A, dinero, gasto de ronda, equipo |
| Historial de rondas | fase de compra | `roundHistory` de los dos equipos, con cambio de bando y prórrogas |
| Banner de fin de ronda | tras `roundEnd`, unos 3 s | ceremonia, equipo ganador, motivo, número de ronda |
| Tiempo muerto | `timeout !== null` | tipo, equipo, `startedAt`, `durationSec`, tiempos restantes |
| Caja de patrocinador | si `sponsors.enabled` | lista de URLs que rota |
| Pantalla de espera | `phase === 'lobby'` | marca del torneo, cuenta atrás |

---

## Restricciones técnicas

### Resolución: un solo diseño a 1920×1080

Se diseña a 1920×1080 y **una sola vez**. No hacen falta variantes por
resolución, porque todas las que se usan en emisión son 16:9:

| Emisión | Lienzo | Factor |
|---|---|---|
| 720p | 1280×720 | ×0,667 |
| 1080p | 1920×1080 | ×1 |
| 1440p | 2560×1440 | ×1,333 |
| 4K | 3840×2160 | ×2 |

Al ser la misma relación de aspecto, el factor sale idéntico en los dos ejes:
no se recorta nada, no aparecen franjas y no hay nada que truncar. El overlay
se escala entero con una transformación.

Solo un lienzo que NO sea 16:9 (un 21:9 ultrapanorámico, por ejemplo) dejaría
franjas a los lados, y eso es lo correcto: estirar el HUD para llenarlas
rompería las proporciones de todo.

**El arte tiene margen de sobra hacia arriba.** Los iconos de agente vienen a
512×512 y se pintan a 54 px; los de habilidad a 128×128 pintados a 16 px. A 4K
siguen sin llegar a su resolución nativa, así que ampliar no los degrada.

### El límite real está hacia ABAJO, no hacia arriba

Muchos torneos comunitarios emiten a 720p por ancho de banda. Ahí todo el
fotograma se reduce a dos tercios, incluido el HUD, y hay un punto por debajo
del cual el texto deja de leerse:

| Tamaño de diseño | En un stream a 720p | |
|---|---|---|
| 10 px | 6,7 px | no se lee |
| 11 px | 7,3 px | no se lee |
| 12 px | 8 px | límite |
| 15 px | 10 px | bien |
| 19 px | 12,7 px | bien |
| 46 px | 30,7 px | bien |

**Regla práctica: nada de texto por debajo de 12 px en el diseño de 1920.**

En el HUD actual eso lo incumplen cinco cosas, y conviene subirlas en el
rediseño: el nombre del arma (10 px) y la etiqueta de ronda, el marcador de
headshot, las asistencias, el aviso de estado y la marca de agua (11 px).

Con las líneas finas pasa lo mismo: **nada por debajo de 3 px de grosor**, que
a 720p ya se queda en 2. En el HUD actual la barra de vida son 3 px y es el
mínimo que aguanta.

**Fondo transparente.** Debajo va el vídeo del juego en movimiento. Nada puede
asumir un fondo.

**Va a través de compresión de vídeo**, del orden de 6.000 kbps. Lo que el
codificador destruye primero: degradados suaves, sombras grandes y difusas,
texto fino sobre fondo translúcido, y contrastes bajos entre grises medios.

### La franja superior está LIBRE

VALORANT da a los observadores un **HUD mínimo, con una casilla en el lobby de
la partida personalizada**. Con esa casilla activada:

- **desaparece** la barra nativa de arriba, la de los diez retratos con el
  marcador
- **el reloj de ronda se queda**, en una caja negra pequeña arriba al centro
- se quedan el minimapa, el HUD inferior del jugador observado y su nombre

Tres consecuencias para el diseño, y las tres importan:

**No hay que cubrir nada.** La franja de arriba es espacio libre. La barra
puede tener el tamaño, la posición y la opacidad que convenga al diseño, no la
que imponga una huella ajena.

**No se dibuja cronómetro propio.** El nativo está ahí y es exacto. Dibujar un
segundo reloj estimado al lado del bueno solo puede salir mal.

**Hay que convivir con la caja del reloj.** Está arriba al centro y mide
alrededor de 125 × 65 px sobre lienzo 1920×1080 —medido a ojo, pendiente de
confirmar sobre una captura sin comprimir—. El diseño tiene que enmarcarla,
dejarle un hueco o absorberla aprovechando que ya es oscura. Lo que no puede
es ignorarla y ponerle algo encima a medias.

### Lo que el juego no da, y no se puede reconstruir

Tres cosas que la plataforma no entrega y que **no se pueden reconstruir de
ninguna manera**:

**El cronómetro de ronda.** El juego no expone el reloj por datos. Pero con el
HUD mínimo el reloj nativo **sigue en pantalla y es exacto**, así que no hay
que reconstruirlo: hay que dejarle sitio.

**El minimapa.** No hay posiciones ni coordenadas en ningún dato. Es imposible.
(Cuando en los datos aparece "posición" se refiere a la ranura 0–4 dentro del
equipo, no a un punto del mapa.)

**La munición** del jugador espectado. No está en ninguna parte.

Las tres siguen dibujándolas el juego con el HUD mínimo activado, así que no
son huecos del producto: son piezas que el diseño hereda y con las que tiene
que convivir.

**Zonas que hay que respetar porque el juego las usa**: arriba a la izquierda
el minimapa, arriba al centro la caja del reloj, y abajo al centro la tira de
habilidades y munición del jugador observado. Todo lo demás está libre — y con
el HUD mínimo, la franja superior a los lados del reloj es el mejor sitio de la
pantalla.

El post-plant se señala de forma no numérica, sin conflicto con el reloj.

**El estado llega ~10 veces por segundo.** Cualquier animación que se reinicie
con cada dato nuevo parpadeará sin parar.

**Nada se vacía nunca.** Si se cae la conexión, se conserva lo último y se
avisa.

## Restricciones de marca (no negociables)

- Se escribe `Easy HUD`, dos palabras. Nunca `easyHUD`.
- **El naranja no se usa como color de marca**, por riesgo con easyGroup.
- Toda superficie distribuida lleva el descargo: no está afiliado ni respaldado
  por Riot Games.
- El arte de agentes, habilidades y armas es de Riot y se sirve desde el CDN;
  no se redistribuye.

---

## Nota de configuración (no es diseño, pero decide la nitidez)

La fuente de navegador de OBS hay que ponerla **a la resolución del lienzo**,
no a 1920×1080. Es decir: en una emisión a 1440p, la fuente se crea a
2560×1440 y el HUD se escala solo a ×1,333, rasterizando el texto a resolución
nativa.

Si en cambio se crea la fuente a 1920×1080 y luego se estira en la escena de
OBS, lo que se amplía es un mapa de bits ya rasterizado a 1080p, y el texto
sale blando garantizado. Es el error más común y no se arregla desde el
diseño.

---

## Vías cerradas: no volver a investigarlas

Esto costó una sesión larga y seis hipótesis equivocadas. La respuesta era la
casilla de HUD mínimo del lobby. Estas seis rutas están descartadas con
pruebas:

| Ruta | Por qué no |
|---|---|
| Truco del canal alfa en OBS | El alfa de VALORANT es basura indefinida, lo dice el desarrollador principal de OBS. Funciona a ratos, que es peor que nunca |
| Hook propio de D3D para separar capas | Es inyección; Vanguard busca eso. El hook de OBS solo coge el fotograma final, así que no sirve — y es GPL, contaminaría el producto |
| Filtro "Remove HUD" de NVIDIA | Riot desactivó los filtros de NVIDIA tras el bug de inmunidad a flashes |
| Forzar Freestyle con Profile Inspector | Mismo resultado que el ajuste del juego, con todo el riesgo y cero ganancia |
| Editar el `.ini` | Un fichero de configuración no crea funciones. No hay clave de HUD, y además la config local es solo caché: los ajustes viajan a la nube de Riot |
| Resolución, relación de aspecto o DSR | DSR no cambia proporciones. El aspecto sí, pero más ancho la encoge y 4:3 la agranda, y ninguno la quita |

## Ajustes del observador antes de emitir

No los documenta nadie en este ecosistema, así que forman parte del producto.

**En el lobby**: activar la casilla de **HUD mínimo** para el observador. Es lo
que libera la franja superior conservando reloj y minimapa.

**En Ajustes → General**, sección del mapa:

| Ajuste | Valor | Por qué |
|---|---|---|
| Tamaño del minimapa | subirlo | En emisión el mapa es información principal, no auxiliar |
| Zoom del minimapa | ajustar hasta ver el mapa entero | El espectador necesita el contexto completo |
| Conos de visión | **activados** | Se ve de un vistazo hacia dónde mira cada equipo |
| Rotar minimapa | desactivado | Orientación fija: referencia estable para espectador y comentarista |
| Trasladar minimapa | desactivado | Igual |
| Teclas sobre el minimapa | desactivado | Ruido |

**Teclas útiles del observador**: `V` cámara libre, `1`–`9` seguir jugador,
`[` y `]` engancharse a otro observador, `Shift` + número para saltar a la
cámara cinematográfica de esa acción, `F` para seguir un proyectil.
