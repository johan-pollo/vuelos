import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { quasar } from '@quasar/vite-plugin'

export default defineConfig({
  plugins: [
    vue(),
    quasar(),
  ],
})
