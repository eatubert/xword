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

  const [userGrid, setUserGrid] = useState<string[][]>(() => {
    // Try to load saved state from localStorage
    if (typeof window !== "undefined" && data.fileName) {
      const savedState = localStorage.getItem(`crossword_${data.fileName}`);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (Array.isArray(parsed) && parsed.length === size.rows) {
            return parsed;
          }
        } catch (e) {
          console.error("Failed to parse saved crossword state", e);
        }
      }
    }
    return Array(size.rows)
      .fill(null)
      .map(() => Array(size.cols).fill(""));
  });
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
  const [elapsedTime, setElapsedTime] = useState(() => {
    if (typeof window !== "undefined" && data.fileName) {
      const savedTimer = localStorage.getItem(
        `crossword_timer_${data.fileName}`
      );
      if (savedTimer) {
        try {
          return JSON.parse(savedTimer);
        } catch (e) {
          console.error("Failed to parse saved timer state", e);
        }
      }
    }
    return 0;
  });
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Initialize pausedTimeRef with saved timer value
  const pausedTimeRef = useRef(0);
  const lastResumeTimeRef = useRef(Date.now());

  // Load saved timer into pausedTimeRef on mount
  useEffect(() => {
    if (typeof window !== "undefined" && data.fileName) {
      const savedTimer = localStorage.getItem(
        `crossword_timer_${data.fileName}`
      );
      if (savedTimer) {
        try {
          const parsed = JSON.parse(savedTimer);
          pausedTimeRef.current = parsed;
          setElapsedTime(parsed);
        } catch (e) {
          console.error("Failed to parse saved timer state", e);
        }
      }
    }
  }, [data.fileName]);

  const successOverlayRef = useRef<HTMLDivElement>(null);
  const errorOverlayRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[][]>(
    Array(size.rows)
      .fill(null)
      .map(() => Array(size.cols).fill(null))
  );

  // Clean up old localStorage entries on mount
  useEffect(() => {
    if (typeof window !== "undefined" && data.fileName) {
      const currentKey = `crossword_${data.fileName}`;
      const currentTimerKey = `crossword_timer_${data.fileName}`;
      // Iterate through all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          key.startsWith("crossword_") &&
          key !== currentKey &&
          key !== currentTimerKey
        ) {
          localStorage.removeItem(key);
        }
      }
    }
  }, [data.fileName]);

  // Save state to localStorage whenever userGrid changes
  useEffect(() => {
    if (typeof window !== "undefined" && data.fileName) {
      localStorage.setItem(
        `crossword_${data.fileName}`,
        JSON.stringify(userGrid)
      );
    }
  }, [userGrid, data.fileName]);

  // Save timer to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined" && data.fileName) {
      localStorage.setItem(
        `crossword_timer_${data.fileName}`,
        JSON.stringify(elapsedTime)
      );
    }
  }, [elapsedTime, data.fileName]);

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

  // Pause timer when browser window becomes inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Window is now hidden - save current elapsed time
        if (!isPaused && isTimerRunning) {
          const currentTime = Date.now();
          const sessionTime = Math.floor(
            (currentTime - lastResumeTimeRef.current) / 1000
          );
          pausedTimeRef.current += sessionTime;
          setElapsedTime(pausedTimeRef.current);
          setIsPaused(true);
        }
      } else {
        // Window is now visible - resume timer
        if (isPaused && isTimerRunning) {
          lastResumeTimeRef.current = Date.now();
          setIsPaused(false);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isPaused, isTimerRunning]);

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

  // Helper functions
  const isInteractionDisabled = (isCorrect && !isTimerRunning) || isPaused;
  const showPuzzleInterface = !(isCorrect && !showSuccessMessage);

  const selectAndFocusCell = (row: number, col: number) => {
    setSelectedCell({ row, col });
    setTimeout(() => {
      inputRefs.current[row]?.[col]?.focus();
    }, 0);
  };

  const getCluesByDirection = (dir: "across" | "down") =>
    Array.from(clueMap.values()).filter((c) => c.direction === dir);

  const handleBackspace = (row: number, col: number) => {
    const currentClue = getCurrentClue();
    if (!currentClue) return;

    // Check if we're at the start of the current word
    const isAtWordStart =
      (direction === "across" && col === currentClue.startCol) ||
      (direction === "down" && row === currentClue.startRow);

    if (isAtWordStart) {
      // Go to the last letter of the previous word
      const allClues = getCluesByDirection(direction);
      const currentIndex = allClues.findIndex(
        (c) => c.number === currentClue.number
      );
      const prevIndex = (currentIndex - 1 + allClues.length) % allClues.length;
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

      selectAndFocusCell(lastRow, lastCol);
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
  };

  const navigateToClue = (dir: "next" | "prev") => {
    const currentClue = getCurrentClue();
    if (!currentClue) return;

    const allClues = getCluesByDirection(direction);
    const currentIndex = allClues.findIndex(
      (c) => c.number === currentClue.number
    );

    const increment = dir === "next" ? 1 : -1;
    let attempts = 0;
    let targetIndex =
      (currentIndex + increment + allClues.length) % allClues.length;

    // Find next/prev unfilled or partially filled clue
    while (attempts < allClues.length) {
      const targetClue = allClues[targetIndex];
      const cells = getWordCells(targetClue, direction);
      const firstEmptyCell = cells.find(
        (cell) => !userGrid[cell.row][cell.col]
      );

      if (firstEmptyCell) {
        selectAndFocusCell(firstEmptyCell.row, firstEmptyCell.col);
        return;
      }

      targetIndex =
        (targetIndex + increment + allClues.length) % allClues.length;
      attempts++;
    }

    // All clues are filled, just go to the next/prev one
    const targetClue =
      allClues[(currentIndex + increment + allClues.length) % allClues.length];
    selectAndFocusCell(targetClue.startRow, targetClue.startCol);
  };

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
    if (grid[row][col] === "." || isInteractionDisabled) return;

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
    if (isInteractionDisabled) return;

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
            navigateToClue("next");
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
            navigateToClue("next");
            return;
          }
        }

        if (
          nextRow < size.rows &&
          nextCol < size.cols &&
          grid[nextRow][nextCol] !== "."
        ) {
          selectAndFocusCell(nextRow, nextCol);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (isInteractionDisabled) return;

    if (e.key === " ") {
      e.preventDefault();
      setDirection((prev) => (prev === "across" ? "down" : "across"));
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        navigateToClue("prev");
      } else {
        navigateToClue("next");
      }
    } else if (e.key === "Backspace" && !userGrid[row][col]) {
      e.preventDefault();
      handleBackspace(row, col);
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
        selectAndFocusCell(nextCell.row, nextCell.col);
      }
    }
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
    if (!selectedCell || isInteractionDisabled) return;

    if (key === "BACK") {
      const { row, col } = selectedCell;
      if (userGrid[row][col]) {
        const newGrid = userGrid.map((r) => [...r]);
        newGrid[row][col] = "";
        setUserGrid(newGrid);
      } else {
        handleBackspace(row, col);
      }
    } else {
      const { row, col } = selectedCell;
      handleInputChange(row, col, key);
    }
  };

  const handleClueClick = (clue: ClueInfo) => {
    setDirection(clue.direction);
    selectAndFocusCell(clue.startRow, clue.startCol);
  };

  const acrossClues = getCluesByDirection("across");
  const downClues = getCluesByDirection("down");

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
        className={`crossword-main ${!showPuzzleInterface ? "grid-centered" : ""}`}
      >
        {showPuzzleInterface && (
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
          selectedCell={showPuzzleInterface ? selectedCell : null}
          wordCells={showPuzzleInterface ? wordCells : []}
          inputRefs={inputRefs}
          isCorrect={isCorrect}
          isTimerRunning={isTimerRunning}
          onCellClick={handleCellClick}
          onInputChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />

        {showPuzzleInterface && (
          <ClueLine
            currentClue={currentClue}
            direction={direction}
            className="mobile-clue-line"
            onToggleDirection={toggleDirection}
            onPrevClue={() => navigateToClue("prev")}
            onNextClue={() => navigateToClue("next")}
          />
        )}

        {showPuzzleInterface && (
          <MobileKeyboard
            onKeyClick={handleKeyboardClick}
            disabled={isCorrect && !isTimerRunning}
          />
        )}
      </div>

      {showPuzzleInterface && (
        <ClueLine
          currentClue={currentClue}
          direction={direction}
          className="desktop-clue-line"
          onToggleDirection={toggleDirection}
          onPrevClue={() => navigateToClue("prev")}
          onNextClue={() => navigateToClue("next")}
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
