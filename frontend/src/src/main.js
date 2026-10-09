import { createApp } from 'vue'
import { Quasar, Notify, Dialog } from 'quasar'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)
app.use(Quasar, {
  plugins: {
    Notify,
    Dialog,
  },
  config: {
    brand: {
      primary: '#d72638',
      secondary: '#120d1a',
      accent: '#f8d7da',
      dark: '#120d1a',
      positive: '#1dbf73',
      negative: '#d72638',
      warning: '#f59e0b',
      info: '#2563eb',
    },
    notify: { position: 'top-right' },
  },
})

app.mount('#app')
