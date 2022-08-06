import { ChartData, LaneType, NoteData } from "chart-types";

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

export interface ExtendedNoteData extends NoteData {
  index?: number | null;
  isSelected?: boolean;
}

export interface ExtendedChartData extends ChartData {
  raku: ExtendedNoteData[];
  easy: ExtendedNoteData[];
  normal: ExtendedNoteData[];
  hard: ExtendedNoteData[];
  extra: ExtendedNoteData[];
}

export type PreviewEvents = Record<number, PreviewEvent>;

export type PreviewEvent = {
  timing: number;
  lane: (LaneType | 0)[];
  hold: [number, number][];
  holdEnd: LaneType[];
  color: string | null;
  count: number;
  sound: boolean;
  handMove: null | "-left" | "-right";
  noteObject: null | ExtendedNoteData;
};
