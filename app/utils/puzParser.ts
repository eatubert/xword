/**
 * Parser for Across Lite .puz crossword puzzle files
 * Based on format specification: https://gist.github.com/sliminality/dab21fa834eae0a70193c7cd69c356d5
 */

interface PuzzleData {
  author: string;
  title: string;
  size: {
    rows: number;
    cols: number;
  };
  clues: {
    across: string[];
    down: string[];
  };
  grid: string[];
  copyright?: string;
  notes?: string;
  circles?: string[];
}

/**
 * Checks if a cell is black (non-playable)
 */
function isBlackCell(
  grid: string[],
  x: number,
  y: number,
  width: number,
): boolean {
  const index = y * width + x;
  return grid[index] === ".";
}

/**
 * Determines if a cell needs an across clue number
 */
function cellNeedsAcrossNumber(
  grid: string[],
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  // Check that there is no blank to the left of us
  if (x === 0 || isBlackCell(grid, x - 1, y, width)) {
    // Check that there is space (at least two cells) for a word here
    if (x + 1 < width && !isBlackCell(grid, x + 1, y, width)) {
      return true;
    }
  }
  return false;
}

/**
 * Determines if a cell needs a down clue number
 */
function cellNeedsDownNumber(
  grid: string[],
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  // Check that there is no blank above us
  if (y === 0 || isBlackCell(grid, x, y - 1, width)) {
    // Check that there is space (at least two cells) for a word here
    if (y + 1 < height && !isBlackCell(grid, x, y + 1, width)) {
      return true;
    }
  }
  return false;
}

/**
 * Assigns clue numbers to cells based on grid structure
 */
function assignClueNumbers(
  grid: string[],
  width: number,
  height: number,
): {
  acrossNumbers: number[];
  downNumbers: number[];
  cellNumbers: Map<string, number>;
} {
  const acrossNumbers: number[] = [];
  const downNumbers: number[] = [];
  const cellNumbers = new Map<string, number>();
  let curCellNumber = 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isBlackCell(grid, x, y, width)) {
        continue;
      }

      let assignedNumber = false;

      if (cellNeedsAcrossNumber(grid, x, y, width, height)) {
        acrossNumbers.push(curCellNumber);
        cellNumbers.set(`${x},${y}`, curCellNumber);
        assignedNumber = true;
      }

      if (cellNeedsDownNumber(grid, x, y, width, height)) {
        downNumbers.push(curCellNumber);
        cellNumbers.set(`${x},${y}`, curCellNumber);
        assignedNumber = true;
      }

      if (assignedNumber) {
        curCellNumber++;
      }
    }
  }

  return { acrossNumbers, downNumbers, cellNumbers };
}

/**
 * Reads a null-terminated string from a buffer starting at the given offset
 */
function readNullTerminatedString(
  buffer: Uint8Array,
  offset: number,
): { value: string; nextOffset: number } {
  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) {
    end++;
  }

  const decoder = new TextDecoder("utf-8");
  const value = decoder.decode(buffer.slice(offset, end));
  return { value, nextOffset: end + 1 }; // +1 to skip the null terminator
}

/**
 * Reads a 16-bit little-endian integer from a buffer
 */
function readShort(buffer: Uint8Array, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8);
}

/**
 * Cleans HTML entities and tags from a string
 * Converts entities like &amp; to & and removes tags like <bold>
 */
function cleanHtmlFromClue(text: string): string {
  // Remove HTML tags
  let cleaned = text.replace(/<[^>]*>/g, "");

  // Decode HTML entities
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&#39;": "'",
    "&#34;": '"',
    "&mdash;": "—",
    "&ndash;": "–",
    "&hellip;": "…",
    "&bull;": "•",
    "&middot;": "·",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
  };

  for (const [entity, char] of Object.entries(entities)) {
    cleaned = cleaned.replace(new RegExp(entity, "g"), char);
  }

  // Handle numeric entities (&#123; or &#xAB;)
  cleaned = cleaned.replace(/&#(\d+);/g, (_, num) =>
    String.fromCharCode(parseInt(num, 10)),
  );
  cleaned = cleaned.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );

  return cleaned;
}

/**
 * Finds and parses extra sections like GEXT, GRBS, RTBL, etc.
 * Returns the parsed sections as an object
 */
function parseExtraSections(
  buffer: Uint8Array,
  startOffset: number,
): Map<string, Uint8Array> {
  const sections = new Map<string, Uint8Array>();
  let offset = startOffset;

  // Check if we have room for at least one section header
  while (offset + 8 <= buffer.length) {
    // Read section name (4 bytes)
    const sectionName = String.fromCharCode(
      buffer[offset],
      buffer[offset + 1],
      buffer[offset + 2],
      buffer[offset + 3],
    );

    // Check if this looks like a valid section name (uppercase letters)
    if (!/^[A-Z]{4}$/.test(sectionName)) {
      break;
    }

    // Read length (2 bytes, little-endian)
    const length = readShort(buffer, offset + 4);

    // Skip checksum (2 bytes)
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    // Make sure we have enough data
    if (dataEnd > buffer.length) {
      break;
    }

    // Extract the data (not including the null terminator)
    sections.set(sectionName, buffer.slice(dataStart, dataEnd));

    // Move to next section (data + null terminator)
    offset = dataEnd + 1;
  }

  return sections;
}

/**
 * Parse a .puz file and convert it to the JSON format expected by the app
 */
export async function parsePuzFile(file: File): Promise<PuzzleData> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Validate file magic (should be "ACROSS&DOWN" at offset 0x02)
  const magicString = String.fromCharCode(...buffer.slice(0x02, 0x0e));
  if (!magicString.startsWith("ACROSS&DOWN")) {
    throw new Error("Invalid .puz file: missing ACROSS&DOWN magic string");
  }

  // Read header information
  const width = buffer[0x2c];
  const height = buffer[0x2d];
  const numClues = readShort(buffer, 0x2e);

  if (width < 1 || height < 1 || width > 50 || height > 50) {
    throw new Error(`Invalid puzzle dimensions: ${width}x${height}`);
  }

  // Read solution (starts at offset 0x34)
  const solutionOffset = 0x34;
  const gridSize = width * height;
  const solution = Array.from(
    buffer.slice(solutionOffset, solutionOffset + gridSize),
  ).map((byte) => String.fromCharCode(byte));

  // Skip player state (same size as solution)
  const stringsOffset = solutionOffset + gridSize + gridSize;

  // Read strings: title, author, copyright, clues, notes
  let offset = stringsOffset;

  const { value: title, nextOffset: afterTitle } = readNullTerminatedString(
    buffer,
    offset,
  );
  offset = afterTitle;

  const { value: author, nextOffset: afterAuthor } = readNullTerminatedString(
    buffer,
    offset,
  );
  offset = afterAuthor;

  const { value: copyright, nextOffset: afterCopyright } =
    readNullTerminatedString(buffer, offset);
  offset = afterCopyright;

  // Read clues
  const clueStrings: string[] = [];
  for (let i = 0; i < numClues; i++) {
    const { value: clue, nextOffset } = readNullTerminatedString(
      buffer,
      offset,
    );
    // Clean HTML entities and tags from clues
    clueStrings.push(cleanHtmlFromClue(clue));
    offset = nextOffset;
  }

  // Read notes (optional)
  let notes = "";
  let notesEndOffset = offset;
  if (offset < buffer.length) {
    const { value: notesValue, nextOffset } = readNullTerminatedString(
      buffer,
      offset,
    );
    notes = notesValue;
    notesEndOffset = nextOffset;
  }

  // Parse extra sections (GEXT, GRBS, RTBL, LTIM, etc.)
  const extraSections = parseExtraSections(buffer, notesEndOffset);

  // Process GEXT section for circled squares
  let circles: string[] | undefined;
  const gextData = extraSections.get("GEXT");
  if (gextData && gextData.length === gridSize) {
    circles = Array.from(gextData).map((byte) => {
      // 0x80 bit indicates a circled square
      return byte & 0x80 ? "O" : ".";
    });
  }

  // Assign clue numbers based on grid structure
  const { acrossNumbers, downNumbers } = assignClueNumbers(
    solution,
    width,
    height,
  );

  // Separate clues into across and down based on the assigned numbers
  const acrossClues: string[] = [];
  const downClues: string[] = [];

  let clueIndex = 0;
  let acrossIndex = 0;
  let downIndex = 0;

  while (clueIndex < clueStrings.length) {
    const nextAcrossNum =
      acrossIndex < acrossNumbers.length
        ? acrossNumbers[acrossIndex]
        : Infinity;
    const nextDownNum =
      downIndex < downNumbers.length ? downNumbers[downIndex] : Infinity;

    if (nextAcrossNum <= nextDownNum) {
      // This is an across clue
      acrossClues.push(`${nextAcrossNum}. ${clueStrings[clueIndex]}`);
      acrossIndex++;
    } else {
      // This is a down clue
      downClues.push(`${nextDownNum}. ${clueStrings[clueIndex]}`);
      downIndex++;
    }
    clueIndex++;
  }

  // Build the result object
  const result: PuzzleData = {
    title: title || "Untitled Puzzle",
    author: author || "Unknown",
    size: {
      rows: height,
      cols: width,
    },
    clues: {
      across: acrossClues,
      down: downClues,
    },
    grid: solution,
  };

  if (copyright) {
    result.copyright = copyright;
  }

  if (notes) {
    result.notes = notes;
  }

  if (circles) {
    result.circles = circles;
  }

  return result;
}
