<template>
  <div class="density-graph-container" ref="containerRef">
    <svg
      class="density-graph-svg"
      :viewBox="`0 0 ${containerWidth} ${containerHeight}`"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @click="handleClick"
    >
      <defs>
        <!-- メインの線グラデーション（縦方向：下部がシアン・中部が黄色・上部ピークが赤） -->
        <linearGradient id="densityLineGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#1feaea" />
          <stop offset="40%" stop-color="#ffd200" />
          <stop offset="100%" stop-color="#f72047" />
        </linearGradient>

        <!-- 塗りつぶしグラデーション（縦方向：上部ほど色が濃くなる） -->
        <linearGradient id="densityFillGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#1feaea" stop-opacity="0.04" />
          <stop offset="40%" stop-color="#ffd200" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#f72047" stop-opacity="0.48" />
        </linearGradient>

        <!-- 音札用グラデーション -->
        <linearGradient id="otofudaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffa726" />
          <stop offset="100%" stop-color="#ef6c00" />
        </linearGradient>
      </defs>

      <!-- グリッド背景・基準線 -->
      <g class="graph-grid">
        <!-- 背景の薄いグリッドライン -->
        <line
          v-for="gridY in gridLines"
          :key="gridY.y"
          :x1="plotX"
          :y1="gridY.y"
          :x2="plotX + plotWidth"
          :y2="gridY.y"
          stroke="rgba(0, 0, 0, 0.06)"
          stroke-width="1"
          stroke-dasharray="3,3"
        />

        <!-- ベースライン（ノーツ数0の線） -->
        <line
          :x1="plotX"
          :y1="plotY + plotHeight"
          :x2="plotX + plotWidth"
          :y2="plotY + plotHeight"
          stroke="rgba(0, 0, 0, 0.16)"
          stroke-width="1.2"
        />

        <!-- ピーク基準線（最大密度） -->
        <g v-if="peakValue > 0">
          <line
            :x1="plotX"
            :y1="plotY"
            :x2="plotX + plotWidth"
            :y2="plotY"
            stroke="rgba(247, 32, 71, 0.45)"
            stroke-width="1.2"
            stroke-dasharray="4,3"
          />
          <text
            :x="plotX + plotWidth - 6"
            :y="plotY - 6"
            class="peak-text"
            text-anchor="end"
          >
            Peak: {{ peakValue }} Notes/小節
          </text>
        </g>
      </g>

      <!-- ノーツ密度エリア（塗りつぶし） -->
      <path
        v-if="areaPath"
        :d="areaPath"
        fill="url(#densityFillGrad)"
        class="density-area"
      />

      <!-- ノーツ密度曲線（折れ線） -->
      <path
        v-if="linePath"
        :d="linePath"
        fill="none"
        stroke="url(#densityLineGrad)"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="density-line"
      />

      <!-- 音札ノーツ発生位置バー -->
      <g class="otofuda-track">
        <!-- トラック背景 -->
        <rect
          :x="plotX"
          :y="otofudaY"
          :width="plotWidth"
          :height="otofudaHeight"
          rx="4"
          fill="rgba(0, 0, 0, 0.05)"
        />
        <!-- 音札ラベル -->
        <text
          :x="plotX - 8"
          :y="otofudaY + otofudaHeight - 3"
          class="otofuda-label"
          text-anchor="end"
        >
          音札
        </text>
        <!-- 各小節の音札ノーツバー -->
        <rect
          v-for="bar in otofudaBars"
          :key="bar.measure"
          :x="bar.x"
          :y="otofudaY"
          :width="bar.width"
          :height="otofudaHeight"
          rx="2"
          fill="url(#otofudaGrad)"
          class="otofuda-bar"
        />
      </g>

      <!-- X軸目盛りラベル -->
      <g class="x-axis-labels">
        <g v-for="tick in xTicks" :key="tick.measure">
          <line
            :x1="tick.x"
            :y1="plotY + plotHeight"
            :x2="tick.x"
            :y2="plotY + plotHeight + 5"
            stroke="rgba(0, 0, 0, 0.22)"
            stroke-width="1"
          />
          <text
            :x="tick.x"
            :y="containerHeight - 8"
            class="axis-tick-text"
            text-anchor="middle"
          >
            {{ tick.measure }}
          </text>
        </g>
      </g>

      <!-- ホバーインジケーター（カーソル縦線＆ポイント） -->
      <g v-if="hoverIndex !== null && hoverPoint" class="hover-indicator">
        <!-- 縦のガイドライン -->
        <line
          :x1="hoverPoint.x"
          :y1="plotY - 10"
          :x2="hoverPoint.x"
          :y2="otofudaY + otofudaHeight + 4"
          stroke="rgba(33, 150, 243, 0.75)"
          stroke-width="1.5"
          stroke-dasharray="3,2"
        />
        <!-- 曲線上ポイント -->
        <circle
          :cx="hoverPoint.x"
          :cy="hoverPoint.y"
          r="5.5"
          fill="#2196f3"
          stroke="#ffffff"
          stroke-width="2.5"
        />
      </g>
    </svg>

    <!-- ホバーツールチップ -->
    <div
      v-if="hoverIndex !== null && hoverPoint"
      class="graph-tooltip"
      :style="tooltipStyle"
    >
      <div class="tooltip-header">
        <span class="tooltip-measure">小節 {{ hoverIndex }}</span>
        <span v-if="currentOtofudaCount > 0" class="tooltip-otofuda-badge">
          音札
        </span>
      </div>
      <div class="tooltip-density">
        ノーツ数: <strong>{{ currentTrendValue }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    trendValues?: number[]
    otofudaNotes?: number[]
  }>(),
  {
    trendValues: () => [],
    otofudaNotes: () => [],
  }
)

const emit = defineEmits<{
  (e: 'jump', measure: number): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const hoverIndex = ref<number | null>(null)

// 1:1 実ピクセル座標系（アスペクト比の歪みを防止）
const containerWidth = ref(740)
const containerHeight = ref(280)

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    if (rect.width > 0) {
      containerWidth.value = Math.round(rect.width)
    }
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            containerWidth.value = Math.round(entry.contentRect.width)
          }
        }
      })
      resizeObserver.observe(containerRef.value)
    }
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

const padding = {
  top: 32,
  right: 32,
  bottom: 28,
  left: 44,
}

const plotX = computed(() => padding.left)
const plotY = computed(() => padding.top)
const plotWidth = computed(() => Math.max(containerWidth.value - padding.left - padding.right, 100))

// 音札トラックの高さ・位置
const otofudaHeight = 15
const otofudaY = computed(() => containerHeight.value - padding.bottom - otofudaHeight - 16)

// メイングラフの高さ（280px中 約160pxを確保して縦の潰れを完全解消）
const plotHeight = computed(() => Math.max(otofudaY.value - plotY.value - 18, 80))

// 小節総数
const measureCount = computed(() => Math.max(props.trendValues.length, 1))

// ピーク値（最大ノーツ数/小節）
const peakValue = computed(() => {
  if (props.trendValues.length === 0) return 0
  return Math.max(...props.trendValues, 0)
})

// グリッド補助線（4分割）
const gridLines = computed(() => {
  const lines: { y: number }[] = []
  const divisions = 4
  for (let i = 1; i < divisions; i++) {
    lines.push({ y: plotY.value + (plotHeight.value / divisions) * i })
  }
  return lines
})

// 各小節の座標ポイント
const points = computed(() => {
  const count = measureCount.value
  const peak = Math.max(peakValue.value, 1)
  const pX = plotX.value
  const pY = plotY.value
  const pW = plotWidth.value
  const pH = plotHeight.value

  return props.trendValues.map((val, idx) => {
    const x = count === 1 ? pX + pW / 2 : pX + (idx / (count - 1)) * pW
    const y = pY + pH - (val / peak) * pH
    return { x, y, value: val, measure: idx }
  })
})

// スムーズなベジェ曲線の SVG パス生成
const linePath = computed(() => {
  const pts = points.value
  if (pts.length === 0) return ''
  const pX = plotX.value
  const pW = plotWidth.value

  if (pts.length === 1) {
    return `M ${pX} ${pts[0].y} L ${pX + pW} ${pts[0].y}`
  }

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1]

    // Catmull-Rom スプラインから 3次ベジェ制御点を算出
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
})

// グラデーション塗りつぶし用エリアパス
const areaPath = computed(() => {
  const lPath = linePath.value
  if (!lPath || points.value.length === 0) return ''
  const pts = points.value
  const baseY = plotY.value + plotHeight.value
  const firstX = pts[0].x
  const lastX = pts[pts.length - 1].x

  return `${lPath} L ${lastX.toFixed(1)} ${baseY.toFixed(1)} L ${firstX.toFixed(1)} ${baseY.toFixed(1)} Z`
})

// 音札ノーツバーの座標
const otofudaBars = computed(() => {
  const count = measureCount.value
  const pX = plotX.value
  const pW = plotWidth.value
  const barWidth = Math.max(Math.min(pW / count - 1, 16), 4)

  return props.otofudaNotes
    .map((val, idx) => ({ val, idx }))
    .filter(({ val }) => val > 0)
    .map(({ idx }) => {
      const x = count === 1 ? pX : pX + (idx / Math.max(count - 1, 1)) * pW - barWidth / 2
      return {
        measure: idx,
        x: Math.max(pX, Math.min(pX + pW - barWidth, x)),
        width: barWidth,
      }
    })
})

// X軸の目盛り
const xTicks = computed(() => {
  const count = measureCount.value
  const pX = plotX.value
  const pW = plotWidth.value
  const ticks: { measure: number; x: number }[] = []
  if (count <= 1) {
    ticks.push({ measure: 0, x: pX })
    return ticks
  }

  const step = count > 100 ? 20 : count > 40 ? 10 : count > 15 ? 5 : 2
  for (let m = 0; m < count; m += step) {
    const x = pX + (m / (count - 1)) * pW
    ticks.push({ measure: m, x })
  }

  // 終端小節（重複しない場合に追加）
  const lastMeasure = count - 1
  if (ticks.length > 0 && ticks[ticks.length - 1].measure !== lastMeasure) {
    ticks.push({
      measure: lastMeasure,
      x: pX + pW,
    })
  }

  return ticks
})

// ホバー位置のポイント
const hoverPoint = computed(() => {
  if (hoverIndex.value === null) return null
  return points.value[hoverIndex.value] || null
})

const currentTrendValue = computed(() => {
  if (hoverIndex.value === null) return 0
  return props.trendValues[hoverIndex.value] ?? 0
})

const currentOtofudaCount = computed(() => {
  if (hoverIndex.value === null) return 0
  return props.otofudaNotes[hoverIndex.value] ?? 0
})

// ツールチップのCSS位置
const tooltipStyle = computed(() => {
  if (hoverIndex.value === null || !hoverPoint.value) return { display: 'none' }
  const percentX = (hoverPoint.value.x / containerWidth.value) * 100
  const isRightSide = percentX > 60

  return {
    left: `${percentX}%`,
    top: '10px',
    transform: isRightSide ? 'translateX(-105%)' : 'translateX(8%)',
  }
})

// マウスイベント処理
function getMeasureFromMouseEvent(e: MouseEvent): number | null {
  if (!containerRef.value) return null
  const rect = containerRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const pX = plotX.value
  const pW = plotWidth.value

  if (mouseX < pX || mouseX > pX + pW) return null
  const ratio = (mouseX - pX) / pW
  const count = measureCount.value
  const measure = Math.round(ratio * (count - 1))
  return Math.max(0, Math.min(count - 1, measure))
}

function handleMouseMove(e: MouseEvent) {
  const m = getMeasureFromMouseEvent(e)
  hoverIndex.value = m
}

function handleMouseLeave() {
  hoverIndex.value = null
}

function handleClick(e: MouseEvent) {
  const m = hoverIndex.value !== null ? hoverIndex.value : getMeasureFromMouseEvent(e)
  if (m !== null) {
    emit('jump', m)
  }
}
</script>

<style scoped lang="scss">
.density-graph-container {
  position: relative;
  width: 100%;
  padding: 8px 0;
  user-select: none;
}

.density-graph-svg {
  width: 100%;
  height: 280px;
  display: block;
  cursor: pointer;
}

.peak-text {
  font-size: 10.5px;
  font-weight: bold;
  fill: #f72047;
}

.otofuda-label {
  font-size: 9.5px;
  font-weight: bold;
  fill: #e65100;
}

.axis-tick-text {
  font-size: 11px;
  fill: rgba(0, 0, 0, 0.65);
  font-family: monospace;
}

.density-area {
  transition: opacity 0.2s ease;
}

.density-line {
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.15));
}

.otofuda-bar {
  transition: transform 0.15s ease;
}

.graph-tooltip {
  position: absolute;
  pointer-events: none;
  background: rgba(33, 33, 33, 0.92);
  color: #fff;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 11.5px;
  line-height: 1.4;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  z-index: 10;
  white-space: nowrap;

  .tooltip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 3px;
  }

  .tooltip-measure {
    font-weight: bold;
    color: #90caf9;
  }

  .tooltip-otofuda-badge {
    background: #ff9800;
    color: #fff;
    font-size: 9.5px;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: bold;
  }

  .tooltip-density {
    color: #e0e0e0;
  }
}
</style>
