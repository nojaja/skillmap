<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SkillEditorPanel from './components/SkillEditorPanel.vue'
import SkyView from './components/SkyView.vue'
import { SKILL_POINT_SYSTEM_ENABLED, useSkillStore } from './stores/skillStore'

const skillStore = useSkillStore()
const skillPointSystemEnabled = SKILL_POINT_SYSTEM_ENABLED
const newSkillHint = ref('')

const isEditMode = computed(() => skillStore.editMode)
const hasSelection = computed(() => skillStore.selectedSkillIds.length > 0)

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
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-gray-100">
    <header
      class="sticky top-0 z-30 flex flex-col gap-4 border-b border-slate-800 bg-slate-950/95 px-4 pb-4 pt-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-6"
      style="padding-top: calc(env(safe-area-inset-top, 0px) + 16px);"
    >
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-cyan-300">The Elder Scrolls V</p>
        <h1 class="text-2xl font-semibold">Skyrim Skill Constellation</h1>
        <p class="text-sm text-slate-400">
          ドラッグで移動し、星をクリックしてスキルを習得します。編集モードではCtrl+クリックで前提スキルを複数選択できます。
        </p>
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
        <button
          class="hidden rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
          type="button"
          :disabled="!isEditMode || !hasSelection"
          :title="!hasSelection ? '前提スキルを選択すると有効になります (Ctrl+クリック)' : 'Ctrl+I でも開けます'"
          @click="startNewSkillFlow"
        >
          新規スキル追加 (Ctrl+I)
        </button>
        <div v-if="skillPointSystemEnabled" class="text-right">
          <p class="text-xs text-slate-400">残りスキルポイント</p>
          <p class="text-2xl font-bold text-cyan-300">{{ skillStore.availablePoints }}</p>
        </div>
      </div>
      <p v-if="newSkillHint" class="text-sm text-amber-300">{{ newSkillHint }}</p>
    </header>

    <div class="flex flex-col gap-6 lg:flex-row">
      <div class="flex-1">
        <SkyView />
      </div>
      <div
        v-if="isEditMode"
        class="w-full border-t border-slate-800/70 px-6 pb-8 pt-4 lg:w-[420px] lg:border-l lg:border-t-0"
      >
        <SkillEditorPanel />
      </div>
    </div>
  </div>
</template>
