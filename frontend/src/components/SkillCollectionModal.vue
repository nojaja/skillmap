<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSkillStore } from '../stores/skillStore'
import { defaultSkillTree } from '../services/skillNormalizer'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const skillStore = useSkillStore()
const urlInput = ref('')
const ioMessage = ref('')
const working = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const collections = computed(() => skillStore.availableSkillTrees)
const isLoading = computed(() => skillStore.collectionLoading || working.value)
const currentTreeId = computed(() => skillStore.currentTreeId)

const formatDate = (value: string) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const ensureCollection = async () => {
  if (!props.visible) return
  await skillStore.fetchSkillTreeCollection()
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      ioMessage.value = ''
      urlInput.value = ''
      void ensureCollection()
    }
  },
)

onMounted(() => {
  if (props.visible) {
    void ensureCollection()
  }
})

const openFilePicker = () => {
  fileInputRef.value?.click()
}

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  await importFromFile(file)
}

const importFromFile = async (file: File) => {
  try {
    working.value = true
    ioMessage.value = 'インポート中です...'
    await skillStore.importSkillTreeFromFile(file)
    ioMessage.value = `${file.name} をインポートしました`
  } catch (error) {
    if ((error as Error)?.message === 'import-cancelled') {
      ioMessage.value = 'インポートをキャンセルしました'
    } else {
      console.error('ファイルインポートに失敗しました', error)
      ioMessage.value = 'ファイルインポートに失敗しました'
    }
  } finally {
    working.value = false
  }
}

const importFromUrl = async () => {
  try {
    const target = urlInput.value.trim()
    if (!target) {
      ioMessage.value = 'URLを入力してください'
      return
    }
    working.value = true
    ioMessage.value = 'URLからインポートしています...'
    await skillStore.importSkillTreeFromUrl(target)
    ioMessage.value = 'URLからインポートしました'
  } catch (error) {
    if ((error as Error)?.message === 'import-cancelled') {
      ioMessage.value = 'インポートをキャンセルしました'
    } else {
      console.error('URLインポートに失敗しました', error)
      ioMessage.value = 'URLインポートに失敗しました'
    }
  } finally {
    working.value = false
  }
}

const handleActivate = async (treeId: string) => {
  try {
    working.value = true
    await skillStore.activateSkillTree(treeId)
    ioMessage.value = `${treeId} を読み込みました`
    emit('close')
  } catch (error) {
    console.error('スキルツリーの切替に失敗しました', error)
    ioMessage.value = 'スキルツリーの切替に失敗しました'
  } finally {
    working.value = false
  }
}

const handleDelete = async (treeId: string) => {
  if (treeId === defaultSkillTree.id) return
  const confirmed = window.confirm('このスキルツリーを削除しますか？')
  if (!confirmed) return
  working.value = true
  const result = await skillStore.deleteSkillTree(treeId)
  ioMessage.value = result.ok ? 'スキルツリーを削除しました' : result.message ?? '削除に失敗しました'
  working.value = false
}

const handleExport = async (treeId: string) => {
  working.value = true
  ioMessage.value = ''
  try {
    await skillStore.exportSkillTreeById(treeId)
    ioMessage.value = 'スキルツリーをエクスポートしました'
  } catch (error) {
    console.error('エクスポートに失敗しました', error)
    ioMessage.value = 'エクスポートに失敗しました'
  } finally {
    working.value = false
  }
}
</script>

<template>
  <teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 px-4 py-8 backdrop-blur"
      aria-modal="true"
      role="dialog"
    >
      <div class="w-full max-w-5xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl" style="max-height: calc(100vh - 3rem); overflow-y: auto;">
        <div class="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-cyan-300">Collection</p>
            <h2 class="text-xl font-semibold text-white">スキルツリーコレクション</h2>
            <p class="text-xs text-slate-400">
              複数のスキルツリー定義をインポート・切替・削除できます。ファイルまたはURLから取り込めます。
            </p>
          </div>
          <button
            class="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200 transition hover:bg-slate-700"
            type="button"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>

        <div class="grid gap-6 px-6 py-5 md:grid-cols-2">
          <section class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold text-white">インポート</h3>
              <span class="text-xs text-slate-400">JSON</span>
            </div>
            <div class="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <div class="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <p class="text-sm font-semibold text-slate-100">ファイルからインポート</p>
                <p class="text-xs text-slate-400">ローカルのJSONファイルを選択してください。</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    class="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:opacity-50"
                    type="button"
                    :disabled="isLoading"
                    @click="openFilePicker"
                  >
                    ファイルを選択
                  </button>
                  <input
                    ref="fileInputRef"
                    class="hidden"
                    type="file"
                    accept="application/json"
                    @change="handleFileChange"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <p class="text-sm font-semibold text-slate-100">URLからインポート</p>
                <p class="text-xs text-slate-400">公開URL上のJSONを読み込みます。</p>
                <div class="flex flex-col gap-2 sm:flex-row">
                  <input
                    v-model="urlInput"
                    class="flex-1 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                    :disabled="isLoading"
                    placeholder="https://example.com/skill-tree.json"
                    type="url"
                  />
                  <button
                    class="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
                    type="button"
                    :disabled="isLoading"
                    @click="importFromUrl"
                  >
                    取り込む
                  </button>
                </div>
              </div>

              <p v-if="ioMessage" class="text-xs text-cyan-300">{{ ioMessage }}</p>
            </div>
          </section>

          <section class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold text-white">保存済みスキルツリー</h3>
              <span class="text-xs text-slate-400">{{ collections.length }} 件</span>
            </div>
            <div class="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <div v-if="skillStore.collectionLoading" class="text-sm text-slate-300">読み込み中...</div>
              <div v-else-if="collections.length === 0" class="text-sm text-slate-400">まだスキルツリーがありません。</div>
              <div v-else class="space-y-3">
                <article
                  v-for="tree in collections"
                  :key="tree.id"
                  class="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p class="text-sm font-semibold text-white">{{ tree.name }}</p>
                      <p class="text-xs text-slate-400">ID: {{ tree.id }}</p>
                      <p class="text-xs text-slate-400">更新: {{ formatDate(tree.updatedAt) }}</p>
                      <p class="text-xs text-slate-400">ノード数: {{ tree.nodeCount }}</p>
                    </div>
                    <span
                      v-if="tree.id === currentTreeId"
                      class="rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-amber-950"
                    >
                      現在
                    </span>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <button
                      class="inline-flex items-center justify-center rounded-md bg-indigo-500 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-400 disabled:opacity-50"
                      type="button"
                      :disabled="isLoading"
                      @click="handleActivate(tree.id)"
                    >
                      このツリーを開く
                    </button>
                    <button
                      class="inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-50"
                      type="button"
                      :disabled="isLoading"
                      @click="handleExport(tree.id)"
                    >
                      エクスポート
                    </button>
                    <button
                      class="inline-flex items-center justify-center rounded-md bg-rose-500 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-rose-500/30 transition hover:bg-rose-400 disabled:opacity-50"
                      type="button"
                      :disabled="tree.id === defaultSkillTree.id || isLoading"
                      @click="handleDelete(tree.id)"
                    >
                      削除
                    </button>
                  </div>
                </article>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </teleport>
</template>
