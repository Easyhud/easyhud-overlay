# Selección de agentes

La pantalla de `ARTE/SELECT PHASE`. **El CSS no se ha tocado.** Del pintor
solo cambian dos cosas, las dos explicadas abajo.

Se enciende con la fase `agentSelect` y se va en cuanto empieza la compra.

## Quién ha elegido: por jugador, no por contador

El fichero de diseño lo deducía de un contador — *los `k` primeros de la fila
han confirmado*. Sirve para maquetar, pero en una partida real **el orden de
bloqueo no es el de la alineación**: el tercero puede confirmar antes que el
primero, y entonces el contador señalaría al jugador equivocado.

Ahora cada jugador trae su marca. El contador sigue valiendo si la marca no
viene, así que el fichero estático de diseño se sigue pintando igual.

## Está eligiendo UNO por equipo

El juego enseña el agente señalado **antes** de confirmarlo, así que tener
agente no distingue a quien está decidiendo. Con esa regla aparecían cuatro o
cinco «eligiendo» a la vez y la pantalla perdía el sentido. El que decide es
el primero de su fila que aún no ha bloqueado.

## La rueda son los 29 agentes

El fichero de diseño traía diez escritos a mano. Quien está eligiendo pasa
ahora por el elenco entero, que es lo que hace el juego.

## Un 404 que solo se ve sirviéndolo

La cabecera pone el logo en una variable CSS (`--logo`) y la hoja lo usa con
`var()`. Una ruta relativa dentro de una sustitución así **la resuelve el
navegador contra la hoja de estilos**, no contra la página: `./assets/x.webp`
acababa pidiendo `css/assets/x.webp`. El adaptador manda la dirección
completa y se acabó la ambigüedad.

Es el mismo tipo de fallo que el `escudo.svg` de combate, con otra cara.

## El banco tenía la selección resuelta en tres segundos

Y con los diez ya confirmados, o sea que esta pantalla no tenía nada que
enseñar: ni un jugador eligiendo, ni una casilla vacía, ni el golpe de
confirmar. Ahora bloquean de uno en uno alternando bando, como en el juego.

Es el cuarto sitio donde el banco no reproducía algo y por eso una parte del
overlay no se podía ni mirar. Los otros tres: la cámara fija, el fotograma
con un solo observado, y la fase de compra de dos segundos.

## Verificado

Una selección entera: 6/2/2 → 7/2/1 → 8/2/0 → 9/1/0 → 10/0/0, y la pantalla
se esconde sola al empezar la compra. Sin errores de consola.
