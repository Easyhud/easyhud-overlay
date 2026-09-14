# Fase de compra — el arte de diseño, en directo

El tablero de `ARTE/FASE COMPRA`. **El CSS no se ha tocado**, y el pintor
(`js/compra.js`) tampoco, salvo un cambio: era una función que se ejecutaba
sola al cargar y leía los datos una vez; ahora es `window.pintaCompra(datos)`
y se la llama cada vez que llegan datos nuevos. El resto —qué se pinta y en
qué orden— está intacto.

| Fichero | Qué hace |
|---|---|
| `js/datos-compra.js` | Habla con el servidor y construye el tablero |
| `js/cdn.js` | Igual que el suyo, pero con el catálogo completo |
| `js/compra.js`, `js/poligono.js`, `js/escenario.js` | Suyos |

El tablero se rehace entero en cada cambio, y aquí sí se puede: cambia cuando
alguien compra, no diez veces por segundo. (En combate no se puede, y por eso
allí se parchea: ver el README de esa pantalla.)

## Dos cosas del traspaso que había que resolver

**`compra.html` enlazaba `./css/combate.css`, que no existe en la carpeta.**
El fotograma estático —el que el LEEME señala como bueno— no lo enlaza. Se ha
ido con el juego de hojas del estático: tokens, hud y compra.

**El catálogo traía diez agentes y ocho armas.** Se genera del público, como
en combate.

## El historial va por BANDO, no por equipo

Arriba ataque, abajo defensa. El contrato lo guarda por equipo con el bando
de cada ronda dentro, que es justo lo que hace que siga bien **después del
cambio de mitad**: si se guardara por bando, en la ronda 13 el historial
entero se daría la vuelta.

Por lo mismo, las filas se ordenan por bando y no por el orden en que el
operador puso los equipos: la mitad izquierda es siempre el ataque.

## Entra y sale sola

El tablero aparece al empezar la compra y se va al empezar el combate, así
que esta pantalla se puede dejar puesta como una fuente fija de OBS: nadie
tiene que tocar nada durante el partido.

La salida hay que **esperarla**. Si se escondiera el tablero en el mismo
momento de pedir la animación, no se vería ninguna: se oculta al acabar, a
los 300 ms de la animación más los 152 del desfase entre filas.

**Mientras el tablero entra o sale, NO se repinta.** Es lo que hacía que la
entrada se viera rota: el pintor rehace las filas enteras, unas filas nuevas
heredan la clase de entrada del tablero y **vuelven a lanzar la animación
desde cero**. Durante la compra llegan repintados cada pocos segundos —y a
veces dos seguidos con 100 ms de diferencia—, así que la animación se
reiniciaba sin terminar nunca: parecía lenta y parecía rota, y era lo mismo.

Mientras dura el movimiento se guarda el último dato y se pinta al acabar.
Son 450 ms en los que la economía no cambia.

Y al entrar se pinta **antes** de animar: si se animara primero, el tablero
entraría con el contenido de la ronda anterior y daría un salto.

Y cuando alguien gasta, su fila lo acusa (`es-compra`). Se deduce comparando:
el estado dice **cuánto lleva gastado**, no que acabe de comprar.

## El arma: un dato, dos huecos

El tablero tiene hueco de primaria y de secundaria. **El juego manda UNA
arma**, la que se lleva en la mano, así que se coloca en el hueco que le toca
por su clase y el otro se queda vacío.

**Se enseña solo esa, sea la que sea** —cuchillo incluido—, y el otro hueco
se queda vacío. Decisión tomada a conciencia: en VALORANT todos llevan al
menos la Classic, así que se podría suponer, pero quien compró una Sheriff y
lleva el rifle en la mano aparecería con una Classic que no tiene. Un hueco
vacío no dice nada falso; un arma inventada, sí.

Con lo cual, ojo al leer el tablero: **un hueco de secundaria vacío no
significa que no tenga pistola**, significa que no sabemos cuál.

## Lo que falta decidir

- **`−0`**: el gasto se pinta siempre, y quien todavía no ha comprado sale con
  un `−0` en la fila. Durante la mayor parte de la fase de compra eso son diez
  ceros en pantalla.
- **Cargas**: un rombo por habilidad hasta que una partida real diga si la
  plataforma manda el número.
