import type { RefObject } from "react";

interface CrosswordGridProps {
  grid: string[][];
  userGrid: string[][];
  numberGrid: (number | null)[][];
  selectedCell: { row: number; col: number } | null;
  wordCells: { row: number; col: number }[];
  inputRefs: RefObject<(HTMLInputElement | null)[][]>;
  isCorrect: boolean;
  isTimerRunning: boolean;
  circles?: string[];
  incorrectCells: Set<string>;
  onCellClick: (row: number, col: number) => void;
  onInputChange: (row: number, col: number, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void;
}

export function CrosswordGrid({
  grid,
  userGrid,
  numberGrid,
  selectedCell,
  wordCells,
  inputRefs,
  isCorrect,
  isTimerRunning,
  circles,
  incorrectCells,
  onCellClick,
  onInputChange,
  onKeyDown,
}: CrosswordGridProps) {
  const size = { rows: grid.length, cols: grid[0]?.length || 0 };

  return (
    <div className="grid-container">
      <div
        className="crossword-grid"
        style={{
          gridTemplateColumns: `repeat(${size.cols}, 1fr)`,
          gridTemplateRows: `repeat(${size.rows}, 1fr)`,
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isBlocked = cell === ".";
            const isSelected =
              selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
            const isInWord = wordCells.some(
              (c) => c.row === rowIndex && c.col === colIndex,
            );
            const cellNumber = numberGrid[rowIndex]?.[colIndex];
            const cellIndex = rowIndex * size.cols + colIndex;
            const hasCircle = circles && circles[cellIndex] === "O";
            const isIncorrect = incorrectCells.has(`${rowIndex},${colIndex}`);

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`crossword-cell ${isBlocked ? "blocked" : ""} ${
                  isSelected ? "selected" : ""
                } ${isInWord ? "in-word" : ""} ${hasCircle ? "circled" : ""} ${isIncorrect ? "incorrect" : ""}`}
                onClick={() => onCellClick(rowIndex, colIndex)}
              >
                {!isBlocked && (
                  <>
                    {cellNumber && (
                      <span className="cell-number">{cellNumber}</span>
                    )}
                    <input
                      ref={(el) => {
                        if (!inputRefs.current) return;
                        if (!inputRefs.current[rowIndex]) {
                          inputRefs.current[rowIndex] = [];
                        }
                        inputRefs.current[rowIndex][colIndex] = el;
                      }}
                      type="text"
                      inputMode="none"
                      value={userGrid[rowIndex][colIndex]}
                      onChange={(e) =>
                        onInputChange(rowIndex, colIndex, e.target.value)
                      }
                      onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
                      disabled={isCorrect && !isTimerRunning}
                      className="cell-input"
                    />
                  </>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
