# Raze — assets de ejemplo

Rol: Duelist
Nombre interno en la telemetría del juego: `Clay`

## Retratos

| Fichero | Qué es |
|---|---|
| `agente-icono.png` | Icono cuadrado. Es el que usa la tarjeta de combate |
| `agente-cuerpo.png` | Retrato de cuerpo entero. Para selección de agentes o MVP |
| `agente-killfeed.png` | Silueta plana del killfeed |

## Habilidades

Nombradas por la TECLA, que es como las llama el jugador.

| Fichero | Tecla | Nombre |
|---|---|---|
| `habilidad-c.png` | C | Boom Bot |
| `habilidad-q.png` | Q | Blast Pack |
| `habilidad-e.png` | E | Paint Shells |
| `habilidad-x.png` | X | Showstopper |

**La ultimate (X) no funciona como las otras tres.** Las de C, Q y E son
booleanas —la tiene o no la tiene— y solo se saben si ese jugador corre el
cliente auxiliar. La ultimate llega siempre y para los diez, con puntos
actuales y máximo, así que se puede dibujar un medidor.

## Armas y escudos

Los iconos de arma son los del killfeed: planos, anchos y legibles a poca
altura. Los de tienda están iluminados y en perspectiva, y a 12 px son una
mancha.

El escudo tiene un cuarto estado, "sin escudo", que **no existe en el
juego** —allí es la ausencia de icono— y es arte propio nuestro. Está en
`packages/overlay/icons/armor-none.svg`, junto al glifo de créditos, que
tampoco lo publica el catálogo.

## Resolución

Todo viene muy por encima del tamaño de pintado: el icono de agente es
512×512 y se pinta a 54 px, las habilidades son 128×128 a 16 px. Hay margen
de sobra incluso a 4K, así que se puede ampliar sin que se degrade.

## Legal

**Este arte es de Riot Games.** No entra en el repositorio: se descarga
en cada máquina con `packages/overlay/tools/fetch-assets.mjs`. Esta carpeta
la genera `tools/sample-agent.mjs` y está en `.gitignore`.

Descargado de https://valorant-api.com/v1 el 2026-09-09.
