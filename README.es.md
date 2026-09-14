# infra-deadlines

**Un tablero con fechas de lo que se está apagando en la infraestructura cripto
y web3.** Endpoints retirados, cadenas detenidas, capas gratuitas recortadas,
SDK que llegan a fin de vida — cada entrada lleva una fecha en UTC, la acción
mínima que exige y un enlace a la fuente primaria que lo anunció.

**English:** [README.md](README.md) · **Русский:** [README.ru.md](README.ru.md)

## Por qué existe

Un apagado se anuncia una sola vez, en un changelog al que nadie está suscrito,
y después ocurre. El fallo casi nunca suena a «no encontramos una alternativa».
Suena a «no sabíamos la fecha». Este tablero es esa lectura que nadie hace,
puesta por escrito.

Se mantiene a mano, cada semana, para el boletín
[Infra Graveyard Weekly](https://es.sepia.software/blog/series/infra-graveyard), y
se publica aquí porque el conjunto de datos sirve por sí solo:

- Español — <https://es.sepia.software/blog/series/infra-graveyard>
- English — <https://sepia.software/blog/series/infra-graveyard>
- Русский — <https://ru.sepia.software/blog/series/infra-graveyard>

## Qué está a punto de romperse en mi stack

```bash
npx infra-deadlines                    # todo lo abierto, lo más próximo primero
npx infra-deadlines --days 30          # solo los próximos 30 días
npx infra-deadlines solana chainlink   # solo las entradas que los mencionan
npx infra-deadlines --json             # legible por máquina
```

En CI, para que te avisen en lugar de tener que acordarte:

```bash
npx infra-deadlines solana --fail-within 30   # sale con 1 si algo cae dentro de 30 días
```

## Las dos reglas con las que se lleva el tablero

**Un plazo no se cierra porque se haya anunciado.** Se cierra cuando la fuente
vuelve a comprobarse y el hecho ocurre de verdad. Las entradas cuya fecha
anunciada ya pasó sin que el interruptor se accionara siguen abiertas y llevan
`overdue: true`: son un riesgo vivo, no una fila olvidada. Chainlink anunció
tres feeds para el 2 de septiembre de 2026; doce días después los tres seguían
actualizándose dentro de su heartbeat, así que la entrada sigue abierta.

**Lo que el anuncio no cubre no se supone.** Si el aviso de un proveedor no dice
nada sobre qué pasa con los fondos que quedan en un pool, el tablero escribe que
el anuncio calla, no lo que nosotros imaginamos. Una suposición disfrazada de
hecho es peor que un hueco, porque el hueco al menos se va a comprobar.

## Forma de una entrada

```yaml
open:
  - id: solana-rent-phase-2
    what: "Solana rent reduction phase 2 (SIMD-0437-2): lamports_per_byte 6,333 -> 5,080…"
    deadline: 2026-09-15
    time: null              # la fuente dio fecha, pero no hora
    date_precision: month   # opcional: la fuente dijo «mediados de septiembre»
    action: "Replace hardcoded rent constants with getMinimumBalanceForRentExemption()…"
    source: "https://solana.com/upgrades/reduced-rent"
    source_quality: primary # primary | secondary
    first_issue: 6
```

Las entradas cerradas registran `effective` —el día en que ocurrió de verdad— en
lugar de `deadline`, y `verified` cuando la comprobación fue solo parcial.

`open` va ordenada de lo más próximo a lo más lejano; `closed`, de lo más
reciente a lo más antiguo. Ambos órdenes se comprueban.

## Comprobar el tablero

```bash
npm run verify     # informe
npm run check      # sale con 1 ante cualquier problema — para CI
```

Comprueba la estructura, el formato de las fechas, los id repetidos, el orden y,
sobre todo, si algo lleva en `open` más allá de su fecha sin un veredicto
registrado. Esa última comprobación existe porque el 12 de septiembre de 2026
cuatro filas llevaban semanas vencidas y seguían visibles en una página pública,
y dos eventos no se habían registrado nunca. No había nada roto en el código:
sencillamente, nadie había leído el tablero.

**Lo que no hace:** volver a comprobar cada entrada contra su fuente en vivo. No
hay una sonda genérica — una entrada es la lectura de un feed en cadena, la
siguiente un endpoint REST, y la siguiente el blog de un proveedor que desde
entonces es una cáscara de JavaScript sin texto dentro. Esa verificación sigue
siendo manual y sigue la regla de arriba.

## Usar los datos

```js
import { load, upcoming, daysLeft } from "infra-deadlines";

const board = load();
for (const e of upcoming(board, { within: 30 })) {
  console.log(daysLeft(e), e.id, e.action);
}
```

O lee `deadlines.yaml` directamente: es el conjunto de datos completo, y detrás
no hay ninguna base de datos, a propósito.

## Se agradecen las correcciones

Una fecha equivocada aquí es peor que no tener fecha. Si una entrada ha quedado
obsoleta, si un anuncio se movió o si el interruptor nunca llegó a accionarse,
abre un issue con la fuente: se comprobará contra esa fuente y no contra la
entrada anterior.

## Licencia

Código (`src/`, `bin/`, `scripts/`) — MIT, ver [LICENSE](LICENSE).
Datos (`deadlines.yaml`) — CC BY 4.0, ver [LICENSE-DATA](LICENSE-DATA).
