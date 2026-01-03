import { useEffect, useMemo, useRef, useState } from "react";
import type { ClueInfo, CrosswordData } from "../types/crossword";
import {
  buildClueMapAndNumberGrid,
  checkPuzzleCompletion,
  convertFlatGridTo2D,
  findClueForCell,
  findNextCell,
  getWordCells,
} from "../utils/crosswordHelpers";
import { ClueLine } from "./ClueLine";
import { ClueList } from "./ClueList";
import { CrosswordGrid } from "./CrosswordGrid";
import { CrosswordHeader } from "./CrosswordHeader";
import { MobileKeyboard } from "./MobileKeyboard";

interface CrosswordProps {
  data: CrosswordData;
}

export function Crossword({ data }: CrosswordProps) {
  const { size, clues } = data;

  const grid = useMemo(
    () => convertFlatGridTo2D(data.grid, size.rows, size.cols),
    [data.grid, size.rows, size.cols]
  );

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
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const pausedTimeRef = useRef(0); // Accumulated time spent solving
  const lastResumeTimeRef = useRef(Date.now()); // Last time the timer was resumed
  const successOverlayRef = useRef<HTMLDivElement>(null);
  const errorOverlayRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[][]>(
    Array(size.rows)
      .fill(null)
      .map(() => Array(size.cols).fill(null))
  );

  // Initialize clue map and number grid
  useEffect(() => {
    const { clueMap: map, numberGrid: numbers } = buildClueMapAndNumberGrid(
      grid,
      size,
      clues
    );
    setNumberGrid(numbers);
    setClueMap(map);

    // Select first across word on initial load
    const acrossClues = Array.from(map.values()).filter(
      (c) => c.direction === "across"
    );
    if (acrossClues.length > 0) {
      const firstClue = acrossClues[0];
      setSelectedCell({ row: firstClue.startRow, col: firstClue.startCol });
      setTimeout(() => {
        inputRefs.current[firstClue.startRow]?.[firstClue.startCol]?.focus();
      }, 0);
    }
  }, [grid, size, clues]);

  // Timer
  useEffect(() => {
    if (!isTimerRunning || isPaused) return;

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const sessionTime = Math.floor(
        (currentTime - lastResumeTimeRef.current) / 1000
      );
      setElapsedTime(pausedTimeRef.current + sessionTime);
    }, 100); // Update more frequently for accuracy

    return () => clearInterval(interval);
  }, [isTimerRunning, isPaused]);

  // Check puzzle completion
  useEffect(() => {
    const { isComplete: complete, isCorrect: correct } = checkPuzzleCompletion(
      userGrid,
      grid
    );
    setIsComplete(complete);
    setIsCorrect(correct);
    if (correct) {
      setIsTimerRunning(false);
      setShowSuccessMessage(true);
    } else if (complete) {
      setShowErrorMessage(true);
    }
  }, [userGrid, grid]);

  // Focus overlays when messages appear
  useEffect(() => {
    if (showSuccessMessage && successOverlayRef.current) {
      successOverlayRef.current.focus();
    } else if (showErrorMessage && errorOverlayRef.current) {
      errorOverlayRef.current.focus();
    }
  }, [showSuccessMessage, showErrorMessage]);

  const getCurrentClue = (): ClueInfo | null => {
    if (!selectedCell) return null;
    return findClueForCell(
      clueMap,
      selectedCell.row,
      selectedCell.col,
      direction
    );
  };

  const currentClue = getCurrentClue();
  const wordCells = getWordCells(currentClue, direction);

  const togglePause = () => {
    if (!isPaused) {
      // About to pause - save the current elapsed time
      const currentTime = Date.now();
      const sessionTime = Math.floor(
        (currentTime - lastResumeTimeRef.current) / 1000
      );
      pausedTimeRef.current += sessionTime;
      setElapsedTime(pausedTimeRef.current);
    } else {
      // About to resume - reset the resume time
      lastResumeTimeRef.current = Date.now();
    }
    setIsPaused(!isPaused);
  };

  const handleCellClick = (row: number, col: number) => {
    if (grid[row][col] === "." || (isCorrect && !isTimerRunning) || isPaused)
      return;

    if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
      setDirection((prev) => (prev === "across" ? "down" : "across"));
    } else {
      setSelectedCell({ row, col });
      // Determine default direction
      const hasAcross = !!findClueForCell(clueMap, row, col, "across");
      const hasDown = !!findClueForCell(clueMap, row, col, "down");

      if (hasAcross && !hasDown) {
        setDirection("across");
      } else if (hasDown && !hasAcross) {
        setDirection("down");
      } else if (hasAcross) {
        setDirection("across");
      }
    }

    setTimeout(() => {
      inputRefs.current[row]?.[col]?.focus();
    }, 0);
  };

  const handleInputChange = (row: number, col: number, value: string) => {
    if ((isCorrect && !isTimerRunning) || isPaused) return;

    const newValue = value.slice(-1).toUpperCase();
    const newGrid = userGrid.map((r) => [...r]);
    newGrid[row][col] = newValue;
    setUserGrid(newGrid);

    if (newValue && selectedCell) {
      const currentClue = getCurrentClue();
      if (currentClue) {
        let nextRow = row;
        let nextCol = col;

        // Find next empty cell in the current word
        if (direction === "across") {
          nextCol++;
          // Skip filled cells
          while (
            nextCol < currentClue.startCol + currentClue.length &&
            newGrid[nextRow][nextCol]
          ) {
            nextCol++;
          }

          if (nextCol >= currentClue.startCol + currentClue.length) {
            goToNextClue();
            return;
          }
        } else {
          nextRow++;
          // Skip filled cells
          while (
            nextRow < currentClue.startRow + currentClue.length &&
            newGrid[nextRow][nextCol]
          ) {
            nextRow++;
          }

          if (nextRow >= currentClue.startRow + currentClue.length) {
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
    if ((isCorrect && !isTimerRunning) || isPaused) return;

    if (e.key === " ") {
      e.preventDefault();
      setDirection((prev) => (prev === "across" ? "down" : "across"));
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevClue();
      } else {
        goToNextClue();
      }
    } else if (e.key === "Backspace" && !userGrid[row][col]) {
      e.preventDefault();

      const currentClue = getCurrentClue();
      if (!currentClue) return;

      // Check if we're at the start of the current word
      const isAtWordStart =
        (direction === "across" && col === currentClue.startCol) ||
        (direction === "down" && row === currentClue.startRow);

      if (isAtWordStart) {
        // Go to the last letter of the previous word
        const allClues = Array.from(clueMap.values()).filter(
          (c) => c.direction === direction
        );
        const currentIndex = allClues.findIndex(
          (c) => c.number === currentClue.number
        );
        const prevIndex =
          (currentIndex - 1 + allClues.length) % allClues.length;
        const prevClue = allClues[prevIndex];

        // Go to last cell of previous word
        const lastRow =
          direction === "across"
            ? prevClue.startRow
            : prevClue.startRow + prevClue.length - 1;
        const lastCol =
          direction === "across"
            ? prevClue.startCol + prevClue.length - 1
            : prevClue.startCol;

        setSelectedCell({ row: lastRow, col: lastCol });
        setTimeout(() => {
          inputRefs.current[lastRow]?.[lastCol]?.focus();
        }, 0);
      } else {
        // Move to previous cell in current word
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
    } else if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown"
    ) {
      e.preventDefault();
      let deltaRow = 0;
      let deltaCol = 0;

      if (e.key === "ArrowLeft") deltaCol = -1;
      else if (e.key === "ArrowRight") deltaCol = 1;
      else if (e.key === "ArrowUp") deltaRow = -1;
      else if (e.key === "ArrowDown") deltaRow = 1;

      const nextCell = findNextCell(grid, row, col, deltaRow, deltaCol, size);
      if (nextCell) {
        setSelectedCell(nextCell);
        setTimeout(() => {
          inputRefs.current[nextCell.row]?.[nextCell.col]?.focus();
        }, 0);
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

    // Find next unfilled or partially filled clue
    let attempts = 0;
    let nextIndex = (currentIndex + 1) % allClues.length;

    while (attempts < allClues.length) {
      const nextClue = allClues[nextIndex];

      // Check if the word is completely filled
      const cells = getWordCells(nextClue, direction);
      const firstEmptyCell = cells.find(
        (cell) => !userGrid[cell.row][cell.col]
      );

      if (firstEmptyCell) {
        // Found a clue with at least one empty cell
        setSelectedCell({ row: firstEmptyCell.row, col: firstEmptyCell.col });
        setTimeout(() => {
          inputRefs.current[firstEmptyCell.row]?.[firstEmptyCell.col]?.focus();
        }, 0);
        return;
      }

      // Try next clue
      nextIndex = (nextIndex + 1) % allClues.length;
      attempts++;
    }

    // All clues are filled, just go to the next one
    const nextClue = allClues[(currentIndex + 1) % allClues.length];
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

    // Find previous unfilled or partially filled clue
    let attempts = 0;
    let prevIndex = (currentIndex - 1 + allClues.length) % allClues.length;

    while (attempts < allClues.length) {
      const prevClue = allClues[prevIndex];

      // Check if the word is completely filled
      const cells = getWordCells(prevClue, direction);
      const firstEmptyCell = cells.find(
        (cell) => !userGrid[cell.row][cell.col]
      );

      if (firstEmptyCell) {
        // Found a clue with at least one empty cell
        setSelectedCell({ row: firstEmptyCell.row, col: firstEmptyCell.col });
        setTimeout(() => {
          inputRefs.current[firstEmptyCell.row]?.[firstEmptyCell.col]?.focus();
        }, 0);
        return;
      }

      // Try previous clue
      prevIndex = (prevIndex - 1 + allClues.length) % allClues.length;
      attempts++;
    }

    // All clues are filled, just go to the previous one
    const prevClue =
      allClues[(currentIndex - 1 + allClues.length) % allClues.length];
    setSelectedCell({ row: prevClue.startRow, col: prevClue.startCol });
    setTimeout(() => {
      inputRefs.current[prevClue.startRow]?.[prevClue.startCol]?.focus();
    }, 0);
  };

  const toggleDirection = () => {
    setDirection((prev) => (prev === "across" ? "down" : "across"));
    if (selectedCell) {
      setTimeout(() => {
        inputRefs.current[selectedCell.row]?.[selectedCell.col]?.focus();
      }, 0);
    }
  };

  const handleKeyboardClick = (key: string) => {
    if (!selectedCell || (isCorrect && !isTimerRunning) || isPaused) return;

    if (key === "BACK") {
      const { row, col } = selectedCell;
      if (userGrid[row][col]) {
        const newGrid = userGrid.map((r) => [...r]);
        newGrid[row][col] = "";
        setUserGrid(newGrid);
      } else {
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
      const { row, col } = selectedCell;
      handleInputChange(row, col, key);
    }
  };

  const handleClueClick = (clue: ClueInfo) => {
    setSelectedCell({ row: clue.startRow, col: clue.startCol });
    setDirection(clue.direction);
    setTimeout(() => {
      inputRefs.current[clue.startRow]?.[clue.startCol]?.focus();
    }, 0);
  };

  const acrossClues = Array.from(clueMap.values()).filter(
    (c) => c.direction === "across"
  );
  const downClues = Array.from(clueMap.values()).filter(
    (c) => c.direction === "down"
  );

  return (
    <div className="crossword-container">
      <CrosswordHeader
        title={data.title}
        author={data.author}
        elapsedTime={elapsedTime}
        isPaused={isPaused}
        isCorrect={isCorrect}
        onTogglePause={togglePause}
      />

      {isPaused && (
        <div className="pause-overlay">
          <div className="pause-content">
            <h2>Paused</h2>
            <button className="resume-button" onClick={togglePause}>
              Continue
            </button>
          </div>
        </div>
      )}

      <div
        className={`crossword-main ${isCorrect && !showSuccessMessage ? "grid-centered" : ""}`}
      >
        {!(isCorrect && !showSuccessMessage) && (
          <div className="clue-lists desktop-only">
            <ClueList
              title="Across"
              clues={acrossClues}
              currentClueNumber={currentClue?.number}
              currentDirection={direction}
              onClueClick={handleClueClick}
            />
            <ClueList
              title="Down"
              clues={downClues}
              currentClueNumber={currentClue?.number}
              currentDirection={direction}
              onClueClick={handleClueClick}
            />
          </div>
        )}

        <CrosswordGrid
          grid={grid}
          userGrid={userGrid}
          numberGrid={numberGrid}
          selectedCell={isCorrect && !showSuccessMessage ? null : selectedCell}
          wordCells={isCorrect && !showSuccessMessage ? [] : wordCells}
          inputRefs={inputRefs}
          isCorrect={isCorrect}
          isTimerRunning={isTimerRunning}
          onCellClick={handleCellClick}
          onInputChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />

        {!(isCorrect && !showSuccessMessage) && (
          <ClueLine
            currentClue={currentClue}
            direction={direction}
            className="mobile-clue-line"
            onToggleDirection={toggleDirection}
            onPrevClue={goToPrevClue}
            onNextClue={goToNextClue}
          />
        )}

        {!(isCorrect && !showSuccessMessage) && (
          <MobileKeyboard
            onKeyClick={handleKeyboardClick}
            disabled={isCorrect && !isTimerRunning}
          />
        )}
      </div>

      {!(isCorrect && !showSuccessMessage) && (
        <ClueLine
          currentClue={currentClue}
          direction={direction}
          className="desktop-clue-line"
          onToggleDirection={toggleDirection}
          onPrevClue={goToPrevClue}
          onNextClue={goToNextClue}
        />
      )}

      {showSuccessMessage && (
        <div
          ref={successOverlayRef}
          className="pause-overlay"
          tabIndex={-1}
          onKeyDown={(e) => e.key === "Escape" && setShowSuccessMessage(false)}
        >
          <div className="status-message success">
            <span>🎉 Congratulations! You solved it!</span>
            <button
              className="close-message-btn"
              onClick={() => setShowSuccessMessage(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {showErrorMessage && (
        <div
          ref={errorOverlayRef}
          className="pause-overlay"
          tabIndex={-1}
          onKeyDown={(e) => e.key === "Escape" && setShowErrorMessage(false)}
        >
          <div className="status-message error">
            <span>Not quite right. Keep trying!</span>
            <button
              className="close-message-btn"
              onClick={() => setShowErrorMessage(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
