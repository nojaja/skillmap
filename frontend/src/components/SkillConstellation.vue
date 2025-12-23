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
  <svg
    class="h-full w-full"
    viewBox="0 0 1000 800"
    role="img"
    :aria-label="skillStore.skillTreeData.name"
  >
    <g>
      <line
        v-for="connection in connections"
        :key="`${connection.from}-${connection.to}`"
        :x1="nodes.find((n) => n.id === connection.from)?.x"
        :y1="nodes.find((n) => n.id === connection.from)?.y"
        :x2="nodes.find((n) => n.id === connection.to)?.x"
        :y2="nodes.find((n) => n.id === connection.to)?.y"
        :stroke="isConnectionUnlocked(connection.from, connection.to) ? '#67e8f9' : '#334155'"
        stroke-width="2"
        :opacity="isConnectionUnlocked(connection.from, connection.to) ? 0.9 : 0.4"
        stroke-linecap="round"
      />
    </g>

    <g>
      <g v-for="node in nodes" :key="node.id" :class="transitionClass">
        <circle
          :cx="node.x"
          :cy="node.y"
          r="16"
          :fill="skillStore.isUnlocked(node.id) ? '#22d3ee' : '#0f172a'"
          :stroke="
            isEditMode
              ? selectedNodeIds.includes(node.id)
                ? '#fbbf24'
                : '#94a3b8'
              : skillStore.canUnlock(node.id)
                ? '#67e8f9'
                : '#334155'
          "
          stroke-width="2.5"
          class="cursor-pointer"
          :class="[
            transitionClass,
            {
            'drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]': skillStore.isUnlocked(node.id),
            'hover:drop-shadow-[0_0_10px_rgba(94,234,212,0.6)]': skillStore.canUnlock(node.id),
            'ring-4 ring-amber-300/60 ring-offset-2 ring-offset-slate-900':
              isEditMode && selectedNodeIds.includes(node.id),
            },
          ]"
          @mousedown.prevent="(event) => beginDrag(node, event)"
          @click="(event) => handleNodeClick(node, event)"
        />
        <text
          :x="node.x"
          :y="node.y - 26"
          class="text-sm font-medium"
          text-anchor="middle"
          fill="#e2e8f0"
        >
          {{ node.name }}
        </text>
        <text
          :x="node.x"
          :y="node.y + 32"
          class="text-xs"
          text-anchor="middle"
          fill="#94a3b8"
          v-if="skillPointSystemEnabled"
        >
          Cost: {{ node.cost }}
        </text>
      </g>
    </g>
  </svg>
</template>
