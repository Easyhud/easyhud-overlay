# Carteles — ronda ganada, pausa y avisos

Las tres pantallas de `ARTE/CARTELES`. **El CSS no se ha tocado.** Cada una
tiene su pintor y las tres comparten la fontanería en `js/enlace.js`.

| Pantalla | Se enciende con | Se apaga |
|---|---|---|
| `ceremonia.html` | El **suceso** de fin de ronda | Sola, a los 4,2 s |
| `pausa.html` | El **estado**: mientras haya tiempo muerto | Cuando el servidor deja de mandarlo |
| `avisos.html` | El **estado**: el rótulo del operador | Cuando el operador lo quita |

## Suceso o estado, y por qué importa

Una ceremonia es un **instante**: llega una vez y, si se pierde, no vuelve.
Un tiempo muerto es una **situación** que dura. Por eso la ceremonia se
dispara con el suceso y se apaga sola con su propio reloj, mientras la pausa
y el aviso siguen al estado y no necesitan temporizador.

El reloj de la pausa lo lleva el navegador: el servidor manda el **instante**
en que empezó y cuánto dura, no los segundos que quedan. Así la cuenta atrás
va suave aunque la red llegue a saltos.

## La regla que ya nos mordió tres veces

**Mientras el cartel se mueve, no se le escribe dentro.** Reescribir un
elemento que está animándose reinicia lo que herede la animación. Pasó con la
insignia de la ulti en combate y con el tablero de compra; aquí está resuelto
de entrada, en `enlace.js`.

Y al entrar se pinta **antes** de animar, o el cartel entraría con el
contenido de la vez anterior.

## Las ceremonias que salen

El cartel de diseño dice "Gana la ronda" y nada más. El overlay deduce además
`ace`, `clutch`, `teamAce`, `thrifty` (ronda ahorrada) e `impecable`, y el
título cambia con ellas (ver `comun/traduccion.js`, `ceremoniaDe`).

## La caja de fin de ronda (`tools.roundWinBox`)

Decora la ceremonia: nada (por defecto), el logo y el fondo del torneo, o un
patrocinador. Con patrocinadores se usa el primero que case con el equipo que
ganó y con el tipo de ronda; si ninguno casa, el primero. «Izquierda» y
«derecha» son los equipos tal como están en el match, no el lado de la
pantalla. La elección vive en `comun/extras.js` (`eligeCaja`); el cartel pone
el icono arriba a la derecha y el fondo detrás del lavado de color.

Adaptado de ValoSpectra/Spectra-Frontend (Elastic License 2.0) —
`endround-banner.component.ts`.

## Avisos: rótulo, patrocinadores y marca de agua

- El **rótulo** solo sale en la fase de **compra** (como en el original). Si el
  operador lo deja puesto, aparece en la compra siguiente. Con
  `eventLogoEnabled` lleva también el logo del torneo. El título se encoge
  según su longitud (`ajustaTexto` en `enlace.js`) para no cortarse.
- Los **patrocinadores** (a la derecha, bajo la caja del torneo) y la **marca de
  agua** (centrada bajo la barra) están siempre que estén activados. Antes
  estaban abajo y se montaban sobre las tarjetas y el tablero de compra.
- El HTML trae textos de ejemplo («LOGITECH G»…): solo se ven con `?demo=1`.
## Los colores, como manda el LEEME

- **Ronda ganada**: verde fijo. No sigue al bando, a propósito.
- **Tiempo muerto / aviso de equipo**: el color del equipo que lo pide.
- **Pausa técnica / aviso de producción**: gris, sin logo. En la técnica
  desaparece además el cupo, porque no hay nada que contar.

## Probarlas

Las tres necesitan que alguien las dispare. El canal de operador espera un
sobre, no la orden desnuda:

```js
socket.send(JSON.stringify({ operatorToken, command: { type: 'startTimeout', kind: 'tactical', teamIndex: 1 } }));
```

Desde el panel de operador (`:5101`) o desde el simulador de pruebas.
