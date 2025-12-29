<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useSkillStore, type SkillDraft } from '../stores/skillStore'

const skillStore = useSkillStore()

const props = defineProps<{
  startNewSkillFlow: () => void
  newSkillHint: string
  hasSelection: boolean
  isEditMode: boolean
}>()

const editSkillForm = reactive<SkillDraft>({
  id: '',
  name: '',
  cost: 0,
  x: 0,
  y: 0,
  description: '',
  reqs: [],
  reqMode: 'and',
})

const editMessage = ref('')
const editReqInput = ref('')
const treeNameInput = ref(skillStore.skillTreeData.name)
const treeMessage = ref('')
const displayName = (id: string) => skillStore.skillTreeData.nodes.find((n) => n.id === id)?.name ?? id
const hasActiveSkill = computed(() => Boolean(skillStore.activeSkill))
const onReqInputFocus = () => {
  skillStore.setDependencyInputFocus(true)
}
const onReqInputBlur = () => {
  window.setTimeout(() => {
    skillStore.setDependencyInputFocus(false)
  }, 0)
}

const resetEditSkillForm = () => {
  editSkillForm.id = ''
  editSkillForm.name = ''
  editSkillForm.cost = 0
  editSkillForm.x = 0
  editSkillForm.y = 0
  editSkillForm.description = ''
  editSkillForm.reqs = []
  editMessage.value = ''
  editReqInput.value = ''
}

watch(
  () => skillStore.skillTreeData.name,
  (name) => {
    treeNameInput.value = name
  },
  { immediate: true },
)

watch(
  () => skillStore.activeSkill,
  (skill) => {
    if (!skill) {
      resetEditSkillForm()
      return
    }

    editSkillForm.id = skill.id
    editSkillForm.name = skill.name
    editSkillForm.cost = skill.cost
    editSkillForm.x = skill.x
    editSkillForm.y = skill.y
    editSkillForm.description = skill.description ?? ''
    editSkillForm.reqs = [...(skill.reqs ?? [])]
    editSkillForm.reqMode = skill.reqMode ?? 'and'
    editMessage.value = ''
  },
  { immediate: true, deep: true },
)

const handleUpdate = () => {
  if (!skillStore.editMode || !hasActiveSkill.value) return

  editMessage.value = ''
  const result = skillStore.updateSkill({
    ...editSkillForm,
    reqs: Array.from(new Set(editSkillForm.reqs)),
  })

  editMessage.value = result.ok ? 'スキルを更新しました' : result.message ?? '更新に失敗しました'
}

const handleUpdateTreeName = () => {
  treeMessage.value = ''
  const result = skillStore.updateSkillTreeName(treeNameInput.value)
  treeMessage.value = result.ok ? 'スキルツリー名を更新しました' : result.message ?? '更新に失敗しました'
}

const handleDelete = () => {
  if (!skillStore.editMode || !hasActiveSkill.value) return

  editMessage.value = ''
  const result = skillStore.removeSkill(editSkillForm.id)
  editMessage.value = result.ok ? 'スキルを削除しました' : result.message ?? '削除に失敗しました'

  if (result.ok) {
    resetEditSkillForm()
  }
}

const addReqFromInput = () => {
  const tokens = editReqInput.value
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  if (tokens.length === 0) return

  editSkillForm.reqs = Array.from(new Set([...editSkillForm.reqs, ...tokens]))
  editReqInput.value = ''
}

watch(
  () => skillStore.dependencyInputSelectionToken,
  () => {
    if (!skillStore.dependencyInputSelectedId) return
    if (!skillStore.editMode || !hasActiveSkill.value) return
    editReqInput.value = skillStore.dependencyInputSelectedId
    addReqFromInput()
  },
)

const removeReq = (id: string) => {
  editSkillForm.reqs = editSkillForm.reqs.filter((req) => req !== id)
  handleUpdate()
}

</script>

<template>
  <section class="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-5 shadow-lg shadow-black/30">
    <header class="mb-4 flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-cyan-300">Editor</p>
        <h2 class="text-lg font-semibold">スキル編集パネル</h2>
      </div>
      <span
        class="rounded-full px-3 py-1 text-xs font-semibold"
        :class="skillStore.editMode ? 'bg-amber-200 text-amber-900' : 'bg-slate-800 text-slate-400'"
      >
        {{ skillStore.editMode ? '編集中' : '編集オフ' }}
      </span>
    </header>

    <div class="space-y-6">
      <div class="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-slate-100">スキルツリー設定</h3>
            <p class="text-xs text-slate-400">名称編集と新規スキルの追加</p>
          </div>
          <button
            class="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            :disabled="!props.isEditMode"
            title="Ctrl+I でも開けます"
            @click="props.startNewSkillFlow"
          >
            新規スキル追加 (Ctrl+I)
          </button>
        </div>
        <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label class="text-sm text-slate-200">
            スキルツリー名
            <input
              v-model="treeNameInput"
              class="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-amber-300 focus:outline-none disabled:opacity-60"
              :disabled="!skillStore.editMode"
              type="text"
            />
          </label>
          <div class="flex justify-end gap-2">
            <button
              class="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/25 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              :disabled="!skillStore.editMode"
              @click="handleUpdateTreeName"
            >
              名称を更新
            </button>
          </div>
        </div>
        <div class="mt-2 space-y-1 text-xs">
          <p v-if="treeMessage" class="text-cyan-300">{{ treeMessage }}</p>
          <p v-if="props.newSkillHint" class="text-amber-300">{{ props.newSkillHint }}</p>
        </div>
      </div>

      <div class="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-slate-100">選択中のスキルを編集</h3>
          <span class="text-xs text-slate-400">
            {{ hasActiveSkill ? skillStore.activeSkill?.name : 'スキルを選択してください' }}
          </span>
        </div>
        <p class="mb-3 text-xs text-slate-400">編集・削除は編集モード時のみ行えます。</p>

        <form class="space-y-3" @submit.prevent="handleUpdate">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-1">
            <label class="text-sm text-slate-200">
              表示名
              <input
                v-model="editSkillForm.name"
                class="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-amber-300 focus:outline-none disabled:opacity-60"
                :disabled="!skillStore.editMode || !hasActiveSkill"
                type="text"
              />
            </label>
          </div>

          <div>
            <label class="text-sm text-slate-200">
              説明
              <textarea
                v-model="editSkillForm.description"
                class="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-amber-300 focus:outline-none disabled:opacity-60"
                :disabled="!skillStore.editMode || !hasActiveSkill"
                rows="3"
                placeholder="スキルの概要や効果を入力"
              ></textarea>
            </label>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label class="text-sm text-slate-200">
              コスト
              <input
                v-model.number="editSkillForm.cost"
                class="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-amber-300 focus:outline-none disabled:opacity-60"
                :disabled="!skillStore.editMode || !hasActiveSkill"
                min="0"
                type="number"
              />
            </label>
            <label class="text-sm text-slate-200">
              X 座標
              <input
                v-model.number="editSkillForm.x"
                class="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-amber-300 focus:outline-none disabled:opacity-60"
                :disabled="!skillStore.editMode || !hasActiveSkill"
                type="number"
              />
            </label>
            <label class="text-sm text-slate-200">
              Y 座標
              <input
                v-model.number="editSkillForm.y"
                class="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-amber-300 focus:outline-none disabled:opacity-60"
                :disabled="!skillStore.editMode || !hasActiveSkill"
                type="number"
              />
            </label>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm text-slate-200">依存スキル (Chips入力)</span>
              <span class="text-[11px] text-slate-400">Enter またはカンマで追加</span>
            </div>
            <div class="flex items-center gap-3 text-xs text-slate-200">
              <label class="inline-flex items-center gap-1">
                <input
                  v-model="editSkillForm.reqMode"
                  class="accent-amber-400"
                  type="radio"
                  value="and"
                  :disabled="!skillStore.editMode || !hasActiveSkill"
                />
                <span>AND (すべて必要)</span>
              </label>
              <label class="inline-flex items-center gap-1">
                <input
                  v-model="editSkillForm.reqMode"
                  class="accent-amber-400"
                  type="radio"
                  value="or"
                  :disabled="!skillStore.editMode || !hasActiveSkill"
                />
                <span>OR (どれか1つで可)</span>
              </label>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="req in editSkillForm.reqs"
                :key="req"
                class="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-100"
              >
                <span>{{ displayName(req) }}</span>
                <button
                  type="button"
                  class="text-slate-400 hover:text-rose-300"
                  :disabled="!skillStore.editMode || !hasActiveSkill"
                  @click="removeReq(req)"
                >
                  ✕
                </button>
              </span>
            </div>
            <input
              v-model="editReqInput"
              class="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:border-amber-300 focus:outline-none disabled:opacity-60"
              :disabled="!skillStore.editMode || !hasActiveSkill"
              placeholder="依存スキルIDを入力し Enter / , で追加"
              type="text"
              @focus="onReqInputFocus"
              @blur="onReqInputBlur"
              @keydown.enter.prevent="addReqFromInput"
              @keydown.space.stop
              @keydown.,.prevent="addReqFromInput"
            />
            <div class="flex justify-end">
              <button
                type="button"
                class="rounded-md bg-slate-700 px-3 py-1 text-xs text-slate-100 transition hover:bg-slate-600 disabled:opacity-50"
                :disabled="!skillStore.editMode || !hasActiveSkill"
                @click="addReqFromInput"
              >
                追加
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2">
            <button
              class="rounded-md bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              :disabled="!skillStore.editMode || !hasActiveSkill"
              @click="handleDelete"
            >
              削除
            </button>
            <button
              class="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/25 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              :disabled="!skillStore.editMode || !hasActiveSkill"
            >
              更新
            </button>
          </div>
          <p v-if="editMessage" class="text-xs text-amber-300">{{ editMessage }}</p>
        </form>
      </div>

    </div>
  </section>
</template>
