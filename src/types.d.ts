export type DifficultyString = "raku" | "easy" | "normal" | "hard" | "extra";

export interface Measure {
  measure: number;
  measureBeat: number;
  measureBpm: number;
  measureHeight: number;
  measureLength: number;
  measurePositionBottom: number;
  measureReachTime: number;
}

export interface ColorObject {
  r: string;
  g: string;
  b: string;
  a: number;
}

export interface TextureObject {
  id: string;
  name: string;
  tab: string[];
  url: string;
  width: number;
}
