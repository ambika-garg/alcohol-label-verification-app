# Alcohol Label Verification App — Tools & Setup Documentation

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
  - [Core Languages & Runtime](#core-languages--runtime)
  - [Backend Tools & Libraries](#backend-tools--libraries)
  - [Frontend Tools & Libraries](#frontend-tools--libraries)
  - [AI / Machine Learning](#ai--machine-learning)
  - [DevOps & Deployment](#devops--deployment)
  - [Testing](#testing)
  - [Code Quality](#code-quality)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Environment Variables](#2-environment-variables)
  - [3. Install Dependencies](#3-install-dependencies)
  - [4. Run Locally (Development)](#4-run-locally-development)
  - [5. Run with Docker](#5-run-with-docker)
- [Build for Production](#build-for-production)
- [Running Tests](#running-tests)
- [Deployment](#deployment)
  - [Vercel (Serverless)](#vercel-serverless)
  - [Azure DevOps (CI/CD)](#azure-devops-cicd)
  - [Docker Compose (Self-Hosted)](#docker-compose-self-hosted)
- [API Endpoints](#api-endpoints)
- [Key Services & Modules](#key-services--modules)
- [Environment Variable Reference](#environment-variable-reference)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

The Alcohol Label Verification App is an AI-powered compliance verification system built for TTB (Alcohol and Tobacco Tax and Trade Bureau) label review workflows. It accepts images of alcohol beverage labels, extracts text using Google Gemini Vision, and verifies the extracted data against application data to determine regulatory compliance.

Key capabilities include single-label verification with image upload, batch verification via CSV + ZIP archives with real-time streaming progress, a three-tier match classification system (exact / probable / mismatch), dedicated government warning validation against the canonical TTB-mandated text (27 CFR § 16.21), and a reviewer override workflow for manual adjudication.

---

## Architecture

The application follows a decoupled frontend/backend architecture with two deployment modes.

**Traditional Mode** runs an Express.js backend server and a React SPA frontend served by Nginx, both orchestrated via Docker Compose. The frontend proxies API requests through Nginx to the backend on port 5000.

**Serverless Mode** deploys to Vercel, where the React SPA is statically built and served directly, while API routes are implemented as Vercel Serverless Functions under the `api/` directory. Shared business logic lives in the `lib/` directory and is consumed by both the serverless functions and the Express backend.

```
┌────────────────────┐         ┌─────────────────────────┐
│   React Frontend   │────────▶│   Backend API (Express) │
│   (Port 3000)      │         │   (Port 5000/5001)      │
└────────────────────┘         └────────┬────────────────┘
                                        │
                                        ▼
                               ┌────────────────────┐
                               │  Google Gemini API  │
                               │  (Vision + LLM)    │
                               └────────────────────┘
```

---

## Technology Stack

### Core Languages & Runtime

| Tool | Version | Purpose |
|------|---------|---------|
| **TypeScript** | ^5.3.3 | Primary language for both frontend and backend. Provides static typing across the entire codebase. |
| **Node.js** | 24.x (dev) / 18.x (Docker) | JavaScript runtime. The root `package.json` specifies Node 24.x for local development; Docker images use the `node:18-alpine` base. |

### Backend Tools & Libraries

| Tool | Version | Purpose |
|------|---------|---------|
| **Express.js** | ^4.18.2 | HTTP server framework. Handles REST API routing, middleware, and error handling. |
| **Multer** | ^1.4.5-lts.1 | Middleware for `multipart/form-data` parsing. Used for image file uploads (single and batch) with in-memory storage and MIME type filtering. |
| **Busboy** | ^1.6.0 | Low-level multipart parser used by the Vercel serverless functions (since Multer depends on Express, Busboy provides a framework-agnostic alternative). |
| **CORS** | ^2.8.5 | Express middleware enabling Cross-Origin Resource Sharing between the frontend (port 3000) and backend (port 5000). |
| **dotenv** | ^16.3.1 | Loads environment variables from `.env` files into `process.env`. The backend loads from both the root and `backend/` directories. |
| **adm-zip** | ^0.5.17 | Pure-JavaScript ZIP archive handling. Used to extract label images from uploaded ZIP files during batch verification. |
| **csv-parse** | ^7.0.0 | CSV parser for reading batch verification manifests. Uses the synchronous `csv-parse/sync` API to parse uploaded CSV files containing application data. |
| **ts-node** | ^10.9.2 | TypeScript execution engine for development. Allows running `.ts` files directly without a build step (`npm run dev`). |

### Frontend Tools & Libraries

| Tool | Version | Purpose |
|------|---------|---------|
| **React** | ^18.2.0 | UI component library. The frontend is a single-page application built with functional components and React Hooks. |
| **React DOM** | ^18.2.0 | React renderer for the browser DOM. |
| **React Router DOM** | ^6.20.0 | Client-side routing. Provides navigation between the Home page (`/`), Batch Upload page (`/batch`), and Results page (`/results/:batchId`). |
| **Axios** | ^1.6.2 | HTTP client (available in the dependency tree, though the actual API service uses the native `fetch` API with `FormData`). |
| **react-scripts** | 5.0.1 | Create React App toolchain. Provides Webpack bundling, Babel transpilation, dev server with hot reload, and production build optimization. |

### AI / Machine Learning

| Tool | Version | Purpose |
|------|---------|---------|
| **Google Generative AI SDK** (`@google/generative-ai`) | ^0.4.0 | Official Google SDK for accessing the Gemini API. Used for both OCR (vision-based text extraction from label images) and structured data extraction. |
| **Gemini 2.5 Flash** (default model) | — | The default LLM model configured via `GEMINI_MODEL`. Chosen for low latency and cost while supporting multimodal image inputs. The model receives label images as base64-encoded inline data and returns structured JSON with extracted label fields. |

### DevOps & Deployment

| Tool | Purpose |
|------|---------|
| **Docker** | Containerization. Multi-stage Dockerfiles for both frontend and backend produce lean Alpine-based production images. |
| **Docker Compose** | Multi-container orchestration. Defines `backend` and `frontend` services with health checks, volume mounts, and environment variable injection. |
| **Nginx** | Production web server for the frontend. Serves the static React build, proxies `/api/` requests to the backend, and adds security headers. |
| **Vercel** | Serverless deployment platform. The `vercel.json` config defines URL rewrites, function timeouts (up to 300s for batch CSV), and build commands. Serverless functions live in `api/` and share logic from `lib/`. |
| **Azure Pipelines** | CI/CD pipeline definition (`azure-pipelines.yml`). Builds both frontend and backend, then pushes Docker images to Azure Container Registry and deploys to Azure App Service. |

### Testing

| Tool | Version | Purpose |
|------|---------|---------|
| **Jest** | ^29.7.0 | Test runner and assertion library for the backend. Configured with `ts-jest` for native TypeScript support. |
| **ts-jest** | ^29.1.1 | TypeScript preprocessor for Jest. Allows writing tests in `.ts` without a separate compile step. |

The test suite includes unit tests for the `GovernmentWarningValidator` (presence, format, and text accuracy checks), integration tests for the `LabelVerificationService` (end-to-end field verification), and three-tier matching logic tests (exact, probable, and mismatch classification).

### Code Quality

| Tool | Version | Purpose |
|------|---------|---------|
| **ESLint** | ^8.55.0 | JavaScript/TypeScript linter. Separate configs exist for backend (`.eslintrc.json`) and frontend. |
| **@typescript-eslint** | ^6.13.2 | ESLint plugin and parser for TypeScript-specific linting rules. |

---

## Project Structure

```
alcohol-label-verification-app/
├── api/                          # Vercel serverless functions
│   ├── health.ts                 # Health check endpoint
│   ├── verify-label.ts           # Single label verification
│   ├── verify-json.ts            # JSON payload verification
│   ├── verify-batch.ts           # Batch image verification
│   └── verify-batch-csv.ts       # CSV + ZIP batch (SSE streaming)
├── lib/                          # Shared business logic (used by api/ and backend/)
│   ├── types.ts                  # Shared TypeScript interfaces
│   ├── ocrService.ts             # Gemini Vision OCR wrapper
│   ├── labelVerificationService.ts  # Field matching & verification
│   └── governmentWarningValidator.ts # TTB warning compliance checks
├── backend/                      # Express.js backend (traditional deployment)
│   ├── src/
│   │   ├── index.ts              # Express app entry point
│   │   ├── types/index.ts        # Backend-specific types
│   │   ├── routes/verification.ts # API route handlers
│   │   ├── services/             # Business logic services
│   │   │   ├── ocrService.ts
│   │   │   ├── labelVerificationService.ts
│   │   │   └── governmentWarningValidator.ts
│   │   └── __tests__/            # Jest unit & integration tests
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.json
├── frontend/                     # React SPA
│   ├── src/
│   │   ├── App.tsx               # Root component with routing
│   │   ├── index.tsx             # React DOM render entry
│   │   ├── types/index.ts        # Frontend TypeScript interfaces
│   │   ├── services/api.ts       # API client (fetch + FormData)
│   │   ├── pages/
│   │   │   ├── HomePage.tsx      # Single label upload & verification
│   │   │   ├── BatchUploadPage.tsx # CSV + ZIP batch upload
│   │   │   └── ResultsPage.tsx   # Verification results display
│   │   └── styles/               # Component-level CSS files
│   ├── public/index.html
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml            # Multi-container orchestration
├── azure-pipelines.yml           # Azure DevOps CI/CD config
├── vercel.json                   # Vercel deployment config
├── tsconfig.api.json             # TypeScript config for api/ + lib/
├── package.json                  # Root monorepo package.json
├── .env.example                  # Environment variable template
└── .gitignore
```

---

## Prerequisites

Before setting up the project, ensure you have the following installed:

| Requirement | Minimum Version | How to Verify |
|-------------|----------------|---------------|
| Node.js | 18.x+ | `node --version` |
| npm | 9.x+ | `npm --version` |
| Docker *(optional, for containerized deployment)* | 20.x+ | `docker --version` |
| Docker Compose *(optional)* | 2.x+ | `docker compose version` |
| Google Gemini API Key | — | Obtain from [Google AI Studio](https://aistudio.google.com/apikey) |

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd alcohol-label-verification-app
```

### 2. Environment Variables

Create the following `.env` files using `.env.example` as a reference.

**Root `.env`** (used by Vercel serverless functions):

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

**`backend/.env`** (used by the Express server):

```bash
PORT=5001
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
NODE_ENV=development
```

**`frontend/.env`** (used by the React dev server):

```bash
REACT_APP_API_URL=http://localhost:5001
```

To obtain a Gemini API key, go to [Google AI Studio](https://aistudio.google.com/apikey), sign in with a Google account, and generate a new API key. The free tier is sufficient for development.

### 3. Install Dependencies

**Option A — Install all at once (recommended):**

```bash
npm run install-all
```

This runs `npm install` in the root, `backend/`, and `frontend/` directories sequentially.

**Option B — Install individually:**

```bash
# Root dependencies (shared libs for Vercel serverless)
npm install

# Backend dependencies
cd backend && npm install && cd ..

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 4. Run Locally (Development)

**Option A — Run both simultaneously:**

```bash
npm run dev
```

This uses `concurrently` to start the backend (ts-node) and frontend (react-scripts) in parallel.

**Option B — Run separately (in two terminal windows):**

```bash
# Terminal 1: Backend
npm run backend:dev
# → Express server starts on http://localhost:5001

# Terminal 2: Frontend
npm run frontend:dev
# → React dev server starts on http://localhost:3000
```

Once both are running, open `http://localhost:3000` in your browser. The frontend will proxy API requests to the backend at the URL specified in `REACT_APP_API_URL`.

### 5. Run with Docker

```bash
# Build images
npm run docker:build
# or: docker-compose build

# Start services
npm run docker:up
# or: docker-compose up

# Stop services
npm run docker:down
# or: docker-compose down
```

Docker Compose will start the backend on port 5000 and the frontend (via Nginx) on port 3000. The frontend container depends on the backend passing its health check before starting.

**Note:** When using Docker, set `AZURE_VISION_KEY` and `AZURE_VISION_ENDPOINT` in your shell environment or a root `.env` file — Docker Compose reads them via variable interpolation in `docker-compose.yml`. For Gemini-based OCR, update the `docker-compose.yml` environment section to include `GEMINI_API_KEY` instead.

---

## Build for Production

```bash
# Build the backend (TypeScript → JavaScript in backend/dist/)
npm run backend:build

# Build the frontend (React → optimized static files in frontend/build/)
npm run frontend:build
```

To run the production backend:

```bash
cd backend
npm start
# → Runs node dist/index.js
```

The production frontend is a set of static files in `frontend/build/` that can be served by any web server (Nginx, Apache, Vercel, S3 + CloudFront, etc.).

---

## Running Tests

```bash
# Run all backend tests
npm run backend:test

# Or directly from the backend directory
cd backend && npm test
```

Jest is configured with `ts-jest` so tests are written in TypeScript. The test suite covers the government warning validator (presence detection, format attribute checking, word-level text accuracy with a 95% threshold), the label verification service (JSON and plaintext OCR response parsing, field comparison logic), and the three-tier matching system (exact, probable, and mismatch classification with confidence scoring).

---

## Deployment

### Vercel (Serverless)

The project is pre-configured for Vercel deployment. The `vercel.json` file defines URL rewrites that map Express-style routes to serverless functions, function-level timeout configuration (60s for single verification, 300s for batch CSV), and the build command that produces the static frontend.

To deploy:

1. Install the Vercel CLI: `npm i -g vercel`
2. Set environment variables in the Vercel dashboard: `GEMINI_API_KEY` and optionally `GEMINI_MODEL`
3. Deploy: `vercel --prod`

The serverless functions in `api/` use Busboy instead of Multer for multipart parsing, and share the core business logic from `lib/`.

### Azure DevOps (CI/CD)

The `azure-pipelines.yml` defines a two-stage pipeline. The Build stage installs Node.js 18.x, builds both frontend and backend, runs linting, and pushes a Docker image to Azure Container Registry. The Deploy stage deploys the image to Azure App Service.

To use it, replace the placeholder values in the YAML (`your-acr-connection`, `your-registry.azurecr.io`, `your-subscription`, `your-app-name`) with your actual Azure resource identifiers, then connect the pipeline to your repository in Azure DevOps.

### Docker Compose (Self-Hosted)

For self-hosted or on-premises deployment, `docker-compose up -d` launches both services in detached mode. The backend container includes a health check that polls `/health` every 30 seconds. The frontend Nginx container only starts once the backend is healthy.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check. Returns OCR configuration status and the active Gemini model name. |
| `POST` | `/api/verification/verify-label` | Verify a single label. Accepts `multipart/form-data` with an `image` file and `applicationData` JSON string. |
| `POST` | `/api/verification/verify-json` | Verify a single label via JSON body. Accepts `imageBase64` (base64-encoded image), `filename`, and `applicationData`. |
| `POST` | `/api/verification/verify-batch` | Verify multiple label images. Accepts `multipart/form-data` with multiple `images` files. |
| `POST` | `/api/verification/verify-batch-csv` | Batch verification with CSV manifest + ZIP of images. Streams results via Server-Sent Events (SSE). |

---

## Key Services & Modules

**OCRService** (`ocrService.ts`) — Wraps the Google Gemini Vision API. Converts image buffers to base64, detects MIME types from magic bytes, sends a structured extraction prompt to Gemini, and returns parsed JSON with eight TTB-relevant label fields (brand name, class/type, alcohol content, net contents, bottler name, bottler address, country of origin, government warning).

**LabelVerificationService** (`labelVerificationService.ts`) — The core comparison engine. Parses Gemini's JSON or plaintext response into a `LabelData` object, then compares each extracted field against the expected application data. Uses normalized string comparison with a three-tier confidence classification: "exact" for high-confidence matches, "probable" for partial or fuzzy matches, and "mismatch" for clear discrepancies.

**GovernmentWarningValidator** (`governmentWarningValidator.ts`) — Performs three independent compliance checks against the canonical TTB-mandated warning text (27 CFR § 16.21): presence verification (the "GOVERNMENT WARNING:" header must appear verbatim), format validation (bold header and adequate font size from vision model attributes), and text accuracy (word-level normalized comparison requiring ≥95% similarity to pass).

---

## Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key for OCR and text extraction. |
| `GOOGLE_API_KEY` | No | — | Alternate key name (fallback if `GEMINI_API_KEY` is not set). |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model to use. Can be changed to other Gemini models. |
| `PORT` | No | `5000` | Port for the Express backend server. |
| `NODE_ENV` | No | `development` | Node environment (`development` or `production`). |
| `REACT_APP_API_URL` | No | `""` (empty) | Backend API base URL for the frontend. Set to `http://localhost:5001` for local development. When empty, the frontend makes requests relative to its own origin (suitable for Vercel where API routes are co-located). |

---

## Troubleshooting

**"GEMINI_API_KEY environment variable is not set"** — Ensure you have created the appropriate `.env` files as described in the setup instructions. The backend loads from both the root `.env` and `backend/.env`. Restart the server after creating or modifying `.env` files.

**Frontend cannot reach the backend** — Verify that `REACT_APP_API_URL` in `frontend/.env` matches the backend's actual address and port. Environment variable changes in the React app require a full restart of `react-scripts` (they are baked in at build time, not read at runtime).

**CORS errors in the browser** — The backend enables CORS globally via the `cors()` middleware. If you see CORS errors, confirm the backend is running and accessible at the URL the frontend is targeting.

**Docker health check failing** — The backend health check calls `http://localhost:5000/health`. Ensure the `PORT` environment variable inside the Docker container matches port 5000, or update the health check command accordingly.

**Batch CSV upload timing out** — The Vercel config sets a 300-second (5-minute) timeout for the `verify-batch-csv` function. For very large batches, consider splitting the CSV and ZIP into smaller chunks.

**Gemini returns empty or malformed responses** — Check your API key quota at [Google AI Studio](https://aistudio.google.com/). The model may return empty results for very low-quality or non-label images. The OCR service will throw a descriptive error in these cases.