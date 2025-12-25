import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { ensureServiceWorker } from './services/browserApiAdapter'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

void ensureServiceWorker().catch((error) => {
	console.error('Service Worker の登録に失敗しました', error)
})
