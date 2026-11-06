import type { NoteData } from 'chart-types'

/** ノートタイプの選択肢エントリ */
export type NoteTypeEntry = { title: string; value: number }

/** ノートオプションの定義 */
export type NoteTypesOption = {
  label: string
  type: string
  desc: string
}

/**
 * 利用可能なノートタイプ一覧
 */
export const noteTypes: NoteTypeEntry[] = [
  { title: '通常', value: 1 },
  { title: 'ロング', value: 2 },
  { title: '左フリック', value: 3 },
  { title: '右フリック', value: 4 },
  { title: '音札', value: 5 },
  { title: '上フリック', value: 6 },
  { title: '下フリック', value: 7 },
  { title: '中点 / 終端なし', value: 89 },
  { title: 'ダミー', value: 90 },
  { title: '特殊オブジェクト', value: 91 },
  { title: '譜面停止', value: 92 },
  { title: '瞬間移動', value: 93 },
  { title: 'テクスチャ', value: 94 },
  { title: '区切り線', value: 95 },
  { title: 'LED制御', value: 96 },
  { title: '拍子変化', value: 97 },
  { title: 'BPM変化', value: 98 },
  { title: 'EOF', value: 99 },
  { title: 'コメント', value: 100 },
]

/**
 * ノートタイプに対応するオプション定義を返す
 * @param note - オプション定義を取得するノート
 */
export function noteOptions(note: NoteData): NoteTypesOption[] {
  if (note.type === 2)
    return [
      { label: 'speed', type: 'number', desc: 'Float型｜スピード(倍率)' },
      { label: 'orbit', type: 'number', desc: 'Float型｜軌道(レーン幅/秒)' },
    ]
  else if ([1, 89].includes(note.type))
    return [
      { label: 'speed', type: 'number', desc: 'Float型｜スピード(倍率)' },
      { label: 'orbit', type: 'number', desc: 'Float型｜軌道(レーン幅/秒)' },
      { label: 'curve', type: 'text', desc: 'String型｜親からの曲線補間 (linear, ease, easeIn, easeOut)' },
      { label: 'width', type: 'number', desc: 'Float型｜中心を基点とした横幅(単位：1レーンの幅)' },
    ]
  else if ([3, 4, 6, 7].includes(note.type))
    return [
      { label: 'width', type: 'number', desc: 'String型｜中心を基点とした横幅(単位：1レーンの幅)' },
      { label: 'offsetNumer', type: 'number', desc: 'String型｜右側へのオフセット分数の分子' },
      { label: 'offsetDenom', type: 'number', desc: 'String型｜右側へのオフセット分数の分母' },
      { label: 'speed', type: 'number', desc: 'Float型｜スピード(倍率)' },
      { label: 'orbit', type: 'number', desc: 'Float型｜軌道(レーン幅/秒)' },
    ]
  else if (note.type === 5)
    return [
      { label: 'speed', type: 'number', desc: 'Float型｜スピード(倍率)' },
    ]
  else if (note.type === 90) {
    // 擬態するtypeによって出し分け
    const additionalOptions = noteOptions({ ...note, type: Number(note.option[0]) })
    return [
      { label: 'type', type: 'number', desc: 'Integer型｜擬態するノート種別(対応type: 1, 2, 3, 4, 5)' },
      ...additionalOptions,
    ]
  }
  else if (note.type === 91)
    return [
      { label: 'objectType', type: 'string', desc: 'String型｜表示するオブジェクトの種類' },
      { label: 'objectName', type: 'string', desc: 'String型｜表示するオブジェクト名' },
      { label: 'option', type: 'string', desc: 'String型｜その他のフラグ' },
    ]
  else if (note.type === 93)
    return [
      { label: 'beat', type: 'number', desc: 'Float型｜瞬間移動する小節の高さの拍子数' },
    ]
  else if (note.type === 94)
    return [
      { label: 'source', type: 'text', desc: 'String型｜画像のソース(httpまたはhttpsプロトコル)' },
      { label: 'width', type: 'number', desc: 'String型｜中心を基点とした横幅(単位：1レーンの幅)' },
      { label: 'height', type: 'number', desc: 'String型｜下面を基点とした高さ(単位：1小節の高さ)' },
      { label: 'offsetNumer', type: 'number', desc: 'String型｜右側へのオフセット分数の分子' },
      { label: 'offsetDenom', type: 'number', desc: 'String型｜右側へのオフセット分数の分母' },
      { label: 'speed', type: 'number', desc: 'Float型｜スピード(倍率)' },
      { label: 'orbit', type: 'number', desc: 'Float型｜軌道(レーン幅/秒)' },
    ]
  else if (note.type === 95)
    return [
      { label: 'length', type: 'number', desc: 'String型｜左面を基点とした横幅(単位：1レーンの幅)' },
      { label: 'speed', type: 'number', desc: 'Float型｜スピード(倍率)' },
      { label: 'orbit', type: 'number', desc: 'Float型｜軌道(レーン幅/秒)' },
    ]
  else if (note.type === 96)
    return [
      { label: 'red', type: 'number', desc: 'String型｜0-255の整数' },
      { label: 'green', type: 'number', desc: 'String型｜0-255の整数' },
      { label: 'blue', type: 'number', desc: 'String型｜0-255の整数' },
    ]
  else if (note.type === 97)
    return [
      { label: 'beat', type: 'number', desc: 'String型｜変化後の[n/4拍子]の分子の値' },
    ]
  else if (note.type === 98)
    return [
      { label: 'bpm', type: 'number', desc: 'String型｜変化後のBPMの値' },
    ]
  else if (note.type === 100)
    return [
      { label: 'comment', type: 'text', desc: 'String型｜コメント' },
    ]
  else return []
}

/** 曲線タイプの定義 */
export type CurveType = 'linear' | 'ease' | 'easeIn' | 'easeOut'

/** 曲線タイプの選択肢一覧 */
export const curveTypeOptions: { title: string; value: CurveType }[] = [
  { title: '直線', value: 'linear' },
  { title: 'S字 (Ease)', value: 'ease' },
  { title: 'Ease In', value: 'easeIn' },
  { title: 'Ease Out', value: 'easeOut' },
]

/**
 * ノートから曲線補間タイプを取得する（option[2]、デフォルト 'linear'）
 * @param note - 対象ノート
 */
export function getCurveType(note: NoteData): CurveType {
  return (note.option?.[2] as CurveType) || 'linear'
}

/**
 * ロングノーツの帯のSVGパス（fill用クローズドパス、left境界線パス、right境界線パス）を計算する
 * @param x1 - 始点中心X
 * @param y1 - 始点中心Y (SVG座標系)
 * @param x2 - 終点中心X
 * @param y2 - 終点中心Y (SVG座標系)
 * @param curveType - 曲線タイプ ('linear' | 'ease' | 'easeIn' | 'easeOut')
 * @param startWidth - 始点の帯の幅 (デフォルト 38px)
 * @param endWidth - 終点の帯の幅 (デフォルト 38px)
 */
export function generateHoldSvgPaths(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curveType: CurveType = 'linear',
  startWidth = 38,
  endWidth = 38
): { fillPath: string; leftBorderPath: string; rightBorderPath: string } {
  const hw1 = startWidth / 2
  const hw2 = endWidth / 2
  const x1_l = x1 - hw1, x1_r = x1 + hw1
  const x2_l = x2 - hw2, x2_r = x2 + hw2
  const dy = y2 - y1

  if (curveType === 'ease') {
    // S字カーブ (Ease In-Out): 始点・終点は垂直に保ち、中間(35%/65%)を自然な傾斜でなめらかに繋ぐ
    const cp1_y = y1 + dy * 0.35
    const cp2_y = y1 + dy * 0.65
    const leftBorderPath = `M ${x1_l} ${y1} C ${x1_l} ${cp1_y}, ${x2_l} ${cp2_y}, ${x2_l} ${y2}`
    const rightBorderPath = `M ${x1_r} ${y1} C ${x1_r} ${cp1_y}, ${x2_r} ${cp2_y}, ${x2_r} ${y2}`
    const fillPath = `M ${x1_l} ${y1} L ${x1_r} ${y1} C ${x1_r} ${cp1_y}, ${x2_r} ${cp2_y}, ${x2_r} ${y2} L ${x2_l} ${y2} C ${x2_l} ${cp2_y}, ${x1_l} ${cp1_y}, ${x1_l} ${y1} Z`
    return { fillPath, leftBorderPath, rightBorderPath }
  } else if (curveType === 'easeIn') {
    // Ease In: 始点は垂直にゆっくり出発し、終点に向かってなめらかに曲がる
    const cp1_y = y1 + dy * 0.5
    const cp2_x_l = x1_l + (x2_l - x1_l) * 0.5
    const cp2_x_r = x1_r + (x2_r - x1_r) * 0.5
    const cp2_y = y1 + dy * 0.85
    const leftBorderPath = `M ${x1_l} ${y1} C ${x1_l} ${cp1_y}, ${cp2_x_l} ${cp2_y}, ${x2_l} ${y2}`
    const rightBorderPath = `M ${x1_r} ${y1} C ${x1_r} ${cp1_y}, ${cp2_x_r} ${cp2_y}, ${x2_r} ${y2}`
    const fillPath = `M ${x1_l} ${y1} L ${x1_r} ${y1} C ${x1_r} ${cp1_y}, ${cp2_x_r} ${cp2_y}, ${x2_r} ${y2} L ${x2_l} ${y2} C ${cp2_x_l} ${cp2_y}, ${x1_l} ${cp1_y}, ${x1_l} ${y1} Z`
    return { fillPath, leftBorderPath, rightBorderPath }
  } else if (curveType === 'easeOut') {
    // Ease Out: 始点からなめらかに曲がり始め、終点では垂直に着地する
    const cp1_x_l = x2_l - (x2_l - x1_l) * 0.5
    const cp1_x_r = x2_r - (x2_r - x1_r) * 0.5
    const cp1_y = y1 + dy * 0.15
    const cp2_y = y1 + dy * 0.5
    const leftBorderPath = `M ${x1_l} ${y1} C ${cp1_x_l} ${cp1_y}, ${x2_l} ${cp2_y}, ${x2_l} ${y2}`
    const rightBorderPath = `M ${x1_r} ${y1} C ${cp1_x_r} ${cp1_y}, ${x2_r} ${cp2_y}, ${x2_r} ${y2}`
    const fillPath = `M ${x1_l} ${y1} L ${x1_r} ${y1} C ${cp1_x_r} ${cp1_y}, ${x2_r} ${cp2_y}, ${x2_r} ${y2} L ${x2_l} ${y2} C ${x2_l} ${cp2_y}, ${cp1_x_l} ${cp1_y}, ${x1_l} ${y1} Z`
    return { fillPath, leftBorderPath, rightBorderPath }
  } else {
    // 直線 (Linear): 単純な台形ポリゴン
    const leftBorderPath = `M ${x1_l} ${y1} L ${x2_l} ${y2}`
    const rightBorderPath = `M ${x1_r} ${y1} L ${x2_r} ${y2}`
    const fillPath = `M ${x1_l} ${y1} L ${x1_r} ${y1} L ${x2_r} ${y2} L ${x2_l} ${y2} Z`
    return { fillPath, leftBorderPath, rightBorderPath }
  }
}
