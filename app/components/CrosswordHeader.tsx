interface CrosswordHeaderProps {
  title: string;
  author: string;
  elapsedTime: number;
  isPaused: boolean;
  isCorrect: boolean;
  onTogglePause: () => void;
}

export function CrosswordHeader({
  title,
  author,
  elapsedTime,
  isPaused,
  isCorrect,
  onTogglePause,
}: CrosswordHeaderProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="crossword-header">
      <div className="title-container">
        <h1>{title}</h1>
        <span className="author">By {author}</span>
      </div>
      <div className="timer-container">
        <span className="timer">{formatTime(elapsedTime)}</span>
        {!isCorrect && (
          <button className="pause-button" onClick={onTogglePause}>
            {isPaused ? "▶" : "⏸"}
          </button>
        )}
      </div>
    </div>
  );
}
