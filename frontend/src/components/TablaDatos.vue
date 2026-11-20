<template>
  <div
    v-if="variante === 'rejilla'"
    class="tabla-datos-rejilla"
    :class="{ 'tabla-datos-rayada': rayado }"
    :style="{ '--tabla-color-encabezado': colorEncabezado }"
    v-bind="$attrs"
  >
    <div class="tabla-datos-rejilla-cuerpo" role="table">
      <div class="tabla-datos-rejilla-encabezado" role="row" :style="estiloColumnas">
        <span
          v-for="columna in columnas"
          :key="columna.key"
          role="columnheader"
          :class="claseAlineacion(columna.alineacion)"
        >
          {{ columna.label }}
        </span>
      </div>
      <div v-if="cargando" class="tabla-datos-rejilla-vacia" role="row">
        <span role="cell">Cargando...</span>
      </div>
      <div v-else-if="filas.length === 0" class="tabla-datos-rejilla-vacia" role="row">
        <span role="cell">{{ mensajeVacio }}</span>
      </div>
      <div
        v-for="(fila, indice) in filas"
        v-else
        :key="fila[filaClave] ?? indice"
        class="tabla-datos-rejilla-fila"
        role="row"
        :style="estiloColumnas"
        @click="emitirClickFila(fila)"
      >
        <div
          v-for="columna in columnas"
          :key="columna.key"
          role="cell"
          :class="claseAlineacion(columna.alineacion)"
        >
          <slot
            :name="nombreSlot(columna)"
            :fila="fila"
            :columna="columna"
            :valor="valorCelda(fila, columna)"
          >
            {{ valorCelda(fila, columna) }}
          </slot>
        </div>
      </div>
    </div>
  </div>

  <div
    v-else
    class="tabla-datos-contenedor"
    :style="{ '--tabla-color-encabezado': colorEncabezado }"
    v-bind="$attrs"
  >
    <q-table
      :class="['tabla-datos-tabla', { 'tabla-datos-rayada': rayado }]"
      :rows="filas"
      :columns="columnasQuasar"
      :row-key="filaClave"
      :loading="cargando"
      :no-data-label="mensajeVacio"
      :pagination="paginacion || undefined"
      flat
      bordered
      @row-click="(_, fila) => emitirClickFila(fila)"
      @update:pagination="$emit('update:paginacion', $event)"
    >
      <template v-if="$slots.superior" #top>
        <slot name="superior" />
      </template>
      <template
        v-for="columna in columnas"
        :key="columna.key"
        #[`body-cell-${columna.key}`]="slotProps"
      >
        <q-td :props="slotProps">
          <slot
            :name="nombreSlot(columna)"
            :fila="slotProps.row"
            :columna="columna"
            :valor="slotProps.value"
          >
            {{ slotProps.value }}
          </slot>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  columnas: {
    type: Array,
    default: () => [],
    // Columnas visibles y su configuración de ancho y alineación.
  },
  filas: {
    type: Array,
    default: () => [],
    // Registros que se muestran en la tabla.
  },
  mensajeVacio: {
    type: String,
    default: 'No hay datos disponibles.',
    // Texto que se muestra cuando no hay registros.
  },
  cargando: {
    type: Boolean,
    default: false,
    // Indica si los datos se están cargando.
  },
  colorEncabezado: {
    type: String,
    default: '#ffffff',
    // Color de fondo del encabezado.
  },
  rayado: {
    type: Boolean,
    default: false,
    // Alterna el fondo de las filas para facilitar su lectura.
  },
  variante: {
    type: String,
    default: 'tabla',
    // Presentación: tabla Quasar o rejilla CSS.
  },
  filaClave: {
    type: String,
    default: 'id',
    // Propiedad única usada para identificar cada fila.
  },
  paginacion: {
    type: Object,
    default: null,
    // Paginación opcional controlada por la vista.
  },
})

const emit = defineEmits(['click-fila', 'update:paginacion'])

const columnasQuasar = computed(() => props.columnas.map((columna) => ({
  name: columna.key,
  label: columna.label,
  field: typeof columna.valor === 'function'
    ? fila => columna.valor(fila)
    : fila => fila[columna.key],
  align: columna.alineacion || 'left',
  sortable: Boolean(columna.ordenable),
  ...(columna.ancho && !String(columna.ancho).endsWith('fr')
    ? { style: `width: ${columna.ancho}; max-width: ${columna.ancho}` }
    : {}),
})))

const estiloColumnas = computed(() => ({
  gridTemplateColumns: props.columnas.map(columna => columna.ancho || 'minmax(0, 1fr)').join(' '),
}))

function valorCelda(fila, columna) {
  return typeof columna.valor === 'function' ? columna.valor(fila) : fila[columna.key]
}

function nombreSlot(columna) {
  return columna.key === 'acciones' ? 'acciones' : `celda-${columna.key}`
}

function claseAlineacion(alineacion) {
  const alineaciones = {
    centro: 'centro',
    center: 'centro',
    derecha: 'derecha',
    right: 'derecha',
  }
  return `texto-${alineaciones[alineacion] || 'izquierda'}`
}

function emitirClickFila(fila) {
  emit('click-fila', fila)
}
</script>

<style scoped>
.tabla-datos-contenedor,
.tabla-datos-rejilla {
  width: 100%;
  min-width: 0;
  overflow-x: auto;
}

.tabla-datos-tabla :deep(thead tr th) {
  background-color: var(--tabla-color-encabezado);
}

.tabla-datos-tabla.tabla-datos-rayada :deep(tbody tr:nth-child(even)) {
  background-color: #fafbfc;
}

.tabla-datos-tabla :deep(.q-table__middle) {
  overflow-x: auto;
}

.tabla-datos-rayada .tabla-datos-rejilla-fila:nth-child(even) {
  background-color: #fafbfc;
}

.tabla-datos-rejilla-cuerpo {
  min-width: max-content;
  border: 1px solid var(--aero-line);
  border-radius: 14px;
  overflow: hidden;
}

.tabla-datos-rejilla-encabezado,
.tabla-datos-rejilla-fila {
  display: grid;
  align-items: center;
  gap: 12px;
  min-width: 820px;
  padding: 12px 16px;
}

.tabla-datos-rejilla-encabezado {
  background: var(--tabla-color-encabezado);
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 700;
}

.tabla-datos-rejilla-fila + .tabla-datos-rejilla-fila {
  border-top: 1px solid var(--aero-line);
}

.tabla-datos-rejilla-fila strong {
  color: var(--aero-navy);
}

.tabla-datos-rejilla-vacia {
  min-width: 820px;
  padding: 12px 16px;
  color: var(--muted);
}

.texto-centro {
  text-align: center;
}

.texto-derecha {
  text-align: right;
}

.texto-izquierda {
  text-align: left;
}
</style>
