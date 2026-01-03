import type { ClueInfo } from "../types/crossword";

interface ClueLineProps {
  currentClue: ClueInfo | null;
  direction: "across" | "down";
  className?: string;
  onToggleDirection: () => void;
  onPrevClue: () => void;
  onNextClue: () => void;
}

export function ClueLine({
  currentClue,
  direction,
  className = "",
  onToggleDirection,
  onPrevClue,
  onNextClue,
}: ClueLineProps) {
  return (
    <div className={`clue-line ${className}`} onClick={onToggleDirection}>
      <button
        className="clue-nav-btn"
        onClick={(e) => {
          e.stopPropagation();
          onPrevClue();
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
          onNextClue();
        }}
      >
        &#9654;
      </button>
    </div>
  );
}
