import type { ClueInfo } from "../types/crossword";

export function convertFlatGridTo2D(
  flatGrid: string[],
  rows: number,
  cols: number
): string[][] {
  const grid2D: string[][] = [];
  for (let i = 0; i < rows; i++) {
    grid2D.push(flatGrid.slice(i * cols, (i + 1) * cols));
  }
  return grid2D;
}

export function parseClue(
  clueText: string
): { number: number; text: string } | null {
  const match = clueText.match(/^(\d+)\.\s*(.+)$/);
  if (match) {
    return { number: parseInt(match[1]), text: match[2] };
  }
  return null;
}

export function buildClueMapAndNumberGrid(
  grid: string[][],
  size: { rows: number; cols: number },
  clues: { across: string[]; down: string[] }
): {
  clueMap: Map<string, ClueInfo>;
  numberGrid: (number | null)[][];
} {
  const numbers: (number | null)[][] = Array(size.rows)
    .fill(null)
    .map(() => Array(size.cols).fill(null));
  const map = new Map<string, ClueInfo>();
  let currentNumber = 1;

  for (let row = 0; row < size.rows; row++) {
    for (let col = 0; col < size.cols; col++) {
      if (grid[row][col] === ".") continue;

      const needsNumber =
        col === 0 ||
        grid[row][col - 1] === "." ||
        row === 0 ||
        grid[row - 1][col] === ".";

      if (needsNumber) {
        numbers[row][col] = currentNumber;

        // Check for across word
        if (col === 0 || grid[row][col - 1] === ".") {
          let length = 0;
          for (let c = col; c < size.cols && grid[row][c] !== "."; c++) {
            length++;
          }
          if (length > 1) {
            const acrossClue = clues.across.find((c) => {
              const parsed = parseClue(c);
              return parsed && parsed.number === currentNumber;
            });
            if (acrossClue) {
              const parsed = parseClue(acrossClue);
              if (parsed) {
                map.set(`${currentNumber}-across`, {
                  number: currentNumber,
                  text: parsed.text,
                  direction: "across",
                  startRow: row,
                  startCol: col,
                  length,
                });
              }
            }
          }
        }

        // Check for down word
        if (row === 0 || grid[row - 1][col] === ".") {
          let length = 0;
          for (let r = row; r < size.rows && grid[r][col] !== "."; r++) {
            length++;
          }
          if (length > 1) {
            const downClue = clues.down.find((c) => {
              const parsed = parseClue(c);
              return parsed && parsed.number === currentNumber;
            });
            if (downClue) {
              const parsed = parseClue(downClue);
              if (parsed) {
                map.set(`${currentNumber}-down`, {
                  number: currentNumber,
                  text: parsed.text,
                  direction: "down",
                  startRow: row,
                  startCol: col,
                  length,
                });
              }
            }
          }
        }

        currentNumber++;
      }
    }
  }

  return { clueMap: map, numberGrid: numbers };
}

export function findClueForCell(
  clueMap: Map<string, ClueInfo>,
  row: number,
  col: number,
  direction: "across" | "down"
): ClueInfo | null {
  for (const clue of clueMap.values()) {
    if (clue.direction === direction) {
      if (direction === "across") {
        if (
          clue.startRow === row &&
          col >= clue.startCol &&
          col < clue.startCol + clue.length
        ) {
          return clue;
        }
      } else {
        if (
          clue.startCol === col &&
          row >= clue.startRow &&
          row < clue.startRow + clue.length
        ) {
          return clue;
        }
      }
    }
  }
  return null;
}

export function getWordCells(
  clue: ClueInfo | null,
  direction: "across" | "down"
): { row: number; col: number }[] {
  if (!clue) return [];

  const cells: { row: number; col: number }[] = [];
  if (direction === "across") {
    for (let c = 0; c < clue.length; c++) {
      cells.push({ row: clue.startRow, col: clue.startCol + c });
    }
  } else {
    for (let r = 0; r < clue.length; r++) {
      cells.push({ row: clue.startRow + r, col: clue.startCol });
    }
  }

  return cells;
}

export function checkPuzzleCompletion(
  userGrid: string[][],
  grid: string[][]
): { isComplete: boolean; isCorrect: boolean } {
  const allFilled = userGrid.every((row, r) =>
    row.every((cell, c) => grid[r][c] === "." || cell.trim() !== "")
  );

  if (!allFilled) {
    return { isComplete: false, isCorrect: false };
  }

  const correct = userGrid.every((row, r) =>
    row.every(
      (cell, c) => grid[r][c] === "." || cell.toUpperCase() === grid[r][c]
    )
  );

  return { isComplete: true, isCorrect: correct };
}

export function findNextCell(
  grid: string[][],
  row: number,
  col: number,
  deltaRow: number,
  deltaCol: number,
  size: { rows: number; cols: number }
): { row: number; col: number } | null {
  let newRow = row + deltaRow;
  let newCol = col + deltaCol;

  while (
    newRow >= 0 &&
    newRow < size.rows &&
    newCol >= 0 &&
    newCol < size.cols
  ) {
    if (grid[newRow][newCol] !== ".") {
      return { row: newRow, col: newCol };
    }
    newRow += deltaRow;
    newCol += deltaCol;
  }

  return null;
}
