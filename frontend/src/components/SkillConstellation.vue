<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { SKILL_POINT_SYSTEM_ENABLED, useSkillStore, type SkillNode } from '../stores/skillStore'

const skillStore = useSkillStore()
const skillPointSystemEnabled = SKILL_POINT_SYSTEM_ENABLED

const nodes = computed(() => skillStore.skillTreeData.nodes)
const connections = computed(() => skillStore.skillTreeData.connections)
const isEditMode = computed(() => skillStore.editMode)
const selectedNodeIds = computed(() => skillStore.selectedSkillIds)
const transitionClass = computed(() => (isEditMode.value ? '' : 'transition-all duration-200'))

const dragState = reactive({
  id: null as string | null,
  startX: 0,
  startY: 0,
  nodeStartX: 0,
  nodeStartY: 0,
})

const isConnectionUnlocked = (from: string, to: string) =>
  skillStore.isUnlocked(from) && skillStore.isUnlocked(to)

const createDiamondPath = (radius = 18) => {
  const r = radius
  return `M0,${-r} L${r},0 L0,${r} L${-r},0 Z`
}

const STAR_PATH = createDiamondPath()

const isRootNode = (node: SkillNode) => !node.reqs || node.reqs.length === 0

const getVariant = (node: SkillNode) => {
  if (skillStore.isUnlocked(node.id)) return 'unlocked'
  if (isRootNode(node)) return 'root'
  if (skillStore.canUnlock(node.id)) return 'available'
  return 'locked'
}

const getStrokeColor = (node: SkillNode, selected: boolean) => {
  if (isEditMode.value) return selected ? '#fbbf24' : '#94a3b8'
  const variant = getVariant(node)
  if (variant === 'unlocked') return '#e0f2fe'
  if (variant === 'available') return '#67e8f9'
  if (variant === 'root') return '#f8fafc'
  return '#334155'
}

const beginDrag = (node: SkillNode, event: MouseEvent) => {
  if (!isEditMode.value) return
  event.stopPropagation()
  event.stopImmediatePropagation?.()
  dragState.id = node.id
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  dragState.nodeStartX = node.x
  dragState.nodeStartY = node.y
}

const handleNodeClick = (node: SkillNode, event: MouseEvent) => {
  if (isEditMode.value) {
    const multiSelect = event.ctrlKey || event.metaKey
    skillStore.toggleSelection(node.id, multiSelect)
    return
  }

  if (skillStore.isUnlocked(node.id) && skillStore.canDisable(node.id)) {
    skillStore.disableSkill(node.id)
    return
  }

  skillStore.unlockSkill(node.id)
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isEditMode.value || !dragState.id) return
  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  skillStore.moveSkill(dragState.id, dragState.nodeStartX + dx, dragState.nodeStartY + dy)
}

const endDrag = () => {
  dragState.id = null
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', endDrag)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', endDrag)
})
</script>

<template>
  <div class="relative h-[800px] w-[1000px]">
    <!-- 線レイヤー (SVG) -->
    <svg class="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <defs>
        <filter id="glow-line">
          <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#4deeea" flood-opacity="0.8" />
          <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#00c3ff" flood-opacity="0.5" />
        </filter>
      </defs>
      <line
        v-for="connection in connections"
        :key="`${connection.from}-${connection.to}`"
        :x1="nodes.find((n) => n.id === connection.from)?.x"
        :y1="nodes.find((n) => n.id === connection.from)?.y"
        :x2="nodes.find((n) => n.id === connection.to)?.x"
        :y2="nodes.find((n) => n.id === connection.to)?.y"
        :stroke="isConnectionUnlocked(connection.from, connection.to) ? '#AEEEEE' : 'rgba(255,255,255,0.1)'"
        :stroke-width="isConnectionUnlocked(connection.from, connection.to) ? 3 : 2"
        stroke-linecap="round"
        :style="isConnectionUnlocked(connection.from, connection.to) ? 'filter: url(#glow-line); opacity: 0.9;' : ''"
      />
    </svg>

    <!-- ノードレイヤー (HTML) -->
    <div
      v-for="node in nodes"
      :key="node.id"
      class="absolute -translate-x-1/2 -translate-y-1/2 transform cursor-pointer"
      :style="{ left: `${node.x}px`, top: `${node.y}px` }"
      @mousedown.prevent="(event) => beginDrag(node, event)"
      @click="(event) => handleNodeClick(node, event)"
    >
      <!-- 環境光 (Ambient Light) -->
      <div
        v-if="getVariant(node) === 'unlocked' || getVariant(node) === 'root'"
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/20 blur-[40px]"
        style="width: 160px; height: 160px; z-index: -1;"
      ></div>

      <!-- 星本体 -->
      <div
        class="star-core"
        :class="[
          getVariant(node),
          { 'star-core--selected': isEditMode && selectedNodeIds.includes(node.id) },
        ]"
      ></div>

      <!-- テキスト -->
      <div class="pointer-events-none absolute left-1/2 top-[-32px] -translate-x-1/2 whitespace-nowrap text-sm font-medium text-slate-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style="text-shadow: 0 0 8px rgba(77,238,234,0.6);">
        {{ node.name }}
      </div>
      <div
        v-if="skillPointSystemEnabled"
        class="pointer-events-none absolute left-1/2 top-[28px] -translate-x-1/2 whitespace-nowrap text-xs text-slate-400"
      >
        Cost: {{ node.cost }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.star-core {
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  position: relative;
  transition: all 0.3s ease;
  z-index: 10;
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
  background: #334155;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.2);
  opacity: 0.6;
  width: 10px;
  height: 10px;
}
.star-core.locked::before,
.star-core.locked::after {
  display: none;
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
.star-core:hover {
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
    opacity: 0.9;
    transform: scale(1);
    filter: brightness(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
    filter: brightness(1.4); /* 眩しさを強調 */
  }
  100% {
    opacity: 0.9;
    transform: scale(1);
    filter: brightness(1);
  }
}
</style>
