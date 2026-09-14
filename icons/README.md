# Iconos propios

Los que dibujamos nosotros, porque **no existen en el catálogo público de
Riot**: los cuatro motivos de ronda ganada, el crédito y el escudo vacío.

Comprobado el 10 de septiembre de 2026 contra `valorant-api.com`: hay iconos
oficiales de escudo (`/gear`), de agente, de habilidad y de arma, y la insignia
del modo de juego. De los motivos de ronda —detonada, desactivada,
eliminación, reloj— no hay ninguno, y sacarlos de los ficheros del juego no es
una opción: es arte de Riot extraído del cliente, y esto es un producto que se
vende. Ver `PLATAFORMA.md`.

## Dónde NO están los oficiales (buscado a fondo)

Antes de dibujarlos se repasó el catálogo público entero, endpoint por
endpoint. Queda escrito para no repetir la búsqueda:

| Endpoint | Qué trae |
|---|---|
| `/ceremonies` | Los seis nombres (ACE, CLOSER, CLUTCH, FLAWLESS, TEAM ACE, THRIFTY) y un `assetPath` que apunta **dentro del paquete del juego** (`ShooterGame/Content/Ceremonies/AceCeremony_PrimaryAsset`). **Ninguna imagen**; probadas las rutas por convención en el CDN: 404 |
| `/objectives` | 46 directivas de texto. **Cero iconos** |
| `/gamemodes` | 15 iconos. Incluye la **insignia del modo Standard**, que es el triángulo con la spike |
| `/gear` | Los tres escudos. **Los usamos** |
| `/currencies` | Puntos VALORANT, Créditos del Reino, Fichas de agente. **No** el glifo del crédito de ronda |
| `/maps`, `/weapons`, `/competitivetiers`, `/flex` | Nada de HUD |

La conclusión es la explicación de por qué no aparecen: **los iconos del HUD no
son elementos de catálogo.** valorant-api espeja lo que tiene `uuid` y
`displayIcon` —agentes, armas, escudos, mapas—, y las texturas de interfaz no
están en ese catálogo. Viven dentro de los `.pak` del juego instalado, y de ahí
solo salen extrayéndolos con herramientas de la comunidad. Que es exactamente
la vía que este proyecto no puede usar: ver abajo.

Lo más cercano que sí es oficial y está publicado es la **insignia del modo
Standard** (`/gamemodes`), que se puede usar igual que los retratos de agente:
descargada en cada máquina del CDN público y sin redistribuir. No es el glifo
de detonación del HUD, pero es la marca oficial del modo de la spike.

## La convención, que sí se puede mirar

Los sitios de estadísticas de VALORANT usan un juego de iconos para esto, y
mirarlo sirvió para corregir tres de los cuatro dibujos. **La convención no es
la que yo había supuesto:**

| Motivo | Glifo de la convención | Lo que había dibujado antes |
|---|---|---|
| Eliminación | **círculo con una X** | una calavera |
| Desactivada | cortacables | tijeras (se parecía bastante) |
| Detonada | **llama** | la spike plantada |
| Tiempo | **reloj de arena** | reloj de agujas |

El círculo con la X era el error caro: en las emisiones ese glifo significa
**eliminación**, y yo lo habría leído como detonación. En un riel de 24
casillas lo que importa es que el espectador reconozca sin leer, así que se
sigue la convención y no el gusto de quien dibuja.

Los ficheros de referencia, para volver a mirarlos si hace falta, están en el
CDN de Tracker Network con estos nombres —cuatro motivos, en versión ganada y
perdida—:

    eliminationwin1.png   eliminationloss1.png
    diffusewin1.png       diffuseloss1.png        (sí, escrito "diffuse")
    explosionwin1.png     explosionloss1.png
    timewin1.png          timeloss1.png

**Se miran, no se usan.** Son de un tercero, en su CDN: enlazarlos desde el
producto sería gastar su ancho de banda, y copiarlos, quedarse con arte que no
es nuestro. Una convención iconográfica —un círculo con una X, un reloj de
arena— no es de nadie; el dibujo concreto sí. De ahí que los nuestros sean
nuestros y sigan la misma idea.

## Por qué no se cogen de la wiki

La wiki de VALORANT —Fandom, Liquipedia— **sí tiene esos iconos**, y aun así no
se cogen de ahí. La licencia de una wiki (CC-BY-SA en Fandom) cubre **el texto
que escriben sus editores**, no el arte del juego: esas imágenes siguen siendo
de Riot y la wiki solo las aloja como contenido de fans.

Y ahí está el problema, que no es la wiki: es que **Easy HUD se vende**. La
política de contenido de fans de Riot permite usar su material en proyectos
**no comerciales**, y un producto que se cobra no entra. Bajarlos de la wiki no
cambia de quién es el arte; solo añade que además usamos el ancho de banda de
un tercero que prohíbe el enlazado directo.

Para un producto que se vende quedan tres caminos legítimos:

1. **Dibujarlos**, que es lo que hay en esta carpeta. Coste: una tarde. Ventaja
   extra: encajan con la marca y no se parecen a los de nadie.
2. **Un juego de iconos con licencia permisiva** — Lucide (ISC), Tabler (MIT),
   Material Symbols (Apache 2.0)—. Tienen bomba, reloj, calavera y tijeras. Se
   pueden usar comercialmente; lo que no van a tener es la silueta de la spike.
3. **Pedirle permiso a Riot.** Es lo único que convierte el arte del juego en
   una opción legal para un producto comercial, y no es descartable: licencian
   competiciones comunitarias. Va en el mismo paquete que la clave de
   producción del portal.

> **Nota sobre el resto del arte.** Los retratos de agente, los iconos de
> habilidad, de arma y de escudo que sí usamos son **igual de suyos**. La
> diferencia es cómo se usan: se descargan de la distribución pública de Riot
> en cada máquina y **no se redistribuyen** en el repositorio ni en el
> instalador. Es la práctica habitual en los overlays de torneo, pero conviene
> tenerlo claro y en la lista de cosas que hablar con Riot, no darlo por hecho.

## Cómo se usan, que tiene truco

Todos son **formas rellenas, sin trazos**, y con los huecos hechos como
agujeros de verdad (`fill-rule="evenodd"`). Eso permite las dos formas de uso:

**En línea, dentro del HTML.** Hereda el color del texto:

    <span class="motivo"><svg …>…</svg></span>
    .motivo svg { width: 14px; height: 14px; color: var(--ataque); }

**Como máscara CSS**, si se prefiere no meter SVG en el markup:

    .motivo {
      width: 14px; height: 14px;
      background: currentColor;
      -webkit-mask: url(icons/reason-detonate.svg) center/contain no-repeat;
              mask: url(icons/reason-detonate.svg) center/contain no-repeat;
    }

Lo que **no** funciona es `<img src="reason-detonate.svg">` esperando que tome
el color del texto: un SVG cargado como imagen no ve el CSS de la página, así
que `currentColor` se resuelve a negro. Ya pasó una vez en este proyecto —
iconos negros sobre fondo negro, invisibles— y por eso está escrito aquí.

## Tamaño mínimo

Están dibujados en una rejilla de 24 y se leen bien a partir de **14 px**. Por
debajo, la calavera y el cortacables se convierten en manchas: para la tira del
historial de rondas, 14–16 px es el suelo.
