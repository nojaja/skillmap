<script setup lang="ts">
import { computed } from 'vue'
import { useSkillStore, type SkillNode } from '../stores/skillStore'

const skillStore = useSkillStore()

const nodes = computed(() => skillStore.skillTreeData.nodes)
const connections = computed(() => skillStore.skillTreeData.connections)

const isConnectionUnlocked = (from: string, to: string) =>
  skillStore.isUnlocked(from) && skillStore.isUnlocked(to)

const handleNodeClick = (node: SkillNode) => {
  skillStore.unlockSkill(node.id)
}
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
      <g v-for="node in nodes" :key="node.id" class="transition-all duration-200">
        <circle
          :cx="node.x"
          :cy="node.y"
          r="16"
          :fill="skillStore.isUnlocked(node.id) ? '#22d3ee' : '#0f172a'"
          :stroke="skillStore.canUnlock(node.id) ? '#67e8f9' : '#334155'"
          stroke-width="2.5"
          class="cursor-pointer transition-all duration-200"
          :class="{
            'drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]': skillStore.isUnlocked(node.id),
            'hover:drop-shadow-[0_0_10px_rgba(94,234,212,0.6)]': skillStore.canUnlock(node.id),
          }"
          @click="handleNodeClick(node)"
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
        >
          Cost: {{ node.cost }}
        </text>
      </g>
    </g>
  </svg>
</template>
