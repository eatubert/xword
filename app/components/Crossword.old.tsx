import { useEffect, useMemo, useRef, useState } from "react";
import type { ClueInfo, CrosswordData } from "../types/crossword";

interface CrosswordProps {
  data: CrosswordData;
}

export function Crossword({ data }: CrosswordProps) {
  const { size, clues } = data;

  // Convert flat grid array to 2D array
  const grid = useMemo(() => {
    const grid2D: string[][] = [];
    for (let i = 0; i < size.rows; i++) {
      grid2D.push(data.grid.slice(i * size.cols, (i + 1) * size.cols));
    }
    return grid2D;
  }, [data.grid, size.rows, size.cols]);

  const [userGrid, setUserGrid] = useState<string[][]>(() =>
    Array(size.rows)
      .fill(null)
      .map(() => Array(size.cols).fill(""))
  );
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [direction, setDirection] = useState<"across" | "down">("across");
  const [clueMap, setClueMap] = useState<Map<string, ClueInfo>>(new Map());
  const [numberGrid, setNumberGrid] = useState<(number | null)[][]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[][]>(
    Array(size.rows)
      .fill(null)
      .map(() => Array(size.cols).fill(null))
  );

  // Initialize clue map and number grid
  useEffect(() => {
    const numbers: (number | null)[][] = Array(size.rows)
      .fill(null)
      .map(() => Array(size.cols).fill(null));
    const map = new Map<string, ClueInfo>();
    let currentNumber = 1;

    // Parse clues to extract clue numbers and texts
    const parseClue = (clueText: string) => {
      const match = clueText.match(/^(\d+)\.\s*(.+)$/);
      if (match) {
        return { number: parseInt(match[1]), text: match[2] };
      }
      return null;
    };

    // Build clue map and number grid
    for (let row = 0; row < size.rows; row++) {
      for (let col = 0; col < size.cols; col++) {
        if (grid[row][col] === ".") continue;

        const needsNumber =
          col === 0 ||
          grid[row][col - 1] === "." || // Start of across word
          row === 0 ||
          grid[row - 1][col] === "."; // Start of down word

        if (needsNumber) {
          numbers[row][col] = currentNumber;

          // Check if this is the start of an across word
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

          // Check if this is the start of a down word
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

    setNumberGrid(numbers);
    setClueMap(map);
  }, [grid, size, clues]);

  // Timer
  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isTimerRunning]);

  // Check if puzzle is complete and correct
  useEffect(() => {
    const allFilled = userGrid.every((row, r) =>
      row.every((cell, c) => grid[r][c] === "." || cell.trim() !== "")
    );

    if (allFilled) {
      setIsComplete(true);
      const correct = userGrid.every((row, r) =>
        row.every(
          (cell, c) => grid[r][c] === "." || cell.toUpperCase() === grid[r][c]
        )
      );
      setIsCorrect(correct);
      if (correct) {
        setIsTimerRunning(false);
      }
    } else {
      setIsComplete(false);
      setIsCorrect(false);
    }
  }, [userGrid, grid]);

  // Get current clue info
  const getCurrentClue = (): ClueInfo | null => {
    if (!selectedCell) return null;

    const { row, col } = selectedCell;

    // Find the clue that contains this cell
    for (const [key, clue] of clueMap) {
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
  };

  // Get cells in current word
  const getWordCells = (): { row: number; col: number }[] => {
    if (!selectedCell) return [];

    const currentClue = getCurrentClue();
    if (!currentClue) return [];

    const cells: { row: number; col: number }[] = [];
    if (direction === "across") {
      for (let c = 0; c < currentClue.length; c++) {
        cells.push({
          row: currentClue.startRow,
          col: currentClue.startCol + c,
        });
      }
    } else {
      for (let r = 0; r < currentClue.length; r++) {
        cells.push({
          row: currentClue.startRow + r,
          col: currentClue.startCol,
        });
      }
    }

    return cells;
  };

  const wordCells = getWordCells();

  const handleCellClick = (row: number, col: number) => {
    if (grid[row][col] === "." || (isCorrect && !isTimerRunning)) return;

    if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
      // Toggle direction
      setDirection((prev) => (prev === "across" ? "down" : "across"));
    } else {
      setSelectedCell({ row, col });
      // Set default direction based on available clues
      const hasAcross = Array.from(clueMap.values()).some(
        (clue) =>
          clue.direction === "across" &&
          clue.startRow === row &&
          col >= clue.startCol &&
          col < clue.startCol + clue.length
      );
      const hasDown = Array.from(clueMap.values()).some(
        (clue) =>
          clue.direction === "down" &&
          clue.startCol === col &&
          row >= clue.startRow &&
          row < clue.startRow + clue.length
      );

      if (hasAcross && !hasDown) {
        setDirection("across");
      } else if (hasDown && !hasAcross) {
        setDirection("down");
      } else if (hasAcross) {
        setDirection("across");
      }
    }

    // Focus the input
    setTimeout(() => {
      inputRefs.current[row]?.[col]?.focus();
    }, 0);
  };

  const handleInputChange = (row: number, col: number, value: string) => {
    if (isCorrect && !isTimerRunning) return;

    const newValue = value.slice(-1).toUpperCase();
    const newGrid = userGrid.map((r) => [...r]);
    newGrid[row][col] = newValue;
    setUserGrid(newGrid);

    // Move to next cell in word if a letter was entered
    if (newValue && selectedCell) {
      const currentClue = getCurrentClue();
      if (currentClue) {
        let nextRow = row;
        let nextCol = col;

        if (direction === "across") {
          nextCol++;
          if (nextCol >= currentClue.startCol + currentClue.length) {
            // Move to next clue
            goToNextClue();
            return;
          }
        } else {
          nextRow++;
          if (nextRow >= currentClue.startRow + currentClue.length) {
            // Move to next clue
            goToNextClue();
            return;
          }
        }

        if (
          nextRow < size.rows &&
          nextCol < size.cols &&
          grid[nextRow][nextCol] !== "."
        ) {
          setSelectedCell({ row: nextRow, col: nextCol });
          setTimeout(() => {
            inputRefs.current[nextRow]?.[nextCol]?.focus();
          }, 0);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (isCorrect && !isTimerRunning) return;

    if (e.key === " ") {
      e.preventDefault();
      // Toggle direction
      setDirection((prev) => (prev === "across" ? "down" : "across"));
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Navigate to next or previous clue
      if (e.shiftKey) {
        goToPrevClue();
      } else {
        goToNextClue();
      }
    } else if (e.key === "Backspace" && !userGrid[row][col]) {
      e.preventDefault();
      // Move to previous cell
      let prevRow = row;
      let prevCol = col;

      if (direction === "across") {
        prevCol--;
      } else {
        prevRow--;
      }

      if (prevRow >= 0 && prevCol >= 0 && grid[prevRow][prevCol] !== ".") {
        setSelectedCell({ row: prevRow, col: prevCol });
        const newGrid = userGrid.map((r) => [...r]);
        newGrid[prevRow][prevCol] = "";
        setUserGrid(newGrid);
        setTimeout(() => {
          inputRefs.current[prevRow]?.[prevCol]?.focus();
        }, 0);
      }
    } else if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown"
    ) {
      e.preventDefault();
      let newRow = row;
      let newCol = col;
      let deltaRow = 0;
      let deltaCol = 0;

      if (e.key === "ArrowLeft") deltaCol = -1;
      else if (e.key === "ArrowRight") deltaCol = 1;
      else if (e.key === "ArrowUp") deltaRow = -1;
      else if (e.key === "ArrowDown") deltaRow = 1;

      // Keep moving in the direction until we find a non-blocked cell
      newRow += deltaRow;
      newCol += deltaCol;

      while (
        newRow >= 0 &&
        newRow < size.rows &&
        newCol >= 0 &&
        newCol < size.cols
      ) {
        if (grid[newRow][newCol] !== ".") {
          // Found a non-blocked cell
          setSelectedCell({ row: newRow, col: newCol });
          setTimeout(() => {
            inputRefs.current[newRow]?.[newCol]?.focus();
          }, 0);
          break;
        }
        // Continue moving in the same direction
        newRow += deltaRow;
        newCol += deltaCol;
      }
    }
  };

  const goToNextClue = () => {
    const currentClue = getCurrentClue();
    if (!currentClue) return;

    const allClues = Array.from(clueMap.values()).filter(
      (c) => c.direction === direction
    );
    const currentIndex = allClues.findIndex(
      (c) => c.number === currentClue.number
    );
    const nextIndex = (currentIndex + 1) % allClues.length;
    const nextClue = allClues[nextIndex];

    setSelectedCell({ row: nextClue.startRow, col: nextClue.startCol });
    setTimeout(() => {
      inputRefs.current[nextClue.startRow]?.[nextClue.startCol]?.focus();
    }, 0);
  };

  const goToPrevClue = () => {
    const currentClue = getCurrentClue();
    if (!currentClue) return;

    const allClues = Array.from(clueMap.values()).filter(
      (c) => c.direction === direction
    );
    const currentIndex = allClues.findIndex(
      (c) => c.number === currentClue.number
    );
    const prevIndex = (currentIndex - 1 + allClues.length) % allClues.length;
    const prevClue = allClues[prevIndex];

    setSelectedCell({ row: prevClue.startRow, col: prevClue.startCol });
    setTimeout(() => {
      inputRefs.current[prevClue.startRow]?.[prevClue.startCol]?.focus();
    }, 0);
  };

  const toggleDirection = () => {
    setDirection((prev) => (prev === "across" ? "down" : "across"));
    // Refocus the current cell
    if (selectedCell) {
      setTimeout(() => {
        inputRefs.current[selectedCell.row]?.[selectedCell.col]?.focus();
      }, 0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleKeyboardClick = (key: string) => {
    if (!selectedCell || (isCorrect && !isTimerRunning)) return;

    if (key === "BACK") {
      // Handle backspace
      const { row, col } = selectedCell;
      if (userGrid[row][col]) {
        // Delete current cell
        const newGrid = userGrid.map((r) => [...r]);
        newGrid[row][col] = "";
        setUserGrid(newGrid);
      } else {
        // Move to previous cell and delete
        let prevRow = row;
        let prevCol = col;

        if (direction === "across") {
          prevCol--;
        } else {
          prevRow--;
        }

        if (prevRow >= 0 && prevCol >= 0 && grid[prevRow][prevCol] !== ".") {
          setSelectedCell({ row: prevRow, col: prevCol });
          const newGrid = userGrid.map((r) => [...r]);
          newGrid[prevRow][prevCol] = "";
          setUserGrid(newGrid);
          setTimeout(() => {
            inputRefs.current[prevRow]?.[prevCol]?.focus();
          }, 0);
        }
      }
    } else {
      // Handle letter input
      const { row, col } = selectedCell;
      handleInputChange(row, col, key);
    }
  };

  const currentClue = getCurrentClue();

  const acrossClues = Array.from(clueMap.values()).filter(
    (c) => c.direction === "across"
  );
  const downClues = Array.from(clueMap.values()).filter(
    (c) => c.direction === "down"
  );

  return (
    <div className="crossword-container">
      <div className="crossword-header">
        <h1>{data.title}</h1>
        <div className="crossword-info">
          <span>By {data.author}</span>
          <span className="timer">{formatTime(elapsedTime)}</span>
        </div>
      </div>

      <div className="crossword-main">
        {/* Clue lists - only visible on desktop */}
        <div className="clue-lists desktop-only">
          <div className="clue-column">
            <h2>Across</h2>
            <div className="clue-list">
              {acrossClues.map((clue) => (
                <div
                  key={`${clue.number}-across`}
                  className={`clue-item ${
                    currentClue?.number === clue.number &&
                    direction === "across"
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedCell({ row: clue.startRow, col: clue.startCol });
                    setDirection("across");
                    setTimeout(() => {
                      inputRefs.current[clue.startRow]?.[
                        clue.startCol
                      ]?.focus();
                    }, 0);
                  }}
                >
                  <span className="clue-number">{clue.number}.</span>
                  <span className="clue-text">{clue.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="clue-column">
            <h2>Down</h2>
            <div className="clue-list">
              {downClues.map((clue) => (
                <div
                  key={`${clue.number}-down`}
                  className={`clue-item ${
                    currentClue?.number === clue.number && direction === "down"
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedCell({ row: clue.startRow, col: clue.startCol });
                    setDirection("down");
                    setTimeout(() => {
                      inputRefs.current[clue.startRow]?.[
                        clue.startCol
                      ]?.focus();
                    }, 0);
                  }}
                >
                  <span className="clue-number">{clue.number}.</span>
                  <span className="clue-text">{clue.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
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
                  selectedCell?.row === rowIndex &&
                  selectedCell?.col === colIndex;
                const isInWord = wordCells.some(
                  (c) => c.row === rowIndex && c.col === colIndex
                );
                const cellNumber = numberGrid[rowIndex]?.[colIndex];

                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`crossword-cell ${isBlocked ? "blocked" : ""} ${
                      isSelected ? "selected" : ""
                    } ${isInWord ? "in-word" : ""}`}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                  >
                    {!isBlocked && (
                      <>
                        {cellNumber && (
                          <span className="cell-number">{cellNumber}</span>
                        )}
                        <input
                          ref={(el) => {
                            if (!inputRefs.current[rowIndex]) {
                              inputRefs.current[rowIndex] = [];
                            }
                            inputRefs.current[rowIndex][colIndex] = el;
                          }}
                          type="text"
                          maxLength={1}
                          value={userGrid[rowIndex][colIndex]}
                          onChange={(e) =>
                            handleInputChange(
                              rowIndex,
                              colIndex,
                              e.target.value
                            )
                          }
                          onKeyDown={(e) =>
                            handleKeyDown(e, rowIndex, colIndex)
                          }
                          disabled={isCorrect && !isTimerRunning}
                          className="cell-input"
                        />
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Clue line - mobile: after grid */}
        <div className="clue-line mobile-clue-line" onClick={toggleDirection}>
          <button
            className="clue-nav-btn"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevClue();
            }}
          >
            &#9664;
          </button>
          <div className="current-clue">
            {currentClue ? (
              <>
                <span className="clue-number-display">
                  {currentClue.number} {direction.toUpperCase()}
                </span>
                <span className="clue-text-display">{currentClue.text}</span>
              </>
            ) : (
              <span className="no-clue">Click a cell to start</span>
            )}
          </div>
          <button
            className="clue-nav-btn"
            onClick={(e) => {
              e.stopPropagation();
              goToNextClue();
            }}
          >
            &#9654;
          </button>
        </div>

        {/* Mobile keyboard */}
        <div className="mobile-keyboard">
          <div className="keyboard-row">
            {["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"].map((key) => (
              <button
                key={key}
                className="keyboard-key"
                onClick={() => handleKeyboardClick(key)}
                disabled={isCorrect && !isTimerRunning}
              >
                {key}
              </button>
            ))}
          </div>
          <div className="keyboard-row">
            {["A", "S", "D", "F", "G", "H", "J", "K", "L"].map((key) => (
              <button
                key={key}
                className="keyboard-key"
                onClick={() => handleKeyboardClick(key)}
                disabled={isCorrect && !isTimerRunning}
              >
                {key}
              </button>
            ))}
          </div>
          <div className="keyboard-row">
            {["Z", "X", "C", "V", "B", "N", "M"].map((key) => (
              <button
                key={key}
                className="keyboard-key"
                onClick={() => handleKeyboardClick(key)}
                disabled={isCorrect && !isTimerRunning}
              >
                {key}
              </button>
            ))}
            <button
              className="keyboard-key keyboard-key-wide"
              onClick={() => handleKeyboardClick("BACK")}
              disabled={isCorrect && !isTimerRunning}
            >
              ⌫
            </button>
          </div>
        </div>
      </div>

      {/* Clue line - desktop: below everything */}
      <div className="clue-line desktop-clue-line" onClick={toggleDirection}>
        <button
          className="clue-nav-btn"
          onClick={(e) => {
            e.stopPropagation();
            goToPrevClue();
          }}
        >
          &#9664;
        </button>
        <div className="current-clue">
          {currentClue ? (
            <>
              <span className="clue-number-display">
                {currentClue.number} {direction.toUpperCase()}
              </span>
              <span className="clue-text-display">{currentClue.text}</span>
            </>
          ) : (
            <span className="no-clue">Click a cell to start</span>
          )}
        </div>
        <button
          className="clue-nav-btn"
          onClick={(e) => {
            e.stopPropagation();
            goToNextClue();
          }}
        >
          &#9654;
        </button>
      </div>

      {/* Status message */}
      {isComplete && (
        <div className={`status-message ${isCorrect ? "success" : "error"}`}>
          {isCorrect
            ? "🎉 Congratulations! You solved it!"
            : "❌ Not quite right. Keep trying!"}
        </div>
      )}
    </div>
  );
}
