<template>
  <div class="back-button-wrapper">
    <q-btn flat icon="arrow_back" :to="to" class="back-navigation">{{ label }}</q-btn>
  </div>
</template>

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

<style scoped>
.back-button-wrapper {
  display: flex;
  width: fit-content;
  margin-bottom: 10px;
}
</style>
