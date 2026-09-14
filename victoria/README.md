# Victoria

La pantalla de `ARTE/VICTORIA`. **El CSS no se ha tocado** y del pintor solo
cambia que se le llama cuando la partida termina, no al cargar.

## El servidor ya sabe cuándo se acabó

Antes la partida **solo terminaba si el operador pulsaba el botón**, y el
suceso de fin no decía quién había ganado. O sea que esta pantalla dependía
de que alguien se acordara, y de adivinar el ganador del marcador.

Ahora el servidor lo detecta al cerrar cada ronda, con las reglas del formato
—que son configurables, no números a fuego:

- **En tiempo normal** gana quien llega a `roundsToWin`. Un 13-11 acaba.
- **A 12-12 no acaba**: eso es prórroga.
- **En prórroga** ya no vale llegar a un número, hay que sacar
  `overtimeRoundsToWin` de ventaja. 13-12 no; 14-12 sí.

Y el suceso lleva **quién ganó**, así que la pantalla no adivina.

Si el operador termina la partida a mano antes de tiempo, el suceso llega
**sin ganador**: un mapa que se corta no tiene campeón que anunciar, y decir
uno sería inventarlo.

## Va con un suceso, y aun así mira el estado

El fin de mapa es un instante: se anuncia una vez y no vuelve. Pero si esta
fuente se abre —o se recarga— **después** de que acabara, ese instante ya
pasó. Por eso también se mira la fase `gameOver` del estado y se reconstruye
igual: un refresco accidental en plena celebración no deja la pantalla en
negro.

Y una partida nueva la apaga sola.

## La palabra

Por defecto «VICTORIA». Para la última de una serie se fuerza desde la
dirección:

    …/victoria/index.html?room=X&token=Y&palabra=CAMPEÓN

No se deduce de los mapas ganados a propósito: saber si esta era la final es
cosa del operador, no del marcador.

## Un 404 que ya conocíamos

El escudo se pinta con una variable CSS que la hoja usa con `var()`, y una
ruta relativa ahí la resuelve el navegador **contra la hoja de estilos**. El
adaptador manda la dirección completa. Es la tercera vez que aparece este
mismo fallo con otra cara.

## Verla

    npm run escena -- victoria

Juega hasta el final de verdad en vez de anunciarlo a mano, así que lo que se
prueba es la detección del servidor y no una orden que siempre acierta.
