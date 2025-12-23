<script setup lang="ts">
import { onMounted } from 'vue'
import SkyView from './components/SkyView.vue'
import { useSkillStore } from './stores/skillStore'

const skillStore = useSkillStore()

onMounted(() => {
  skillStore.loadStatus()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-gray-100">
    <header class="flex items-center justify-between gap-6 border-b border-slate-800 px-6 py-4">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-cyan-300">The Elder Scrolls V</p>
        <h1 class="text-2xl font-semibold">Skyrim Skill Constellation</h1>
        <p class="text-sm text-slate-400">ドラッグで移動し、星をクリックしてスキルを習得します。</p>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-right">
          <p class="text-xs text-slate-400">残りスキルポイント</p>
          <p class="text-2xl font-bold text-cyan-300">{{ skillStore.availablePoints }}</p>
        </div>
        <button
          class="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
          type="button"
          @click="skillStore.saveProgress"
        >
          進行状況を保存
        </button>
      </div>
    </header>

    <SkyView />
  </div>
</template>
