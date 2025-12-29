<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SkillEditorPanel from './components/SkillEditorPanel.vue'
import SkillCollectionModal from './components/SkillCollectionModal.vue'
import SkyView from './components/SkyView.vue'
import { SKILL_POINT_SYSTEM_ENABLED, useSkillStore } from './stores/skillStore'
import type { SkillTreeSummary } from './types/skill'

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

const generateTreeId = () => {
  const fallback = () => `tree-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return fallback()
}

const isEditMode = computed(() => skillStore.editMode)
const hasSelection = computed(() => skillStore.selectedSkillIds.length > 0)
const panelStyle = computed(() => ({ width: isLargeScreen.value ? `${panelWidth.value}px` : '100%' }))
const isCollectionModalOpen = ref(false)

let mediaQuery: MediaQueryList | null = null
let mediaQueryChangeHandler: ((event: MediaQueryListEvent) => void) | null = null

const toggleEditMode = async () => {
  await skillStore.toggleEditMode()
  newSkillHint.value = ''
}

const openCollection = () => {
  isCollectionModalOpen.value = true
  void skillStore.fetchSkillTreeCollection()
}

const resolveTreeList = async (): Promise<SkillTreeSummary[]> => {
  if (!skillStore.availableSkillTrees.length) {
    try {
      await skillStore.fetchSkillTreeCollection()
    } catch (error) {
      console.error('スキルツリー一覧の事前取得に失敗しました', error)
    }
  }

  const merged = new Map<string, SkillTreeSummary>()
  skillStore.availableSkillTrees.forEach((item) => {
    const safeId = item.id?.trim()
    if (!safeId) return
    merged.set(safeId, item)
  })

  const current: SkillTreeSummary = {
    id: skillStore.skillTreeData.id,
    name: skillTreeName.value,
    updatedAt: skillStore.skillTreeData.updatedAt ?? new Date().toISOString(),
    nodeCount: skillStore.skillTreeData.nodes?.length ?? 0,
    sourceUrl: skillStore.skillTreeData.sourceUrl,
  }
  merged.set(current.id, current)

  return Array.from(merged.values())
}

const switchTree = async (delta: number) => {
  const list = await resolveTreeList()
  if (!list.length) return

  const ids = list.map((item) => item.id)
  const currentId = skillStore.currentTreeId ?? ids[0] ?? ''
  const currentIndex = ids.indexOf(currentId)
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + delta + list.length) % list.length
  const next = list[nextIndex]
  if (!next) return

  try {
    await skillStore.activateSkillTree(next.id)
    await skillStore.fetchSkillTreeCollection()
  } catch (error) {
    console.error('スキルツリーの切り替えに失敗しました', error)
  }
}

const goPrevTree = () => void switchTree(-1)
const goNextTree = () => void switchTree(1)

const createNewSkillTree = async () => {
  const newTree = {
    id: generateTreeId(),
    name: '新規スキルツリー',
    nodes: [],
    connections: [],
    updatedAt: new Date().toISOString(),
  }
  try {
    await skillStore.applyImportedSkillTree(newTree)
  } catch (error) {
    console.error('新規スキルツリーの作成に失敗しました', error)
  }
}

const duplicateCurrentSkillTree = async () => {
  const source = skillStore.skillTreeData
  const duplicated = {
    ...JSON.parse(JSON.stringify(source)),
    id: generateTreeId(),
    name: `${source.name || 'Skill Tree'}の複製`,
    updatedAt: new Date().toISOString(),
  }
  try {
    await skillStore.applyImportedSkillTree(duplicated)
  } catch (error) {
    console.error('スキルツリーの複製に失敗しました', error)
  }
}

const importSkillTreeFromQuery = async () => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const importUrl = params.get('skillTreeUrl') || params.get('importUrl')
  if (!importUrl) return
  try {
    await skillStore.importSkillTreeFromUrl(importUrl)
  } catch (error) {
    console.error('クエリパラメータからのスキルツリーインポートに失敗しました', error)
  }
}

const startNewSkillFlow = () => {
  if (!skillStore.editMode) return
  newSkillHint.value = ''
  const result = skillStore.createSkillFromSelection()
  if (!result.ok) {
    newSkillHint.value = result.message ?? 'スキルの追加に失敗しました'
  }
}

const deleteSelectedSkills = () => {
  if (!skillStore.editMode) return
  const targets = [...skillStore.selectedSkillIds]
  targets.forEach((id) => {
    const result = skillStore.removeSkill(id)
    if (!result.ok) {
      console.warn('スキル削除に失敗しました', result.message)
    }
  })
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName?.toLowerCase()
  if (el.isContentEditable) return true
  return tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option' || tag === 'button'
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

  if (
    !event.ctrlKey &&
    event.key === 'Delete' &&
    skillStore.editMode &&
    hasSelection.value &&
    !isEditableTarget(event.target)
  ) {
    event.preventDefault()
    deleteSelectedSkills()
  }
}

onMounted(() => {
  skillStore.loadSkillTree()
  skillStore.loadStatus()
  void skillStore.fetchSkillTreeCollection()
  void importSkillTreeFromQuery()
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
  <div
    class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-gray-100"
  >
    <header
      class="sticky top-0 z-30 flex flex-col gap-4 border-b border-slate-800 bg-slate-950/95 px-4 pb-4 pt-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-6"
      style="padding-top: calc(env(safe-area-inset-top, 0px) + 16px);"
    >
      <div class="flex items-center gap-3">
        <button
          class="flex h-10 w-12 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-lg font-semibold text-slate-200 shadow-inner shadow-slate-800 transition hover:border-indigo-400 hover:text-white"
          type="button"
          aria-label="前のスキルツリー"
          @click="goPrevTree"
        >
          <span aria-hidden="true">&lt;</span>
        </button>
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-cyan-300">The Skill Constellation</p>
          <h1 class="text-2xl font-semibold">{{ skillTreeName }}</h1>
        </div>
        <button
          class="flex h-10 w-12 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-lg font-semibold text-slate-200 shadow-inner shadow-slate-800 transition hover:border-indigo-400 hover:text-white"
          type="button"
          aria-label="次のスキルツリー"
          @click="goNextTree"
        >
          <span aria-hidden="true">&gt;</span>
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <span
          class="rounded-full px-3 py-1 text-xs font-semibold"
          :class="isEditMode ? 'bg-amber-200 text-amber-900' : 'bg-slate-800 text-slate-300'"
        >
          {{ isEditMode ? '編集モード中 (Ctrl+E で完了)' : '閲覧モード (Ctrl+E で編集開始)' }}
        </span>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-if="isLargeScreen"
            class="inline-flex items-center rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition hover:bg-amber-300"
            type="button"
            @click="toggleEditMode"
          >
            {{ isEditMode ? '編集モード完了 (Ctrl+E)' : '編集モード (Ctrl+E)' }}
          </button>
          <button
            class="inline-flex items-center rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400"
            type="button"
            @click="openCollection"
          >
            コレクション
          </button>
        </div>
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
        <div class="mb-4 flex flex-wrap justify-end gap-2">
          <button
            class="inline-flex items-center rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 shadow-inner shadow-slate-900 transition hover:bg-slate-700"
            type="button"
            @click="createNewSkillTree"
          >
            新規スキルツリー
          </button>
          <button
            class="inline-flex items-center rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 shadow-inner shadow-slate-900 transition hover:bg-slate-700"
            type="button"
            @click="duplicateCurrentSkillTree"
          >
            スキルツリー複製
          </button>
        </div>
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
    <SkillCollectionModal :visible="isCollectionModalOpen" @close="isCollectionModalOpen = false" />
  </div>
</template>
