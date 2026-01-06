import { useEffect, useRef } from "react";
import type { ClueInfo } from "../types/crossword";

interface ClueListProps {
  title: "Across" | "Down";
  clues: ClueInfo[];
  currentClueNumber: number | undefined;
  currentDirection: "across" | "down";
  onClueClick: (clue: ClueInfo) => void;
}

export function ClueList({
  title,
  clues,
  currentClueNumber,
  currentDirection,
  onClueClick,
}: ClueListProps) {
  const direction = title.toLowerCase() as "across" | "down";
  const activeClueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeClueRef.current && currentDirection === direction) {
      activeClueRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentClueNumber, currentDirection, direction]);

  return (
    <div className="clue-column">
      <h2>{title}</h2>
      <div className="clue-list">
        {clues.map((clue) => {
          const isActive =
            currentClueNumber === clue.number && currentDirection === direction;
          return (
            <div
              key={`${clue.number}-${direction}`}
              ref={isActive ? activeClueRef : null}
              className={`clue-item ${isActive ? "active" : ""}`}
              onClick={() => onClueClick(clue)}
            >
              <span className="clue-number">{clue.number}.</span>
              <span className="clue-text">{clue.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
