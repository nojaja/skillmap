<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SkillConstellation from './SkillConstellation.vue'
import { useSkillStore } from '../stores/skillStore'

const skillStore = useSkillStore()

const offset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const initialOffset = ref({ x: 0, y: 0 })

const canDragView = computed(() => !skillStore.editMode)

const onMouseDown = (event: MouseEvent) => {
  if (!canDragView.value) return
  isDragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  initialOffset.value = { ...offset.value }
}

const onMouseMove = (event: MouseEvent) => {
  if (!canDragView.value) return
  if (!isDragging.value) return
  const dx = event.clientX - dragStart.value.x
  const dy = event.clientY - dragStart.value.y
  offset.value = {
    x: initialOffset.value.x + dx,
    y: initialOffset.value.y + dy,
  }
}

const stopDragging = () => {
  isDragging.value = false
}

onMounted(() => {
  window.addEventListener('mouseup', stopDragging)
})

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', stopDragging)
})
</script>

<template>
  <div
    class="relative h-[calc(100vh-96px)] overflow-hidden bg-[#050505]"
    style="
      background-image: radial-gradient(circle at 50% 50%, #111827 0%, #000000 100%),
        radial-gradient(circle at 50% 40%, rgba(30, 58, 138, 0.2) 0%, transparent 60%),
        radial-gradient(circle at 80% 20%, rgba(76, 29, 149, 0.15) 0%, transparent 50%);
    "
  >
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_rgba(14,165,233,0.05)_0,_rgba(0,0,0,0)_70%)]"
    />

    <div
      class="relative h-full cursor-grab active:cursor-grabbing"
      @mousedown.prevent="onMouseDown"
      @mousemove="onMouseMove"
    >
      <div
        class="h-full w-full transition-transform duration-75"
        :style="{ transform: `translate(${offset.x}px, ${offset.y}px)` }"
      >
        <SkillConstellation />
      </div>
    </div>
  </div>
</template>
