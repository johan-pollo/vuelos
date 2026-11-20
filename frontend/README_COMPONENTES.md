# Guía de componentes reutilizables

Esta guía explica `BotonVolverResumen.vue`, `EncabezadoCompacto.vue` y `TablaDatos.vue`. Está escrita para poder describir su código y su utilidad en una presentación de Frontend / UX UI.

## ¿Qué significa componentizar?

Componentizar consiste en guardar una parte de la interfaz en un archivo `.vue` independiente para poder utilizarla en varias páginas. En vez de copiar el mismo marcado muchas veces, cada página importa el componente y lo coloca en su plantilla.

Cada uso crea una instancia independiente, pero todas las instancias comparten la misma definición. Por eso, un cambio visual o de comportamiento hecho dentro del componente se refleja en todas las páginas que lo utilizan. Los valores que varían entre páginas se pasan mediante props.

---

## 1. BotonVolverResumen.vue

**Archivo:** [`src/components/BotonVolverResumen.vue`](./src/components/BotonVolverResumen.vue)

### Propósito

Representa el botón administrativo que lleva al resumen. Reúne en un solo lugar su aspecto —estilo plano e icono de flecha— y su destino de navegación.

Antes, cada página escribía de nuevo el mismo `<q-btn>`. Ahora importa y utiliza `<BotonVolverResumen />`.

### Explicación del código

#### Template

```vue
<template>
  <div class="back-button-wrapper">
    <q-btn flat icon="arrow_back" :to="to" class="back-navigation">{{ label }}</q-btn>
  </div>
</template>
```

- `<template>` contiene el marcado que Vue convertirá en interfaz.
- El `<div>` es el único elemento raíz, como requiere la estructura del componente.
- `<q-btn>` es el botón de Quasar.
- `flat` usa la apariencia plana, sin el fondo sólido de un botón elevado.
- `icon="arrow_back"` muestra la flecha de regreso.
- `:to="to"` enlaza la prop `to` con la navegación de Vue Router. Los dos puntos indican que se pasa una expresión o un objeto, no texto literal.
- `class="back-navigation"` conserva la clase usada por los estilos compartidos del proyecto.
- `{{ label }}` interpola el texto de la prop dentro del botón.

#### Script y props

```vue
<script setup>
defineProps({
  label: {
    type: String,
    default: 'Volver al resumen',
    // Texto visible del botón de navegación.
  },
  to: {
    type: Object,
    default: () => ({ name: 'admin-dashboard' }),
    // Destino de navegación del botón.
  },
})
</script>
```

- `<script setup>` es la forma concisa de declarar la lógica de un componente Vue 3.
- `defineProps` declara los datos que el componente puede recibir.
- `label` es `String` porque el botón muestra texto. Si la página no envía esta prop, se usa “Volver al resumen”.
- `to` es `Object` porque el destino usado aquí es un objeto de ruta con nombre: `{ name: 'admin-dashboard' }`. Vue Router recibe ese objeto y resuelve la página correspondiente.
- El valor por defecto de `to` se escribe como una función (`() => ({ ... })`). Vue usa una función para crear un objeto nuevo por instancia y evitar que varias instancias compartan la misma referencia.
- Los comentarios describen la finalidad de cada prop.

#### Estilos

```vue
<style scoped>
.back-button-wrapper {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
}
</style>
```

- `<style scoped>` limita esta regla al componente.
- `display: flex` crea un contenedor para el botón.
- `width: fit-content` hace que el contenedor ocupe solo el ancho necesario.
- `margin-bottom: 10px` separa el botón del eyebrow que aparece debajo.
- En las páginas, el componente se coloca dentro del bloque del encabezado y antes del eyebrow. Así, todas sus instancias quedan encima de “Administración” sin mover el título a un lado.

### Uso

La página importa el archivo en su `<script setup>`:

```js
import BotonVolverResumen from '../components/BotonVolverResumen.vue'
```

Y lo coloca en el template:

```vue
<BotonVolverResumen />
```

Al no pasar props, se usan los valores por defecto: texto “Volver al resumen” y destino `admin-dashboard`. Si se necesitara otro texto o ruta, se pueden proporcionar:

```vue
<BotonVolverResumen
  label="Regresar al panel"
  :to="{ name: 'admin-dashboard' }"
/>
```

---

## 2. EncabezadoCompacto.vue

**Archivo:** [`src/components/EncabezadoCompacto.vue`](./src/components/EncabezadoCompacto.vue)

### Propósito

Reúne la estructura repetida de un encabezado compacto: un texto contextual opcional (eyebrow) y un título. Las páginas cambian los textos y, cuando hace falta, el nivel o la clase del título mediante props.

### Explicación del código

#### Template

```vue
<template>
  <div class="compact-heading">
    <p v-if="showEyebrow" class="eyebrow">{{ eyebrow }}</p>
    <component :is="titleTag" :class="titleClass">{{ title }}</component>
  </div>
</template>
```

- El `<div>` es el único elemento raíz y contiene todo el encabezado.
- `<p v-if="showEyebrow">` solo crea el párrafo contextual cuando la prop booleana es verdadera.
- `{{ eyebrow }}` y `{{ title }}` muestran los textos recibidos como props.

### ¿Dónde y para qué se usa `<component :is="titleTag">`?

`<component>` es una etiqueta especial de Vue para crear un elemento dinámico. No es otro archivo ni un componente adicional. La expresión `:is="titleTag"` le indica a Vue qué etiqueta HTML debe generar:

- Si `titleTag` vale `'h2'`, Vue genera `<h2>`.
- Si `titleTag` vale `'h3'`, Vue genera `<h3>`.
- Si la página no envía `titleTag`, se usa su valor predeterminado, `'h2'`.

Esto permite mantener una sola estructura reutilizable y respetar la jerarquía semántica de cada pantalla, sin crear una variante distinta del componente para cada nivel de título.

Por ejemplo, en [PassengerPage.vue](./src/pages/PassengerPage.vue) se omite `title-tag`, así que el título “Datos del pasajero” se genera como `<h2>`. En cambio, [AdminReservationsPage.vue](./src/pages/AdminReservationsPage.vue) y [MyReservationsPage.vue](./src/pages/MyReservationsPage.vue) pasan `title-tag="h3"` porque esos encabezados son títulos de una sección o tarjeta dentro de una página.

La expresión `:class="titleClass"` aplica al elemento dinámico la clase que indique la página. Por ejemplo, MyReservationsPage pasa `title-class="text-h6"` para conservar ese tamaño visual. Si no se pasa una clase, `titleClass` vale `''` y no agrega un estilo opcional.

Finalmente, `{{ title }}` inserta el texto recibido dentro de la etiqueta generada. Así, la etiqueta HTML, su clase y su texto se pueden ajustar por separado mediante props.

#### Script y props

```vue
<script setup>
defineProps({
  showEyebrow: {
    type: Boolean,
    default: false,
    // Indica si se muestra el texto contextual del encabezado.
  },
  eyebrow: {
    type: String,
    default: '',
    // Texto pequeño que contextualiza el encabezado.
  },
  title: {
    type: String,
    default: '',
    // Título principal que se muestra en el encabezado.
  },
  titleTag: {
    type: String,
    default: 'h2',
    // Nivel HTML del título para conservar la jerarquía de cada vista.
  },
  titleClass: {
    type: String,
    default: '',
    // Clase opcional para mantener el estilo particular del título.
  },
})
</script>
```

- `showEyebrow` es `Boolean` porque representa una decisión de mostrar u ocultar. Su valor predeterminado es `false`; en el template controla `v-if`.
- `eyebrow` y `title` son `String` porque contienen texto.
- `titleTag` es `String` porque indica qué etiqueta HTML usar. Por defecto es `h2`; algunas secciones pasan `h3` para mantener la jerarquía de títulos.
- `titleClass` es `String` porque contiene el nombre de una clase CSS opcional. Si no se necesita una clase adicional, queda como cadena vacía.
- Todas las props tienen tipo, valor por defecto y comentario en español.

En las plantillas, Vue permite escribir los nombres camelCase de las props en kebab-case. Por ejemplo, `showEyebrow` se usa como `show-eyebrow`, y `titleTag` como `title-tag`.

#### Estilos

```vue
<style scoped>
.compact-heading {
  display: block;
}
</style>
```

- `<style scoped>` limita la regla al componente.
- `display: block` conserva la presentación normal del `<div>` que el componente reemplaza.

### Uso

La página importa el componente:

```js
import EncabezadoCompacto from '../components/EncabezadoCompacto.vue'
```

Y envía los datos que cambian:

```vue
<EncabezadoCompacto
  show-eyebrow
  eyebrow="AeroJoher"
  :title="mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'"
/>
```

En este ejemplo, `show-eyebrow` equivale a `showEyebrow=true`. El título cambia según el modo de la página; si no se muestra eyebrow, se omite esa prop y permanece oculta.

Para un título de otro nivel con una clase particular:

```vue
<EncabezadoCompacto
  show-eyebrow
  eyebrow="Reserva"
  title="Mapa completo de asientos"
  title-tag="h3"
  title-class="text-h6"
/>
```

---

## 3. TablaDatos.vue

**Archivo:** [`src/components/TablaDatos.vue`](./src/components/TablaDatos.vue)

### Propósito

Reúne la presentación de tablas administrativas y listados en CSS Grid. Encapsula la tabla de Quasar para conservar paginación y selección de filas, y permite adaptar celdas mediante slots.

### Props y slots

- `columnas`: arreglo de `{ key, label, ancho?, alineacion?, valor? }`. `valor` es opcional y permite obtener un valor formateado desde cada fila.
- `filas`: registros a mostrar.
- `mensajeVacio`, `cargando`, `colorEncabezado` y `rayado`: texto y opciones visuales/de estado.
- `variante="rejilla"`: usa la presentación CSS Grid; por defecto se utiliza la tabla de Quasar.
- `filaClave` y `paginacion`: clave única y paginación controlada opcional.
- `#superior`: contenido que se muestra sobre la tabla, por ejemplo filtros.
- `#celda-{key}`: contenido personalizado de una celda; recibe `{ fila, columna, valor }`.
- `#acciones`: slot de la columna cuyo `key` es `acciones`.

El componente emite `click-fila` con el registro seleccionado y `update:paginacion` para permitir `v-model:paginacion`.

### Uso

```vue
<TablaDatos
  :columnas="columnas"
  :filas="filas"
  fila-clave="_id"
  v-model:paginacion="paginacion"
  @click-fila="seleccionarFila"
>
  <template #superior>
    <!-- Filtros de esta vista -->
  </template>
  <template #celda-estado="{ valor }">{{ valor }}</template>
  <template #acciones="{ fila }">
    <q-btn flat icon="edit" aria-label="Editar" @click="editar(fila)" />
  </template>
</TablaDatos>
```

---

## Idea clave para explicar

Estos componentes separan la **estructura común** de los **datos variables**. `BotonVolverResumen` centraliza un botón compartido; `EncabezadoCompacto` reúne la estructura de encabezados; y `TablaDatos` comparte la presentación de tablas manteniendo filtros, paginación y celdas configurables. Esto reduce duplicación y ayuda a mantener una interfaz coherente entre páginas.
