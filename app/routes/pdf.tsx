import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { jsPDF } from "jspdf";
import { useState } from "react";
import { Resource } from "sst";
import "../styles/upload.css";
import type { CrosswordData } from "../types/crossword";
import {
  buildClueMapAndNumberGrid,
  convertFlatGridTo2D,
  parseClue,
} from "../utils/crosswordHelpers";
import type { Route } from "./+types/pdf";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Generate PDF - Crossword" },
    { name: "description", content: "Generate a PDF of the crossword puzzle" },
  ];
}

export async function loader() {
  const s3 = new S3Client({});

  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: Resource.XWordBucket.name,
    });

    const listResponse = await s3.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      throw new Error("No puzzles found in S3 bucket");
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}\.json$/;
    const sortedFiles = listResponse.Contents.filter(
      (item) => item.Key && datePattern.test(item.Key),
    ).sort((a, b) => (b.Key || "").localeCompare(a.Key || ""));

    if (sortedFiles.length === 0) {
      throw new Error("No JSON puzzle files found");
    }

    const latestKey = sortedFiles[0].Key!;

    const getCommand = new GetObjectCommand({
      Bucket: Resource.XWordBucket.name,
      Key: latestKey,
    });

    const response = await s3.send(getCommand);

    if (!response.Body) {
      throw new Error("Empty response from S3");
    }

    const bodyString = await response.Body.transformToString();
    const puzzleData: CrosswordData = JSON.parse(bodyString);

    return { puzzle: puzzleData };
  } catch (error) {
    console.error("Error loading puzzle:", error);
    throw error;
  }
}

export default function PDF({ loaderData }: Route.ComponentProps) {
  const { puzzle } = loaderData;
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = () => {
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Page 1: Grid with answers
      // User info in top-left corner
      doc.setFontSize(10);
      const addressLines = address.split("\n");
      doc.text(name, 15, 15);
      let yPos = 20;
      addressLines.forEach((line) => {
        doc.text(line.trim(), 15, yPos);
        yPos += 5;
      });
      doc.text(email, 15, yPos);

      // Draw the grid - centered and larger
      const grid2D = convertFlatGridTo2D(
        puzzle.grid,
        puzzle.size.rows,
        puzzle.size.cols,
      );
      const { numberGrid } = buildClueMapAndNumberGrid(
        grid2D,
        puzzle.size,
        puzzle.clues,
      );

      // Calculate larger cell size for better visibility
      const maxGridWidth = pageWidth - 60; // More margin
      const maxGridHeight = pageHeight - 100; // Leave space for info at top
      const cellSize = Math.min(
        maxGridWidth / puzzle.size.cols,
        maxGridHeight / puzzle.size.rows,
      );
      const gridStartX = (pageWidth - cellSize * puzzle.size.cols) / 2;
      const gridStartY = 80; // Start lower to accommodate user info

      doc.setLineWidth(0.5);

      for (let row = 0; row < puzzle.size.rows; row++) {
        for (let col = 0; col < puzzle.size.cols; col++) {
          const x = gridStartX + col * cellSize;
          const y = gridStartY + row * cellSize;

          if (grid2D[row][col] === ".") {
            // Black square
            doc.setFillColor(0, 0, 0);
            doc.rect(x, y, cellSize, cellSize, "F");
          } else {
            // White square with letter
            doc.rect(x, y, cellSize, cellSize);

            // Draw number if present (in top-left corner, no padding)
            if (numberGrid[row][col] !== null) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(9);
              doc.text(String(numberGrid[row][col]), x + 0.5, y + 2.9);
            }

            // Draw answer letter (centered in cell) - larger and bold
            const letterSize = Math.max(14, Math.min(18, cellSize * 0.7));
            doc.setFont("helvetica", "bold");
            doc.setFontSize(letterSize);
            doc.text(
              grid2D[row][col],
              x + cellSize / 2,
              y + cellSize / 2 + letterSize / 3.5,
              { align: "center" },
            );
          }
        }
      }

      // Get all clues with their answers
      const acrossClues = puzzle.clues.across
        .map((clueText) => {
          const parsed = parseClue(clueText);
          if (!parsed) return null;

          // Find answer from grid
          let answer = "";
          for (let row = 0; row < puzzle.size.rows; row++) {
            for (let col = 0; col < puzzle.size.cols; col++) {
              if (numberGrid[row][col] === parsed.number) {
                // Check if this is an across clue
                if (col === 0 || grid2D[row][col - 1] === ".") {
                  // Get the word
                  for (
                    let c = col;
                    c < puzzle.size.cols && grid2D[row][c] !== ".";
                    c++
                  ) {
                    answer += grid2D[row][c];
                  }
                  if (answer.length > 1) break;
                  answer = "";
                }
              }
            }
            if (answer) break;
          }

          return {
            number: parsed.number,
            clue: parsed.text,
            answer: answer,
          };
        })
        .filter(Boolean);

      const downClues = puzzle.clues.down
        .map((clueText) => {
          const parsed = parseClue(clueText);
          if (!parsed) return null;

          // Find answer from grid
          let answer = "";
          for (let row = 0; row < puzzle.size.rows; row++) {
            for (let col = 0; col < puzzle.size.cols; col++) {
              if (numberGrid[row][col] === parsed.number) {
                // Check if this is a down clue
                if (row === 0 || grid2D[row - 1][col] === ".") {
                  // Get the word
                  for (
                    let r = row;
                    r < puzzle.size.rows && grid2D[r][col] !== ".";
                    r++
                  ) {
                    answer += grid2D[r][col];
                  }
                  if (answer.length > 1) break;
                  answer = "";
                }
              }
            }
            if (answer) break;
          }

          return {
            number: parsed.number,
            clue: parsed.text,
            answer: answer,
          };
        })
        .filter(Boolean);

      // Page 2+: Clues and Answers
      doc.addPage();
      let currentY = 30;
      const margin = 20;
      const rightMargin = 20;
      const answerColumnX = pageWidth - rightMargin - 40; // Position for answers

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("ACROSS", margin, currentY);
      doc.setFont("helvetica", "normal");
      currentY += 10;

      doc.setFontSize(10);
      for (const clue of acrossClues) {
        if (!clue) continue;

        // Check if we need a new page
        if (currentY > pageHeight - 25) {
          doc.addPage();
          currentY = 30;
        }

        // Format: "1 Pipe with a tube" on left, "HOOKAH" on right
        const clueText = `${clue.number} ${clue.clue}`;
        const maxClueWidth = answerColumnX - margin - 10;
        const clueLines = doc.splitTextToSize(clueText, maxClueWidth);

        // Draw clue text
        doc.text(clueLines, margin, currentY);

        // Draw answer aligned to the right
        doc.text(clue.answer, pageWidth - rightMargin, currentY, {
          align: "right",
        });

        // Double-spaced: move down by line height * number of lines * 2
        currentY += clueLines.length * 10; // ~10pt per line for double spacing
      }

      // Add space before DOWN section
      currentY += 8;

      // Check if we need a new page for DOWN section
      if (currentY > pageHeight - 40) {
        doc.addPage();
        currentY = 30;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DOWN", margin, currentY);
      doc.setFont("helvetica", "normal");
      currentY += 10;

      doc.setFontSize(10);
      for (const clue of downClues) {
        if (!clue) continue;

        // Check if we need a new page
        if (currentY > pageHeight - 25) {
          doc.addPage();
          currentY = 30;
        }

        // Format: "1 Relative of JavaScript" on left, "HTML" on right
        const clueText = `${clue.number} ${clue.clue}`;
        const maxClueWidth = answerColumnX - margin - 10;
        const clueLines = doc.splitTextToSize(clueText, maxClueWidth);

        // Draw clue text
        doc.text(clueLines, margin, currentY);

        // Draw answer aligned to the right
        doc.text(clue.answer, pageWidth - rightMargin, currentY, {
          align: "right",
        });

        // Double-spaced: move down by line height * number of lines * 2
        currentY += clueLines.length * 10;
      }

      // Save the PDF
      doc.save("crossword-puzzle.pdf");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address || !email) {
      alert("Please fill in all fields");
      return;
    }
    generatePDF();
  };

  return (
    <div className="upload-container">
      <div className="upload-card">
        <h1 className="upload-title">Generate PDF</h1>
        <p className="upload-description">
          Enter your information to generate a PDF of the crossword puzzle with
          answers.
        </p>

        <form onSubmit={handleSubmit} className="upload-form">
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">Address</label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your address"
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <button
            type="submit"
            className="upload-button"
            disabled={isGenerating}
          >
            {isGenerating ? "Generating PDF..." : "Generate PDF"}
          </button>
        </form>
      </div>
    </div>
  );
}
