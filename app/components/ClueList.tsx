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

  return (
    <div className="clue-column">
      <h2>{title}</h2>
      <div className="clue-list">
        {clues.map((clue) => (
          <div
            key={`${clue.number}-${direction}`}
            className={`clue-item ${
              currentClueNumber === clue.number &&
              currentDirection === direction
                ? "active"
                : ""
            }`}
            onClick={() => onClueClick(clue)}
          >
            <span className="clue-number">{clue.number}.</span>
            <span className="clue-text">{clue.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
