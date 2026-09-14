# La fuente de OBS

```
http://2.24.200.205:5300/?groupCode=CODIGO
```

Para el test: `http://2.24.200.205:5300/?groupCode=123`

**Una sola fuente de navegador, 1920×1080, y no se toca en todo el torneo.**
Dentro van las siete pantallas y aparece la que toca.

## De dónde salen los datos

El diseño y las animaciones son de Easy; los datos vienen del servidor de
**ValoSpectra** que corre en el VPS (`2.24.200.205`, puerto 5200). El observador
—el cliente que instalaste— saca el estado del juego por Overwolf y lo manda a
ese servidor; el overlay lo pide con el mismo `groupCode` que puso el operador.

El único fichero atado a ese servidor es `comun/fuente.js`: abre la conexión
(socket.io, `logon` + `match_data`) y traduce el estado de ValoSpectra al mismo
contrato que las pantallas ya pintaban (la traducción pura está en
`comun/traduccion.js`, con su test en `scratchpad`). Lo que ValoSpectra no manda
como dato se **deduce** ahí —quién ganó la ronda, la ceremonia, el clutch, el
instante del plantado, el fin de mapa— y lo que ni se ve ni se deduce se queda
**sin pintar**: el **ADR / daño** no lo reporta ValoSpectra, así que esa columna
va vacía en vez de enseñar un cero falso.

## Qué se ve y cuándo

Manda lo más excepcional. La primera que aplique:

| | |
|---|---|
| **Victoria** | La partida ha terminado |
| **Selección** | Fase de selección de agentes |
| **Pausa** | Hay un tiempo muerto |
| **Aviso** | El operador ha puesto un rótulo |
| **Compra** | Fase de compra |
| **Combate** | Lo demás, que es casi siempre |

La **ceremonia de ronda** no está en esa lista porque no sustituye a nada:
sale encima del combate y se va sola. Va en su propia capa, por delante.

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

Tres cosas se encienden solas con lo que dice el servidor, y por eso la fuente
se deja puesta y no se vuelve a tocar durante el partido:

- **El duelo 1 contra 1.** Cuando queda exactamente un vivo por bando —y solo
  en combate— las otras ocho tarjetas se van y las dos supervivientes se
  juntan en el centro. Al haber dos o más vivos en cualquier bando, vuelve la
  lista. Sin cámaras: el vídeo de los duelistas lo compone el realizador.
- **El modo mínimo.** Lo conmuta el operador desde su panel y apaga la franja
  de arriba —marcador, chip de ronda, aletas y marcadores de serie— para
  cuando el realizador pone su propio marcador. Se puede deshacer en mitad de
  la emisión.
- **La prórroga.** El chip de ronda deja de contar rondas y dice
  «prórroga 1», «prórroga 2». La ronda en la que empieza sale de las reglas
  del formato, no hay ningún 25 escrito.

Y los **marcadores de serie** salen de los mapas de verdad: el servidor anota
qué mapa se juega y cómo acabó, así que las casillas dicen cuáles ganó cada
equipo y cuál está en marcha. El operador no escribe nada; si quiere, puede
dejar los nombres de los siguientes puestos con `setSeries`.

## Parámetros

| | |
|---|---|
| `groupCode` | Obligatorio. El código de grupo del observador (se acepta `room` como alias) |
| `&endpoint=` | Cambia el servidor. Por defecto `http://2.24.200.205:5200` |
| `&dev=1` | Escribe en una esquina qué pantalla está saliendo y por qué |
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
