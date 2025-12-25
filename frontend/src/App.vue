<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SkillEditorPanel from './components/SkillEditorPanel.vue'
import SkyView from './components/SkyView.vue'
import { SKILL_POINT_SYSTEM_ENABLED, useSkillStore } from './stores/skillStore'

const skillStore = useSkillStore()
const skillPointSystemEnabled = SKILL_POINT_SYSTEM_ENABLED
const newSkillHint = ref('')

const skillTreeName = computed(() => skillStore.skillTreeData.name || 'Skill Constellation')
const isLargeScreen = ref(typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true)
const panelWidth = ref(420)
const isResizingPanel = ref(false)
const panelResizeStartX = ref(0)
const panelResizeStartWidth = ref(0)
const minPanelWidth = 320
const maxPanelWidth = 720

const isEditMode = computed(() => skillStore.editMode)
const hasSelection = computed(() => skillStore.selectedSkillIds.length > 0)
const panelStyle = computed(() => ({ width: isLargeScreen.value ? `${panelWidth.value}px` : '100%' }))

let mediaQuery: MediaQueryList | null = null
let mediaQueryChangeHandler: ((event: MediaQueryListEvent) => void) | null = null

const toggleEditMode = async () => {
  await skillStore.toggleEditMode()
  newSkillHint.value = ''
}

const startNewSkillFlow = () => {
  if (!skillStore.editMode) return
  if (!hasSelection.value) {
    newSkillHint.value = '前提スキルをCtrl+クリックで選択してください'
    return
  }
  newSkillHint.value = ''
  const result = skillStore.createSkillFromSelection()
  if (!result.ok) {
    newSkillHint.value = result.message ?? 'スキルの追加に失敗しました'
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'e') {
    event.preventDefault()
    void toggleEditMode()
  }

  if (event.ctrlKey && event.key.toLowerCase() === 'i') {
    event.preventDefault()
    startNewSkillFlow()
  }
}

onMounted(() => {
  skillStore.loadSkillTree()
  skillStore.loadStatus()
  window.addEventListener('keydown', handleKeydown)
  mediaQuery = window.matchMedia('(min-width: 1024px)')
  const handleMediaChange = (event: MediaQueryListEvent) => {
    isLargeScreen.value = event.matches
  }
  isLargeScreen.value = mediaQuery.matches
  mediaQuery.addEventListener('change', handleMediaChange)
  mediaQueryChangeHandler = handleMediaChange
  window.addEventListener('mousemove', handlePanelResize)
  window.addEventListener('mouseup', stopPanelResize)
  window.addEventListener('touchmove', handlePanelResize, { passive: false })
  window.addEventListener('touchend', stopPanelResize)
  window.addEventListener('touchcancel', stopPanelResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('mousemove', handlePanelResize)
  window.removeEventListener('mouseup', stopPanelResize)
  window.removeEventListener('touchmove', handlePanelResize)
  window.removeEventListener('touchend', stopPanelResize)
  window.removeEventListener('touchcancel', stopPanelResize)
  if (mediaQuery && mediaQueryChangeHandler) {
    mediaQuery.removeEventListener('change', mediaQueryChangeHandler)
  }
})

const startPanelResize = (event: MouseEvent | TouchEvent) => {
  if (!isLargeScreen.value) return
  const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0]?.clientX
  if (clientX === undefined) return
  isResizingPanel.value = true
  panelResizeStartX.value = clientX
  panelResizeStartWidth.value = panelWidth.value
  document.body.style.cursor = 'col-resize'
}

const handlePanelResize = (event: MouseEvent | TouchEvent) => {
  if (!isResizingPanel.value) return
  const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0]?.clientX
  if (clientX === undefined) return
  if (event.cancelable) {
    event.preventDefault()
  }
  const delta = panelResizeStartX.value - clientX
  const nextWidth = Math.min(maxPanelWidth, Math.max(minPanelWidth, panelResizeStartWidth.value + delta))
  panelWidth.value = Math.round(nextWidth)
}

const stopPanelResize = () => {
  if (!isResizingPanel.value) return
  isResizingPanel.value = false
  document.body.style.cursor = ''
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-gray-100">
    <header
      class="sticky top-0 z-30 flex flex-col gap-4 border-b border-slate-800 bg-slate-950/95 px-4 pb-4 pt-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-6"
      style="padding-top: calc(env(safe-area-inset-top, 0px) + 16px);"
    >
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-cyan-300">The Skill Constellation</p>
        <h1 class="text-2xl font-semibold">{{ skillTreeName }}</h1>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <span
          class="rounded-full px-3 py-1 text-xs font-semibold"
          :class="isEditMode ? 'bg-amber-200 text-amber-900' : 'bg-slate-800 text-slate-300'"
        >
          {{ isEditMode ? '編集モード中 (Ctrl+E で完了)' : '閲覧モード (Ctrl+E で編集開始)' }}
        </span>
        <button
          class="hidden rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition hover:bg-amber-300 md:inline-flex"
          type="button"
          @click="toggleEditMode"
        >
          {{ isEditMode ? '編集モード完了 (Ctrl+E)' : '編集モード (Ctrl+E)' }}
        </button>
        <div v-if="skillPointSystemEnabled" class="text-right">
          <p class="text-xs text-slate-400">残りスキルポイント</p>
          <p class="text-2xl font-bold text-cyan-300">{{ skillStore.availablePoints }}</p>
        </div>
      </div>
    </header>

    <div class="flex flex-col gap-6 lg:flex-row">
      <div class="flex-1">
        <SkyView />
      </div>
      <div
        v-if="isEditMode"
        class="relative w-full border-t border-slate-800/70 px-6 pb-8 pt-4 lg:border-l lg:border-t-0"
        :style="panelStyle"
      >
        <div
          class="absolute -left-1 top-0 hidden h-full w-4 cursor-col-resize select-none lg:block"
          @mousedown.prevent="startPanelResize"
          @touchstart.prevent="startPanelResize"
        >
          <div class="h-full w-[2px] bg-slate-700" />
        </div>
        <SkillEditorPanel
          :start-new-skill-flow="startNewSkillFlow"
          :new-skill-hint="newSkillHint"
          :has-selection="hasSelection"
          :is-edit-mode="isEditMode"
        />
      </div>
    </div>
  </div>
</template>
