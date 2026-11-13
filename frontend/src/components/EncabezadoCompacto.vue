<template>
  <div class="compact-heading">
    <p v-if="showEyebrow" class="eyebrow">{{ eyebrow }}</p>
    <component :is="titleTag" :class="titleClass">{{ title }}</component>
  </div>
</template>

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

<style scoped>
.compact-heading {
  display: block;
}
</style>
