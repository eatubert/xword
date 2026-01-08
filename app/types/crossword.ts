export interface CrosswordData {
  author: string;
  title: string;
  fileName?: string;
  size: {
    rows: number;
    cols: number;
  };
  clues: {
    across: string[];
    down: string[];
  };
  grid: string[];
}

export interface ClueInfo {
  number: number;
  text: string;
  direction: "across" | "down";
  startRow: number;
  startCol: number;
  length: number;
}
