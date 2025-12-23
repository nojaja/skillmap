<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import SkillConstellation from './SkillConstellation.vue'

const offset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const initialOffset = ref({ x: 0, y: 0 })

const onMouseDown = (event: MouseEvent) => {
  isDragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  initialOffset.value = { ...offset.value }
}

const onMouseMove = (event: MouseEvent) => {
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
    class="relative h-[calc(100vh-96px)] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.95),_rgba(2,6,23,1))]"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_rgba(14,165,233,0.14)_0,_rgba(15,23,42,0)_40%)] blur-3xl"
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
