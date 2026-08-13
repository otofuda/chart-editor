import { describe, it, expect } from 'vitest'
import { noteTypes, noteOptions, curveTypeOptions, generateHoldSvgPaths, getCurveType } from '../useNoteTypes'
import type { NoteData } from 'chart-types'

const baseNote: NoteData = { type: 1, lane: 1, measure: 0, position: 0, split: 8, option: [], end: [] }

describe('noteTypes', () => {
  it('ノートタイプの配列が存在する', () => {
    expect(noteTypes).toBeDefined()
    expect(noteTypes.length).toBeGreaterThan(0)
  })

  it('各ノートタイプに title と value が含まれる', () => {
    for (const t of noteTypes) {
      expect(typeof t.title).toBe('string')
      expect(typeof t.value).toBe('number')
    }
  })

  it('通常ノート(type:1)が含まれる', () => {
    const tap = noteTypes.find(t => t.value === 1)
    expect(tap).toBeDefined()
  })
})

describe('noteOptions', () => {
  it('type 1 / 89 は speed, orbit, curve の3つのオプションを返す', () => {
    const result1 = noteOptions({ ...baseNote, type: 1 })
    expect(result1.length).toBe(3)
    expect(result1.map(o => o.label)).toEqual(['speed', 'orbit', 'curve'])

    const result89 = noteOptions({ ...baseNote, type: 89 })
    expect(result89.length).toBe(3)
    expect(result89.map(o => o.label)).toEqual(['speed', 'orbit', 'curve'])
  })

  it('type 2 (ロング始点) は speed, orbit の2つのオプションを返す', () => {
    const result2 = noteOptions({ ...baseNote, type: 2 })
    expect(result2.length).toBe(2)
    expect(result2.map(o => o.label)).toEqual(['speed', 'orbit'])
  })

  it('テクスチャ(type:94)は複数のオプションを返す', () => {
    const result = noteOptions({ ...baseNote, type: 94 })
    expect(result.length).toBeGreaterThan(0)
  })

  it('BPM変化(type:98)はBPMオプションを返す', () => {
    const result = noteOptions({ ...baseNote, type: 98 })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].label).toBeDefined()
  })
})

describe('curveTypeOptions & generateHoldSvgPaths & getCurveType', () => {
  it('曲線オプションが定義されている', () => {
    expect(curveTypeOptions.length).toBe(4)
    expect(curveTypeOptions.map(c => c.value)).toEqual(['linear', 'ease', 'easeIn', 'easeOut'])
  })

  it('getCurveType は option[2] から曲線タイプを取得する', () => {
    expect(getCurveType({ ...baseNote, option: ['', '', 'ease'] })).toBe('ease')
    expect(getCurveType({ ...baseNote, option: ['1.5', 'spiral', 'easeIn'] })).toBe('easeIn')
    expect(getCurveType({ ...baseNote, option: [] })).toBe('linear')
  })

  it('直線(linear)のSVGパスを生成できる', () => {
    const paths = generateHoldSvgPaths(90, 100, 210, 0, 'linear', 38)
    expect(paths.fillPath).toContain('M')
    expect(paths.fillPath).toContain('Z')
    expect(paths.leftBorderPath).toContain('M')
    expect(paths.rightBorderPath).toContain('M')
  })

  it('S字カーブ(ease)のSVGパスをベジェ曲線(C)で生成できる', () => {
    const paths = generateHoldSvgPaths(90, 100, 210, 0, 'ease', 38)
    expect(paths.fillPath).toContain('C')
    expect(paths.leftBorderPath).toContain('C')
    expect(paths.rightBorderPath).toContain('C')
  })

  it('Ease In / Ease Out のSVGパスを生成できる', () => {
    const easeIn = generateHoldSvgPaths(90, 100, 210, 0, 'easeIn', 38)
    const easeOut = generateHoldSvgPaths(90, 100, 210, 0, 'easeOut', 38)
    expect(easeIn.fillPath).toContain('C')
    expect(easeOut.fillPath).toContain('C')
  })
})
