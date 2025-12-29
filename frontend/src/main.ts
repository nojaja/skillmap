import type { App as VueApp, Component, Plugin } from 'vue'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { ensureServiceWorker } from './services/browserApiAdapter'

const rootComponent: Component = App
const app: VueApp = createApp(rootComponent)

app.use(createPinia() as Plugin)
app.mount('#app')

void ensureServiceWorker().catch((error: unknown) => {
	const reason = error instanceof Error ? error : new Error(String(error))
	console.error('Service Worker の登録に失敗しました', reason)
})
