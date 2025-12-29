<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useSkillStore } from '../stores/skillStore'
import SkillConstellation from './SkillConstellation.vue'
import SkyrimLevelGauge from './SkyrimLevelGauge.vue'

const skillStore = useSkillStore()
const nodes = computed(() => skillStore.skillTreeData.nodes)

const containerRef = ref<HTMLDivElement | null>(null)
const offset = ref({ x: 0, y: 0 })
const scale = ref(window.matchMedia('(max-width: 768px)').matches ? 0.92 : 1)
const MIN_SCALE_FLOOR = 0.25
const minScale = ref(MIN_SCALE_FLOOR)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const initialOffset = ref({ x: 0, y: 0 })
const pinchState = reactive({ active: false, startDistance: 0, startScale: 1 })

const MAX_SCALE = 2.5
const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(minScale.value, value))
const zoomAt = (pivot: { x: number; y: number }, nextScale: number) => {
  updateViewportMetrics({ recenter: false })
  const previousScale = scale.value
  const clamped = clampScale(nextScale)
  if (clamped === previousScale) return
  const worldX = (pivot.x - offset.value.x) / previousScale
  const worldY = (pivot.y - offset.value.y) / previousScale
  offset.value = {
    x: pivot.x - worldX * clamped,
    y: pivot.y - worldY * clamped,
  }
  scale.value = clamped
}

const hasUserMoved = ref(false)
const markUserMoved = () => {
  hasUserMoved.value = true
}

const canDragView = computed(() => true)

const onMouseDown = (event: MouseEvent) => {
  if (!canDragView.value) return
  markUserMoved()
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
  markUserMoved()
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return
  const pivot = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  const factor = Math.exp(-event.deltaY * 0.0015)
  zoomAt(pivot, scale.value * factor)
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
    markUserMoved()
    pinchState.active = true
    pinchState.startDistance = distanceBetweenTouches(event.touches)
    pinchState.startScale = scale.value
    return
  }

  const touch = event.touches[0]
  if (!touch) return
  markUserMoved()
  isDragging.value = true
  dragStart.value = { x: touch.clientX, y: touch.clientY }
  initialOffset.value = { ...offset.value }
}

const onTouchMove = (event: TouchEvent) => {
  if (pinchState.active && event.touches.length === 2) {
    event.preventDefault()
    const currentDistance = distanceBetweenTouches(event.touches)
    if (currentDistance === 0) return
    markUserMoved()
    const rect = containerRef.value?.getBoundingClientRect()
    if (!rect) return
    const [first, second] = [event.touches.item(0), event.touches.item(1)]
    if (!first || !second) return
    const center = {
      x: (first.clientX + second.clientX) / 2 - rect.left,
      y: (first.clientY + second.clientY) / 2 - rect.top,
    }
    const factor = currentDistance / pinchState.startDistance
    zoomAt(center, pinchState.startScale * factor)
    return
  }

  if (!canDragView.value || !isDragging.value) return
  const touch = event.touches[0]
  if (!touch) return
  event.preventDefault()
  markUserMoved()
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

const computeNodesBounds = () => {
  if (!nodes.value.length) {
    return {
      minX: 0,
      maxX: 1000,
      minY: 0,
      maxY: 800,
      width: 1000,
      height: 800,
      center: { x: 500, y: 400 },
    }
  }
  const xs = nodes.value.map((n) => n.x)
  const ys = nodes.value.map((n) => n.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = Math.max(maxX - minX, 1)
  const height = Math.max(maxY - minY, 1)
  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    },
  }
}

const updateViewportMetrics = (options: { recenter?: boolean } = {}) => {
  const el = containerRef.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()
  const bounds = computeNodesBounds()
  // フルズームアウト時にスキル群の左右端が画面中央1/3ラインに収まるようスケール下限を計算
  const horizontalScale = width / (bounds.width * 3)
  const verticalScale = height / (bounds.height * 3)
  const candidateMinScale = Math.min(horizontalScale, verticalScale)
  minScale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE_FLOOR, candidateMinScale))
  scale.value = clampScale(scale.value)
  if (options.recenter === false) return
  offset.value = {
    x: width / (2 * scale.value) - bounds.center.x,
    y: height / (2 * scale.value) - bounds.center.y,
  }
}

const handleResize = () => {
  updateViewportMetrics()
}

onMounted(() => {
  void nextTick(updateViewportMetrics)
  window.addEventListener('resize', handleResize)
})

onMounted(() => {
  window.addEventListener('mouseup', stopDragging)
  window.addEventListener('touchend', stopDragging)
  window.addEventListener('touchcancel', stopDragging)
})

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', stopDragging)
  window.removeEventListener('touchend', stopDragging)
  window.removeEventListener('touchcancel', stopDragging)
  window.removeEventListener('resize', handleResize)
})

watch(
  () => skillStore.currentTreeId,
  () => {
    hasUserMoved.value = false
    void nextTick(updateViewportMetrics)
  },
)

watch(
  () => skillStore.skillTreeData.nodes.length,
  () => {
    if (hasUserMoved.value) {
      void nextTick(() => updateViewportMetrics({ recenter: false }))
      return
    }
    void nextTick(updateViewportMetrics)
  },
)
</script>

<template>
  <div
    class="relative h-[calc(100vh-96px)] overflow-hidden bg-[#050505]"
    ref="containerRef"
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
  transform-origin: top left;
}
</style>
