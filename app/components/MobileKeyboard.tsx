interface MobileKeyboardProps {
  onKeyClick: (key: string) => void;
  disabled: boolean;
}

const KEYBOARD_LAYOUT = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

export function MobileKeyboard({ onKeyClick, disabled }: MobileKeyboardProps) {
  return (
    <div className="mobile-keyboard">
      {KEYBOARD_LAYOUT.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboard-row">
          {row.map((key) => (
            <button
              key={key}
              className="keyboard-key"
              onClick={() => onKeyClick(key)}
              disabled={disabled}
            >
              {key}
            </button>
          ))}
          {rowIndex === KEYBOARD_LAYOUT.length - 1 && (
            <button
              className="keyboard-key keyboard-key-wide"
              onClick={() => onKeyClick("BACK")}
              disabled={disabled}
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
