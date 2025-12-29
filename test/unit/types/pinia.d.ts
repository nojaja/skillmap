declare module 'pinia' {
  export function createPinia(): any
  export function setActivePinia(pinia: any): void
  export function defineStore(id: string, options: any): any
}
