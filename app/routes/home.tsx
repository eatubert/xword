import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Resource } from "sst";
import { Crossword } from "../components/Crossword";
import "../styles/crossword.css";
import type { CrosswordData } from "../types/crossword";
import type { Route } from "./+types/home";

// Cache for puzzle data
let cachedPuzzle: CrosswordData | null = null;
let cachedPuzzleKey: string | null = null;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Crossword Solver" },
    { name: "description", content: "Interactive crossword puzzle solver" },
  ];
}

export async function loader() {
  const s3 = new S3Client({});

  // List all puzzle files and get the most recent one
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: Resource.XWordBucket.name,
    });

    const listResponse = await s3.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      throw new Error("No puzzles found in S3 bucket");
    }

    // Filter for files matching yyyy-mm-dd.json pattern and sort in reverse order
    const datePattern = /^\d{4}-\d{2}-\d{2}\.json$/;
    const sortedFiles = listResponse.Contents.filter(
      (item) => item.Key && datePattern.test(item.Key)
    ).sort((a, b) => (b.Key || "").localeCompare(a.Key || ""));

    if (sortedFiles.length === 0) {
      throw new Error("No JSON puzzle files found");
    }

    const latestKey = sortedFiles[0].Key!;

    // Return cached puzzle if key hasn't changed
    if (cachedPuzzle && cachedPuzzleKey === latestKey) {
      return { crosswordData: cachedPuzzle };
    }

    // Fetch the latest puzzle
    const getCommand = new GetObjectCommand({
      Bucket: Resource.XWordBucket.name,
      Key: latestKey,
    });

    const response = await s3.send(getCommand);
    const data = await response.Body?.transformToString();

    if (!data) {
      throw new Error("No data received from S3");
    }

    const puzzleData = JSON.parse(data);

    // Update cache
    cachedPuzzle = puzzleData;
    cachedPuzzleKey = latestKey;

    return { crosswordData: puzzleData };
  } catch (error) {
    console.error("Failed to load puzzle from S3:", error);

    // Fallback to local data
    const localData = await import("../../data/default.json");

    // Don't cache local data
    return { crosswordData: localData.default };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <Crossword data={loaderData.crosswordData} />;
}
