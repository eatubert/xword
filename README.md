# Crossword Puzzle Solver

A responsive, interactive crossword puzzle web application built with React Router 7 and deployed on AWS using SST (Serverless Stack).

## Features

### Core Functionality

- 📅 **Daily Puzzles** - Automatically loads puzzles from S3 based on current date
- ⏱️ **Timer with Pause** - Track solving time with pause/resume functionality
- ✅ **Auto-Validation** - Checks answers when puzzle is complete
- 🎯 **Smart Navigation** - Keyboard shortcuts and intelligent cell navigation
- 📱 **Responsive Design** - Optimized for both mobile and desktop

### User Experience

- **Keyboard Navigation**: Arrow keys, Space (toggle direction), Tab/Shift+Tab (clue navigation), Backspace (smart deletion)
- **Mobile Keyboard**: On-screen QWERTY keyboard for mobile devices
- **Auto-Skip**: Automatically skips filled cells and words
- **Cell Highlighting**: Visual feedback for selected cell and current word
- **Success View**: Clean grid display after puzzle completion
- **Dismissible Messages**: Press Escape or click × to close messages

## Getting Started

### Prerequisites

- Node.js 20+
- AWS Account with configured credentials
- AWS CLI configured with a profile

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Edit `.env` and set your domain:

```
DOMAIN=your-domain.com
```

### Development

#### Local Development (without AWS)

For quick local development using the fallback puzzle:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

#### Development with AWS/S3

To develop with actual S3 puzzle loading:

```bash
export AWS_PROFILE=your-aws-profile-name
npm run sstdev
```

This will create an S3 bucket for puzzle storage during development. You can upload puzzles there (see below).

If you don't upload a puzzle, you will see a "failed to load puzzle" error message in the console, and the puzzle will be loaded from `data/default.json`.

### Production Deployment

```bash
export AWS_PROFILE=your-profile-name
npm run sstprod
```

This will:

- Create an S3 bucket for puzzle storage
- Deploy a React application with server-side rendering
- Set up CloudFront distribution with your custom domain

## Puzzle Management

### Puzzle Format

Puzzles are stored as JSON files in S3. Each file should be named `YYYY-MM-DD.json` (e.g., `2026-01-03.json`).

Example puzzle structure:

```json
{
  "title": "Daily Crossword",
  "author": "Your Name",
  "size": { "rows": 15, "cols": 15 },
  "grid": ["A", "B", "C", ".", ...],
  "clues": {
    "across": [
      "1. Clue text",
      "5. Another clue"
    ],
    "down": [
      "1. Down clue",
      "2. Another down clue"
    ]
  }
}
```

### Adding Daily Puzzles

After deployment, find your bucket name:

```bash
# After running sstdev or sstprod, check the output for the bucket name
# Or check the .sst directory for resource information
```

Upload puzzles to your S3 bucket:

```bash
aws s3 cp 2026-01-03.json s3://your-bucket-name/
```

The application will:

1. Try to load the puzzle for the current date (UTC)
2. Fall back to `data/default.json` if the date-specific puzzle doesn't exist
3. Cache the puzzle in memory until the date changes

## Project Structure

```
├── app/
│   ├── components/         # React components
│   │   ├── Crossword.tsx          # Main orchestrator
│   │   ├── CrosswordGrid.tsx      # Grid rendering
│   │   ├── CrosswordHeader.tsx    # Title, timer, pause
│   │   ├── ClueList.tsx           # Clue list display
│   │   ├── ClueLine.tsx           # Current clue display
│   │   └── MobileKeyboard.tsx     # On-screen keyboard
│   ├── routes/
│   │   └── home.tsx        # Main route with S3 loader
│   ├── styles/
│   │   └── crossword.css   # All crossword styling
│   ├── types/
│   │   └── crossword.ts    # TypeScript interfaces
│   └── utils/
│       └── crosswordHelpers.ts  # Helper functions
├── data/
│   └── default.json        # Fallback puzzle
├── sst.config.ts          # Infrastructure configuration
└── .env                   # Environment variables (not committed)
```

## Technology Stack

- **Framework**: React 19 with React Router 7
- **Styling**: Tailwind CSS 4
- **Infrastructure**: SST (Serverless Stack) on AWS
- **Storage**: AWS S3 for puzzle files
- **CDN**: CloudFront with custom domain
- **Language**: TypeScript with strict mode

## Configuration

### Environment Variables

- `DOMAIN` - Your custom domain (required for deployment)
- `AWS_PROFILE` - AWS credentials profile (required for deployment)

### SST Configuration

The `sst.config.ts` file defines:

- S3 bucket for puzzle storage
- React Router application with SSR
- Custom domain configuration
- Resource linking
- Stage-specific policies:
  - **Production**: Resources are retained on removal, stack is protected
  - **Other stages**: Resources are removed when stack is deleted

## Development Tips

### Adding New Features

The main component logic is in [`app/components/Crossword.tsx`](app/components/Crossword.tsx). It manages:

- Grid state and user input
- Cell selection and navigation
- Timer and pause functionality
- Puzzle validation and completion

### Styling

All crossword-specific styles are in [`app/styles/crossword.css`](app/styles/crossword.css) with responsive breakpoints at 768px.

### Testing Locally

Use the fallback puzzle in [`data/default.json`](data/default.json) for local development. The S3 loader will automatically fall back to this file if the daily puzzle isn't available.

## License

Built with ❤️ using React Router and SST.
