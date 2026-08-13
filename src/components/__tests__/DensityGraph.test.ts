import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DensityGraph from '../DensityGraph.vue'

describe('DensityGraph.vue', () => {
  it('renders gracefully with empty data', () => {
    const wrapper = mount(DensityGraph, {
      props: {
        trendValues: [],
        otofudaNotes: [],
      },
    })

    expect(wrapper.find('svg.density-graph-svg').exists()).toBe(true)
    // When empty, peak is 0, no peak line shown
    expect(wrapper.find('.peak-text').exists()).toBe(false)
  })

  it('renders curve, area, otofuda bars, and peak guideline with valid data', () => {
    const trendValues = [0, 2, 8, 4, 12, 6, 0, 3, 5, 0]
    const otofudaNotes = [0, 0, 1, 0, 2, 0, 0, 0, 0, 0]

    const wrapper = mount(DensityGraph, {
      props: {
        trendValues,
        otofudaNotes,
      },
    })

    // Curve and Area paths should exist
    expect(wrapper.find('path.density-line').exists()).toBe(true)
    expect(wrapper.find('path.density-area').exists()).toBe(true)

    // Peak text should reflect max value (12)
    const peakText = wrapper.find('.peak-text')
    expect(peakText.exists()).toBe(true)
    expect(peakText.text()).toContain('Peak: 12 Notes/小節')

    // Otofuda bars: measures 2 and 4 have otofuda notes
    const otofudaBars = wrapper.findAll('.otofuda-bar')
    expect(otofudaBars.length).toBe(2)

    // X-axis labels should exist
    const tickTexts = wrapper.findAll('.axis-tick-text')
    expect(tickTexts.length).toBeGreaterThan(0)
    expect(tickTexts[0].text()).toBe('0')
    expect(tickTexts[tickTexts.length - 1].text()).toBe('9')
  })

  it('emits jump event when clicked on a measure', async () => {
    const trendValues = [1, 2, 3, 4, 5]
    const wrapper = mount(DensityGraph, {
      props: {
        trendValues,
        otofudaNotes: [0, 0, 0, 0, 0],
      },
    })

    const container = wrapper.find('.density-graph-container')
    // Mock getBoundingClientRect
    container.element.getBoundingClientRect = () => ({
      width: 600,
      height: 150,
      top: 0,
      left: 0,
      bottom: 150,
      right: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    const svg = wrapper.find('svg')
    // Click near middle (plot area: left 36, width 540; middle ~ 306px)
    await svg.trigger('click', { clientX: 306, clientY: 50 })

    expect(wrapper.emitted('jump')).toBeTruthy()
    expect(wrapper.emitted('jump')![0]).toEqual([2])
  })

  it('shows tooltip on mousemove and hides on mouseleave', async () => {
    const trendValues = [1, 5, 3]
    const otofudaNotes = [0, 2, 0]
    const wrapper = mount(DensityGraph, {
      props: {
        trendValues,
        otofudaNotes,
      },
    })

    const container = wrapper.find('.density-graph-container')
    container.element.getBoundingClientRect = () => ({
      width: 600,
      height: 150,
      top: 0,
      left: 0,
      bottom: 150,
      right: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    const svg = wrapper.find('svg')
    // Move to measure 1 (middle)
    await svg.trigger('mousemove', { clientX: 306, clientY: 50 })

    const tooltip = wrapper.find('.graph-tooltip')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toContain('小節 1')
    expect(tooltip.text()).toContain('ノーツ数: 5')
    expect(tooltip.text()).toContain('音札 × 2')

    // Mouse leave
    await svg.trigger('mouseleave')
    expect(wrapper.find('.graph-tooltip').exists()).toBe(false)
  })
})
