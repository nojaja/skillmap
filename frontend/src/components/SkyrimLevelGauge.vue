<script setup lang="ts">
import { computed } from 'vue'
import { useSkillStore } from '../stores/skillStore'

const skillStore = useSkillStore()

// アクティブスキル数（レベル）
const currentLevel = computed(() => skillStore.unlockedSkillIds.length)

// 全スキル数（最大レベル）
const maxLevel = computed(() => skillStore.skillTreeData.nodes.length)

// 進捗率
const percentage = computed(() => {
  if (maxLevel.value === 0) return 0
  return Math.min(100, Math.max(0, (currentLevel.value / maxLevel.value) * 100))
})

// スキルツリー名
const skillTreeName = computed(() => skillStore.skillTreeData.name || 'Skill Constellation')
</script>

<template>
  <div class="skyrim-level-bar-container absolute left-8 top-6 z-50 pointer-events-none select-none">
    <span class="skill-name">{{ skillTreeName }}</span>

    <div class="bar-stack">
      <div class="bar-assembly">
        <!-- 左装飾 -->
        <svg class="decoration" width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 2 L2 12 L12 22 L22 12 Z" fill="#1a1a1a" stroke="#9ca3af" stroke-width="1.5"/>
          <path d="M12 7 L7 12 L12 17 L17 12 Z" fill="#9ca3af"/>
        </svg>

        <!-- バー本体 -->
        <div class="bar-track">
          <div class="bar-fill-container" :style="{ width: `${percentage}%` }">
            <div class="bar-fill"></div>
            <div class="bar-spark"></div>
          </div>
        </div>

        <!-- 右装飾 -->
        <svg class="decoration" width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 2 L2 12 L12 22 L22 12 Z" fill="#1a1a1a" stroke="#9ca3af" stroke-width="1.5"/>
          <path d="M12 7 L7 12 L12 17 L17 12 Z" fill="#9ca3af"/>
        </svg>
      </div>

      <span class="level-text">レベル: {{ currentLevel }}/{{ maxLevel }}</span>
    </div>
  </div>
</template>

<style scoped>
.skyrim-level-bar-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  color: #ffffff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9);
}

.skill-name {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #f3f4f6;
}

.level-text {
  font-size: 1.25rem;
  font-weight: 600;
  color: #f3f4f6;
  letter-spacing: 0.05em;
  width: 100%;
  text-align: center;
  margin-top: 6px;
}

.bar-stack {
  width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bar-assembly {
  display: flex;
  align-items: center;
  position: relative;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
}

.decoration {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  z-index: 2;
}

.bar-track {
  width: 320px;
  height: 12px;
  background-color: rgba(10, 10, 10, 0.7);
  border-top: 1px solid #9ca3af;
  border-bottom: 1px solid #9ca3af;
  margin: 0 -2px; /* 装飾と重ねる */
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.bar-fill-container {
  height: 100%;
  position: relative;
  transition: width 0.5s ease-out;
}

.bar-fill {
  width: 100%;
  height: 100%;
  /* 画像のような青〜紫〜白の神秘的なグラデーション */
  background: linear-gradient(
    90deg, 
    rgba(20, 10, 60, 0.8) 0%, 
    rgba(60, 30, 180, 0.9) 50%, 
    rgba(120, 120, 255, 1) 90%,
    rgba(200, 230, 255, 1) 100%
  );
  box-shadow: 0 0 8px rgba(100, 100, 255, 0.6);
}

/* 内部の光の筋 */
.bar-fill::after {
  content: '';
  position: absolute;
  top: 40%;
  left: 0;
  right: 0;
  height: 20%;
  background: rgba(255, 255, 255, 0.6);
  filter: blur(2px);
  mix-blend-mode: overlay;
}

/* 先端のスパーク */
.bar-spark {
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 28px;
  background: radial-gradient(ellipse at center, #ffffff 20%, rgba(150, 200, 255, 0.8) 40%, rgba(100, 150, 255, 0) 70%);
  filter: blur(1px);
  z-index: 10;
  mix-blend-mode: screen;
}
</style>
