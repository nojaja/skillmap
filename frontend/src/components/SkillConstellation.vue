<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { SKILL_POINT_SYSTEM_ENABLED, useSkillStore, type SkillNode } from '../stores/skillStore'

const skillStore = useSkillStore()
const skillPointSystemEnabled = SKILL_POINT_SYSTEM_ENABLED

const nodes = computed(() => skillStore.skillTreeData.nodes)
const connections = computed(() => skillStore.skillTreeData.connections)
const isEditMode = computed(() => skillStore.editMode)
const selectedNodeIds = computed(() => skillStore.selectedSkillIds)
const focusedSkillId = ref<string | null>(null)
const focusedSkill = computed(() => nodes.value.find((node) => node.id === focusedSkillId.value) ?? null)
const clearFocus = () => {
  if (!isEditMode.value) {
    focusedSkillId.value = null
  }
}

const dragState = reactive({
  id: null as string | null,
  startX: 0,
  startY: 0,
  nodeStartX: 0,
  nodeStartY: 0,
})

const pressingNodeId = ref<string | null>(null)

const isConnectionUnlocked = (from: string, to: string) =>
  skillStore.isUnlocked(from) && skillStore.isUnlocked(to)

const displayName = (id: string) => nodes.value.find((n) => n.id === id)?.name ?? id

const isRootNode = (node: SkillNode) => !node.reqs || node.reqs.length === 0

const getVariant = (node: SkillNode): 'root' | 'unlocked' | 'available' | 'locked' => {
  if (isRootNode(node)) {
    return skillStore.isUnlocked(node.id) ? 'root' : 'available'
  }
  if (skillStore.isUnlocked(node.id)) return 'unlocked'
  if (skillStore.canUnlock(node.id)) return 'available'
  return 'locked'
}

const getAnimationDelay = (id: string) => {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  // アニメーション周期(約4秒)に合わせて -4s 〜 0s の範囲でずらす
  return `${-Math.abs(hash % 4000) / 1000}s`
}

const startDrag = (node: SkillNode, startX: number, startY: number) => {
  if (!isEditMode.value) return
  dragState.id = node.id
  dragState.startX = startX
  dragState.startY = startY
  dragState.nodeStartX = node.x
  dragState.nodeStartY = node.y
}

const handleMouseDown = (node: SkillNode, event: MouseEvent) => {
  event.stopPropagation()
  event.stopImmediatePropagation?.()
  handleLongPressStart(node)
  beginPress(node)
  startDrag(node, event.clientX, event.clientY)
}

const handleTouchStart = (node: SkillNode, event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch) return
  event.stopPropagation()
  handleLongPressStart(node)
  beginPress(node)
  startDrag(node, touch.clientX, touch.clientY)
}

const handleNodeClick = (node: SkillNode, event: MouseEvent) => {
  event.stopPropagation()
  if (isEditMode.value) {
    const multiSelect = event.ctrlKey || event.metaKey
    skillStore.toggleSelection(node.id, multiSelect)
    return
  }

  focusedSkillId.value = node.id
}

const handleBackgroundClick = () => {
  clearFocus()
}

const handleActivation = (node: SkillNode) => {
  if (isEditMode.value) return

  if (skillStore.isUnlocked(node.id) && skillStore.canDisable(node.id)) {
    skillStore.disableSkill(node.id)
    return
  }

  skillStore.unlockSkill(node.id)
}

let longPressTimer: number | null = null
const clearLongPress = () => {
  if (longPressTimer !== null) {
    window.clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const handleLongPressStart = (node: SkillNode) => {
  if (isEditMode.value) return
  clearLongPress()
  longPressTimer = window.setTimeout(() => {
    handleActivation(node)
  }, 550)
}

const handleLongPressEnd = () => {
  clearLongPress()
}

const beginPress = (node: SkillNode) => {
  if (isEditMode.value) return
  if (getVariant(node) === 'available') {
    pressingNodeId.value = node.id
  }
}

const endPress = () => {
  pressingNodeId.value = null
}

const updateDragPosition = (clientX: number, clientY: number) => {
  if (!isEditMode.value || !dragState.id) return
  const dx = clientX - dragState.startX
  const dy = clientY - dragState.startY
  skillStore.moveSkill(dragState.id, dragState.nodeStartX + dx, dragState.nodeStartY + dy)
}

const handleMouseMove = (event: MouseEvent) => {
  updateDragPosition(event.clientX, event.clientY)
}

const handleTouchMove = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch) return
  if (dragState.id) {
    event.preventDefault()
  }
  updateDragPosition(touch.clientX, touch.clientY)
}

const endDrag = () => {
  dragState.id = null
}

watch(isEditMode, (editing) => {
  if (editing) {
    focusedSkillId.value = null
  }
})

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', endDrag)
  window.addEventListener('touchcancel', endDrag)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', endDrag)
  window.removeEventListener('touchcancel', endDrag)
})
</script>

<template>
  <div class="relative h-[800px] w-[1000px]" @click="handleBackgroundClick">
    <!-- 線レイヤー (SVG) -->
    <svg class="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <defs>
        <filter id="glow-line">
          <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#4deeea" flood-opacity="0.8" />
          <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#00c3ff" flood-opacity="0.5" />
        </filter>
      </defs>
      <g v-for="connection in connections" :key="`${connection.from}-${connection.to}`">
        <!-- ベースの線 -->
        <line
          :x1="nodes.find((n) => n.id === connection.from)?.x"
          :y1="nodes.find((n) => n.id === connection.from)?.y"
          :x2="nodes.find((n) => n.id === connection.to)?.x"
          :y2="nodes.find((n) => n.id === connection.to)?.y"
          :stroke="isConnectionUnlocked(connection.from, connection.to) ? '#AEEEEE' : 'rgba(255,255,255,0.1)'"
          :stroke-width="isConnectionUnlocked(connection.from, connection.to) ? 3 : 2"
          stroke-linecap="round"
          :class="{ 'connection-unlocked': isConnectionUnlocked(connection.from, connection.to) }"
        />
        <!-- 流れる光の線 (Unlockedのみ) -->
        <line
          v-if="isConnectionUnlocked(connection.from, connection.to)"
          :x1="nodes.find((n) => n.id === connection.from)?.x"
          :y1="nodes.find((n) => n.id === connection.from)?.y"
          :x2="nodes.find((n) => n.id === connection.to)?.x"
          :y2="nodes.find((n) => n.id === connection.to)?.y"
          stroke="#ffffff"
          stroke-width="2"
          stroke-linecap="round"
          class="connection-flow"
          pathLength="100"
        />
      </g>
    </svg>

    <!-- ノードレイヤー (HTML) -->
    <div
      v-for="node in nodes"
      :key="node.id"
      class="absolute -translate-x-1/2 -translate-y-1/2 transform cursor-pointer"
      :style="{ left: `${node.x}px`, top: `${node.y}px` }"
      @mousedown.prevent="(event) => handleMouseDown(node, event)"
      @touchstart.prevent="(event) => handleTouchStart(node, event)"
      @mouseup="() => { handleLongPressEnd(); endPress() }"
      @mouseleave="() => { handleLongPressEnd(); endPress() }"
      @touchend.stop="() => { handleLongPressEnd(); endPress(); endDrag() }"
      @touchcancel.stop="() => { handleLongPressEnd(); endPress(); endDrag() }"
      @click="(event) => handleNodeClick(node, event)"
      @dblclick.prevent="() => handleActivation(node)"
    >
      <!-- 環境光 (Ambient Light) -->
      <div
        v-if="getVariant(node) === 'unlocked' || getVariant(node) === 'root'"
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/20 blur-[40px]"
        style="width: 160px; height: 160px; z-index: -1;"
      ></div>

      <!-- 星本体 -->
      <div class="hit-area"></div>
      <div
        class="star-core"
        :class="[
          getVariant(node),
          {
            'star-core--selected': isEditMode && selectedNodeIds.includes(node.id),
            'star-core--pressing': !isEditMode && getVariant(node) === 'available' && pressingNodeId === node.id,
          },
        ]"
        :style="{ animationDelay: getAnimationDelay(node.id) }"
      ></div>

      <!-- テキスト -->
      <div
        class="pointer-events-none absolute left-1/2 top-[-60px] -translate-x-1/2 whitespace-nowrap text-lg font-semibold text-slate-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] sm:top-[-32px] sm:text-base sm:font-medium"
        style="text-shadow: 0 0 8px rgba(77,238,234,0.6);"
      >
        {{ node.name }}
      </div>
      <div
        v-if="skillPointSystemEnabled"
        class="pointer-events-none absolute left-1/2 top-[28px] -translate-x-1/2 whitespace-nowrap text-xs text-slate-400"
      >
        Cost: {{ node.cost }}
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="!isEditMode && focusedSkill"
        class="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center"
      >
        <div
          class="max-w-3xl rounded-2xl border border-amber-200/40 bg-slate-900/80 px-6 py-4 shadow-[0_10px_50px_rgba(0,0,0,0.65)] backdrop-blur"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-[11px] uppercase tracking-[0.25em] text-amber-200/80">Skill</p>
              <h3 class="text-2xl font-semibold text-amber-100 drop-shadow">{{ focusedSkill.name }}</h3>
            </div>
            <div v-if="skillPointSystemEnabled" class="text-right">
              <p class="text-[11px] uppercase tracking-[0.15em] text-slate-300">Cost</p>
              <p class="text-xl font-bold text-cyan-200">{{ focusedSkill.cost }}</p>
            </div>
          </div>
          <p class="mt-3 text-sm leading-relaxed text-slate-100">
            {{ focusedSkill.description || '説明が設定されていません' }}
          </p>
          <p v-if="focusedSkill.reqs && focusedSkill.reqs.length > 0" class="mt-2 text-xs text-slate-300">
            前提: {{ focusedSkill.reqs.map((req) => displayName(req)).join(', ') }}
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.star-core {
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  position: relative;
  transition: box-shadow 0.55s ease, transform 0.55s ease;
  z-index: 10;
}

.hit-area {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 32px;
  height: 32px;
  transform: translate(-50%, -50%);
  background: transparent;
  z-index: 5;
}

/* レンズフレア (擬似要素) */
.star-core::before,
.star-core::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.95) 40%, rgba(255, 255, 255, 0.95) 60%, transparent);
  transform: translate(-50%, -50%);
  border-radius: 2px;
  pointer-events: none;
  box-shadow: 0 0 8px rgba(77, 238, 234, 0.6);
}

/* 縦の光筋 */
.star-core::before {
  width: 2px;
  height: 80px; /* 劇的に長く */
}

/* 横の光筋 */
.star-core::after {
  width: 80px; /* 劇的に長く */
  height: 2px;
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.95) 40%, rgba(255, 255, 255, 0.95) 60%, transparent);
}

/* 状態別スタイル */
.star-core.locked {
  background: #fae8ff;
  box-shadow: 
    0 0 3px 1px #e879f9, 
    0 0 8px 2px #a21caf;
  opacity: 0.65;
  width: 12px;
  height: 12px;
  --pulse-opacity-min: 0.5;
  --pulse-opacity-max: 0.75;
  animation: pulse-strong 4s infinite ease-in-out;
}
.star-core.locked::before,
.star-core.locked::after {
  display: block;
  background: linear-gradient(to bottom, transparent, rgba(232, 121, 249, 0.6) 40%, rgba(232, 121, 249, 0.6) 60%, transparent);
  box-shadow: 0 0 4px rgba(162, 28, 175, 0.4);
}
.star-core.locked::after {
  background: linear-gradient(to right, transparent, rgba(232, 121, 249, 0.6) 40%, rgba(232, 121, 249, 0.6) 60%, transparent);
}
.star-core.locked::before {
  width: 1px;
  height: 36px;
}
.star-core.locked::after {
  width: 36px;
  height: 1px;
}

.star-core.available {
  background: #fff;
  box-shadow: 0 0 6px 1px #fff, 0 0 12px 2px #4deeea;
  animation: pulse 3s infinite ease-in-out;
}
.star-core.available::before {
  height: 40px;
  opacity: 0.6;
}
.star-core.available::after {
  width: 40px;
  opacity: 0.6;
}

.star-core.available.star-core--pressing {
  box-shadow:
    0 0 8px 4px #fff,
    0 0 25px 10px #4deeea,
    0 0 60px 20px #00c3ff;
  transform: scale(1.1);
  animation: none;
}

.star-core.unlocked,
.star-core.root {
  background: #fff;
  /* 中心光源の芯を鋭く強く */
  box-shadow: 
    0 0 6px 3px #fff, 
    0 0 20px 8px #4deeea, 
    0 0 50px 15px #00c3ff;
  animation: pulse-strong 4s infinite ease-in-out;
}

/* 選択中 (EditMode) */
.star-core--selected {
  box-shadow: 
    0 0 6px 3px #fff, 
    0 0 20px 8px #fbbf24, 
    0 0 50px 15px #f59e0b !important;
}
.star-core--selected::before,
.star-core--selected::after {
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.8);
}

/* ホバー効果 */
.star-core:not(.available):hover {
  transform: scale(1.15);
  box-shadow: 
    0 0 8px 4px #fff, 
    0 0 25px 10px #4deeea, 
    0 0 60px 20px #00c3ff;
  z-index: 20;
}

/* アニメーション定義 */
@keyframes pulse {
  0% {
    opacity: 0.7;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
    filter: brightness(1.2);
  }
  100% {
    opacity: 0.7;
    transform: scale(0.9);
  }
}

@keyframes pulse-strong {
  0% {
    opacity: var(--pulse-opacity-min, 0.9);
    transform: scale(1);
    filter: brightness(1);
  }
  50% {
    opacity: var(--pulse-opacity-max, 1);
    transform: scale(1.08);
    filter: brightness(1.4); /* 眩しさを強調 */
  }
  100% {
    opacity: var(--pulse-opacity-min, 0.9);
    transform: scale(1);
    filter: brightness(1);
  }
}

.connection-unlocked {
  filter: url(#glow-line);
  animation: pulse-line 2s infinite ease-in-out;
}

.connection-flow {
  stroke-dasharray: 15 100; /* 光の長さ15, 間隔200 (pathLength=100基準) */
  stroke-dashoffset: 230;
  animation: flow-line 1.0s linear infinite;
  filter: drop-shadow(0 0 4px #fff);
  opacity: 0.5;
  mix-blend-mode: overlay;
}

@keyframes pulse-line {
  0% {
    filter: url(#glow-line) brightness(1);
    opacity: 0.8;
  }
  50% {
    filter: url(#glow-line) brightness(1.5);
    opacity: 1;
  }
  100% {
    filter: url(#glow-line) brightness(1);
    opacity: 0.8;
  }
}

@keyframes flow-line {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
