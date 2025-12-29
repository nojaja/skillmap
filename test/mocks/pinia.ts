// Minimal Pinia mock for Jest unit tests
export const createPinia = () => ({})
export const setActivePinia = (_: unknown) => {}

export const defineStore = (_id: string, options: any) => {
  return () => {
    const state = typeof options.state === 'function' ? options.state() : {}
    const store: Record<string, any> = { ...state }

    if (options.getters) {
      for (const [key, getter] of Object.entries(options.getters)) {
        Object.defineProperty(store, key, {
          enumerable: true,
          get: () => (getter as (s: any) => any).call(store, store),
        })
      }
    }

    if (options.actions) {
      for (const [key, action] of Object.entries(options.actions)) {
        store[key] = (action as Function).bind(store)
      }
    }

    return store
  }
}
