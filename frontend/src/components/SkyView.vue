<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import SkillConstellation from './SkillConstellation.vue'
import SkyrimLevelGauge from './SkyrimLevelGauge.vue'

const offset = ref({ x: 0, y: 0 })
const scale = ref(window.matchMedia('(max-width: 768px)').matches ? 1.12 : 1)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const initialOffset = ref({ x: 0, y: 0 })
const pinchState = reactive({ active: false, startDistance: 0, startScale: 1 })

const MIN_SCALE = 0.6
const MAX_SCALE = 2.5

const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
const applyScale = (value: number) => {
  scale.value = clampScale(value)
}

const canDragView = computed(() => true)

const onMouseDown = (event: MouseEvent) => {
  if (!canDragView.value) return
  isDragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  initialOffset.value = { ...offset.value }
}

const onMouseMove = (event: MouseEvent) => {
  if (!canDragView.value || !isDragging.value) return
  const dx = event.clientX - dragStart.value.x
  const dy = event.clientY - dragStart.value.y
  offset.value = {
    x: initialOffset.value.x + dx,
    y: initialOffset.value.y + dy,
  }
}

const onWheel = (event: WheelEvent) => {
  event.preventDefault()
  const factor = Math.exp(-event.deltaY * 0.0015)
  applyScale(scale.value * factor)
}

const distanceBetweenTouches = (touches: TouchList) => {
  const [a, b] = [touches.item(0), touches.item(1)]
  if (!a || !b) return 0
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

const onTouchStart = (event: TouchEvent) => {
  if (!canDragView.value) return

  if (event.touches.length === 2) {
    pinchState.active = true
    pinchState.startDistance = distanceBetweenTouches(event.touches)
    pinchState.startScale = scale.value
    return
  }

  const touch = event.touches[0]
  if (!touch) return
  isDragging.value = true
  dragStart.value = { x: touch.clientX, y: touch.clientY }
  initialOffset.value = { ...offset.value }
}

const onTouchMove = (event: TouchEvent) => {
  if (pinchState.active && event.touches.length === 2) {
    event.preventDefault()
    const currentDistance = distanceBetweenTouches(event.touches)
    if (currentDistance === 0) return
    const factor = currentDistance / pinchState.startDistance
    applyScale(pinchState.startScale * factor)
    return
  }

  if (!canDragView.value || !isDragging.value) return
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
  pinchState.active = false
}

const transformValue = computed(
  () => `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value})`,
)

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
    <SkyrimLevelGauge />
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_rgba(14,165,233,0.05)_0,_rgba(0,0,0,0)_70%)]"
    />

    <div
      class="relative h-full cursor-grab active:cursor-grabbing"
      @mousedown.prevent="onMouseDown"
      @mousemove="onMouseMove"
      @wheel.prevent="onWheel"
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
    >
      <div
        class="h-full w-full transition-transform duration-75 sky-inner"
        :style="{ transform: transformValue }"
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
</style>
