import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import { Crossword } from "../components/Crossword";
import "../styles/crossword.css";
import type { CrosswordData } from "../types/crossword";
import type { Route } from "./+types/home";

// Cache for puzzle data
let cachedPuzzle: CrosswordData | null = null;
let cachedDateKey: string | null = null;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Crossword Solver" },
    { name: "description", content: "Interactive crossword puzzle solver" },
  ];
}

export async function loader() {
  // Get current date in yyyy-mm-dd format (UTC)
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, "0");
  const day = String(today.getUTCDate()).padStart(2, "0");
  const dateKey = `${year}-${month}-${day}.json`;

  // Return cached puzzle if date hasn't changed
  if (cachedPuzzle && cachedDateKey === dateKey) {
    return { crosswordData: cachedPuzzle };
  }

  const s3 = new S3Client({});

  // Try to load today's puzzle
  try {
    const command = new GetObjectCommand({
      Bucket: Resource.XWordBucket.name,
      Key: dateKey,
    });

    const response = await s3.send(command);
    const data = await response.Body?.transformToString();

    if (!data) {
      throw new Error("No data received from S3");
    }

    const puzzleData = JSON.parse(data);
    
    // Update cache
    cachedPuzzle = puzzleData;
    cachedDateKey = dateKey;

    return { crosswordData: puzzleData };
  } catch (error) {
    console.error(`Failed to load puzzle for ${dateKey}:`, error);
    
    // Fallback to local data
    const localData = await import("../../data/default.json");
    
    // Update cache with local data
    cachedPuzzle = localData.default;
    cachedDateKey = dateKey;
    
    return { crosswordData: localData.default };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <Crossword data={loaderData.crosswordData} />;
}
