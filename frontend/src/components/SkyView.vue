<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SkillConstellation from './SkillConstellation.vue'

const offset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const initialOffset = ref({ x: 0, y: 0 })

// 編集モードでもビュー全体をドラッグできるように常にtrue
const canDragView = computed(() => true)

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

const onTouchStart = (event: TouchEvent) => {
  if (!canDragView.value) return
  const touch = event.touches[0]
  if (!touch) return
  isDragging.value = true
  dragStart.value = { x: touch.clientX, y: touch.clientY }
  initialOffset.value = { ...offset.value }
}

const onTouchMove = (event: TouchEvent) => {
  if (!canDragView.value) return
  if (!isDragging.value) return
  const touch = event.touches[0]
  if (!touch) return
  event.preventDefault()
  const dx = touch.clientX - dragStart.value.x
  const dy = touch.clientY - dragStart.value.y
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
  window.addEventListener('touchend', stopDragging)
  window.addEventListener('touchcancel', stopDragging)
})

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', stopDragging)
  window.removeEventListener('touchend', stopDragging)
  window.removeEventListener('touchcancel', stopDragging)
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
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
    >
      <div
        class="h-full w-full transition-transform duration-75 sky-inner"
        :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(var(--sky-scale, 1))` }"
      >
        <SkillConstellation />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sky-inner {
  transform-origin: center;
}

@media (max-width: 768px) {
  .sky-inner {
    --sky-scale: 1.12;
  }
}
</style>
