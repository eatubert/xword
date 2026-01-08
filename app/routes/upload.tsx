import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { useState } from "react";
import { redirect } from "react-router";
import { Resource } from "sst";
import "../styles/upload.css";
import type { Route } from "./+types/upload";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Upload Puzzle - Crossword Solver" },
    { name: "description", content: "Upload a new crossword puzzle" },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const date = formData.get("date") as string;
  const file = formData.get("file") as File;

  if (!date || !file) {
    return { error: "Date and file are required" };
  }

  // Validate date format (YYYY-MM-DD)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(date)) {
    return { error: "Date must be in format YYYY-MM-DD" };
  }

  // Validate file is JSON
  if (!file.name.endsWith(".json") && file.type !== "application/json") {
    return { error: "File must be a JSON file" };
  }

  try {
    // Read file content
    const fileContent = await file.text();

    // Validate JSON structure
    let puzzleData;
    try {
      puzzleData = JSON.parse(fileContent);
    } catch (e) {
      return { error: "Invalid JSON file" };
    }

    // Validate puzzle structure - basic fields
    if (
      !puzzleData.author ||
      !puzzleData.title ||
      !puzzleData.size ||
      !puzzleData.clues ||
      !puzzleData.grid
    ) {
      return {
        error:
          "Invalid puzzle structure. Must include author, title, size, clues, and grid",
      };
    }

    // Validate size object
    if (
      typeof puzzleData.size !== "object" ||
      typeof puzzleData.size.rows !== "number" ||
      typeof puzzleData.size.cols !== "number" ||
      puzzleData.size.rows < 1 ||
      puzzleData.size.cols < 1 ||
      puzzleData.size.rows > 50 ||
      puzzleData.size.cols > 50
    ) {
      return {
        error: "Invalid size. Must have rows and cols (1-50)",
      };
    }

    // Validate clues object
    if (
      typeof puzzleData.clues !== "object" ||
      !Array.isArray(puzzleData.clues.across) ||
      !Array.isArray(puzzleData.clues.down)
    ) {
      return {
        error: "Invalid clues. Must have across and down arrays",
      };
    }

    // Validate clue format (should be "number. text")
    const cluePattern = /^\d+\.\s*.+/;
    const invalidAcrossClues = puzzleData.clues.across.filter(
      (clue: any) => typeof clue !== "string" || !cluePattern.test(clue)
    );
    const invalidDownClues = puzzleData.clues.down.filter(
      (clue: any) => typeof clue !== "string" || !cluePattern.test(clue)
    );

    if (invalidAcrossClues.length > 0 || invalidDownClues.length > 0) {
      return {
        error:
          'Invalid clue format. Each clue must be a string like "1. Clue text"',
      };
    }

    // Validate grid array
    if (!Array.isArray(puzzleData.grid)) {
      return {
        error: "Invalid grid. Must be an array of strings",
      };
    }

    const expectedLength = puzzleData.size.rows * puzzleData.size.cols;
    if (puzzleData.grid.length !== expectedLength) {
      return {
        error: `Grid must have ${expectedLength} elements (rows × cols), but has ${puzzleData.grid.length}`,
      };
    }

    // Validate each character in grid
    for (let i = 0; i < puzzleData.grid.length; i++) {
      const cell = puzzleData.grid[i];
      if (typeof cell !== "string") {
        return {
          error: `Grid element ${i + 1} must be a string`,
        };
      }

      if (cell.length !== 1) {
        return {
          error: `Grid element ${i + 1} must be a single character, but has ${cell.length} characters`,
        };
      }

      // Validate character (should be a letter or dot for black squares)
      const validChar = /^[A-Za-z.]$/;
      if (!validChar.test(cell)) {
        return {
          error: `Grid element ${i + 1} ("${cell}") is invalid. Only letters and dots (.) are allowed`,
        };
      }
    }

    // Validate that there's at least one non-black square
    const hasLetters = puzzleData.grid.some((cell: string) =>
      /[A-Za-z]/.test(cell)
    );
    if (!hasLetters) {
      return {
        error: "Grid must contain at least one letter (non-black square)",
      };
    }

    // Upload to S3
    const s3 = new S3Client({});
    const key = `${date}.json`;

    const command = new PutObjectCommand({
      Bucket: Resource.XWordBucket.name,
      Key: key,
      Body: fileContent,
      ContentType: "application/json",
    });

    await s3.send(command);

    return redirect("/");
  } catch (error) {
    console.error("Failed to upload puzzle:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to upload puzzle",
    };
  }
}

export default function Upload({ actionData }: Route.ComponentProps) {
  // Get today's date in UTC and format as YYYY-MM-DD
  const getTodayUTC = () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(getTodayUTC());
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="upload-container">
      <div className="upload-card">
        <h1>Upload Puzzle</h1>
        <p className="upload-description">
          Upload a new crossword puzzle to the collection. The file should be in
          JSON format with the puzzle data.
        </p>

        {actionData?.error && (
          <div className="error-message">{actionData.error}</div>
        )}

        <form
          method="post"
          encType="multipart/form-data"
          className="upload-form"
        >
          <div className="form-group">
            <label htmlFor="date">
              Puzzle Date <span className="required">*</span>
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="file">
              Puzzle File <span className="required">*</span>
            </label>
            <input
              type="file"
              id="file"
              name="file"
              accept=".json,application/json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              className="form-input"
            />
            <small className="form-hint">Must be a JSON file</small>
            {file && (
              <div className="file-info">
                Selected: {file.name} ({Math.round(file.size / 1024)} KB)
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Upload Puzzle
            </button>
            <a href="/" className="btn-secondary">
              Cancel
            </a>
          </div>
        </form>

        <div className="upload-help">
          <h2>Puzzle Format</h2>
          <p>The JSON file should have the following structure:</p>
          <pre className="code-block">
            {`{
  "author": "Author Name",
  "title": "Puzzle Title",
  "size": {
    "rows": 15,
    "cols": 15
  },
  "clues": {
    "across": ["1. Clue text", "5. Clue text", ...],
    "down": ["1. Clue text", "2. Clue text", ...]
  },
  "grid": ["C", "A", "T", ".", "D", "O", "G", ...]
}`}
          </pre>
          <p className="upload-note">
            <strong>Note:</strong> The grid is a flat array of single characters
            (letters or dots for black squares) with length = rows × cols.
          </p>
        </div>
      </div>
    </div>
  );
}
