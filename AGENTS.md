# Alcohol Label Verification App — Agent Customization

AI agents working in this codebase should understand the project purpose, architecture, and critical conventions before implementation.

## Quick Start for Agents

### Build & Dev Commands
```bash
# Install everything
npm run install-all

# Concurrent dev: backend (port 5000) + frontend (port 3000)
npm run dev

# Individual services
npm run backend:dev           # ts-node with hot reload
npm run frontend:dev          # React dev server
npm run backend:build         # TypeScript → dist/
npm run frontend:build        # React → build/

# Testing & Linting
npm run backend:test          # Jest
npm run backend:lint          # ESLint
npm run docker:build && npm run docker:up   # Docker dev

# Health check (for debugging)
curl http://localhost:5000/health
```

**Critical Path**: Backend runs on `5000`, frontend on `3000` locally; frontend depends on backend healthcheck in Docker.

---

## Project Context

**What it does**: AI-powered label verification system for the TTB (Alcohol and Tobacco Tax and Trade Bureau). Agents verify alcohol beverage labels against application data using Azure Computer Vision OCR and fuzzy matching.

**Why it matters**: TTB reviews ~150,000 label applications/year with 47 agents. The system targets a 5-second response time per label (previous scanning vendor failed at 30–40 seconds).

**Deployment target**: Azure App Service (FedRAMP compliance path; not yet implemented for prototype).

**Scope**: Standalone proof-of-concept; **NOT integrated with the legacy COLA system** (.NET) — no auth/RBAC required.

---

## Architecture Overview

### Monorepo Structure
```
backend/              Node.js + Express + TypeScript
  src/
    index.ts          Express server, middleware (CORS, multer, error handler)
    routes/           API endpoints (/verify-label, /verify-batch, /verify-json)
    services/         OCRService, LabelVerificationService (core logic)
    types/            Shared TypeScript interfaces
  package.json, tsconfig.json, jest.config.json, .eslintrc.json

frontend/             React 18 + TypeScript
  src/
    pages/            HomePage, BatchUploadPage, ResultsPage
    services/api.ts   Centralized API client (fetch-based)
    types/            Mirrored backend types
  nginx.conf          Reverse proxy config for Docker
  package.json, tsconfig.json, .eslintrc.json

docker-compose.yml    Local dev: backend + frontend with health checks
.env.example          Template for AZURE_VISION_KEY, AZURE_VISION_ENDPOINT
QUICKSTART.md         5-minute setup guide
README_SETUP.md       Full deployment & troubleshooting
IMPLEMENTATION.md     Architecture decisions & future enhancements
```

### Data Flow
1. **Frontend**: User uploads image + application data (form or JSON)
2. **Backend OCR**: Azure Computer Vision API v3.2 extracts text from image
3. **Verification**: `LabelVerificationService` compares extracted fields vs. application data
4. **Response**: `VerificationResult` with field verdicts + confidence scores

---

## Core Verification Algorithm

### Critical: This is NON-NEGOTIABLE per Stakeholder Feedback

**Three-tier matching strategy**:

| Tier | Rule | Applies To |
|------|------|-----------|
| **Exact Match** | `expected === extracted` → 100% confidence ✓ | All fields |
| **Fuzzy Match** | Levenshtein distance ≥85% confidence (case-insensitive, punctuation stripped) | Brand Name, ABV, Class, Contents, Bottler, Country |
| **Government Warning** | ⚠️ **STRICT**: Must contain "GOVERNMENT WARNING" (uppercase) + required phrases; **NO fuzzy matching** | Government Warning only |

**Overall Match Logic**:
- **All three critical fields must match** for `overallMatch: true`:
  - Brand Name
  - Alcohol Content (ABV)
  - Government Warning Statement
- Optional fields (bottler, address, country) skip verification if not in application data

**Implementation Location**: `backend/src/services/labelVerificationService.ts`
- `parseExtractedText()` — Extract fields from raw OCR
- `verifyData()` — Compare extracted vs. application data
- `calculateSimilarity()` — Levenshtein distance (85% threshold)
- `verifyGovernmentWarning()` — Strict validation (exception to fuzzy match rule)

---

## Key Conventions

### Naming
- **Services**: `XxxService` class pattern (e.g., `OCRService`, `LabelVerificationService`)
- **API Routes**: kebab-case (e.g., `/verify-label`, `/verify-batch`)
- **Types**: PascalCase interfaces in `types/index.ts`

### Code Patterns
- **Async/Await + Try-Catch**: Standard error handling in both backend and frontend
- **Dependency Injection**: Services instantiated once at module load with env vars (no DI container)
- **No ORM**: Stateless; no database. Files uploaded to memory; no persistence layer.
- **Frontend State**: React hooks only (useState); no Redux/Context API

### Error Handling
- **Backend**: Multer errors → 400 JSON; uncaught errors → 500 JSON (global error middleware)
- **Frontend**: API errors thrown; components responsible for UI feedback
- **Logging**: Console.error/log only; no centralized error tracking

---

## Critical Constraints & Pitfalls

### ⚠️ Performance (Hard Requirement)
- **5-second response target per label** — Previous vendor pilot failed at 30–40 sec (users rejected it)
- Batch operations (200–300 labels) currently **incomplete** in backend
- No pagination/streaming implemented; consider for future scale

### ⚠️ Compliance & Security
- **FedRAMP path exists but NOT implemented** — No PII encryption, audit logging, or document retention policy yet
- **Integration with COLA system OUT OF SCOPE** — Prototype is standalone; no OAuth/RBAC required
- **Network firewalls block outbound traffic** — Verify Azure Vision endpoint is whitelisted before production deployment

### ⚠️ User Experience (Stakeholder Requirement)
- **Diverse tech literacy**: Users range from age 50+ (Dave: "prints emails") to junior staff (Jenny: "fresh from college")
- **Simple UI is non-negotiable** — Any complexity in navigation = rejected by users
- Batch upload is a high-priority feature request (currently stubbed in frontend)

### ⚠️ OCR & Image Quality
- **Azure Vision handles poor image quality** (low light, skew, glare) — Good news!
- **Government Warning field is strictest check** — No tolerance for typos, wrong case, or punctuation variations
- Other fields have 85%+ fuzzy match tolerance — e.g., "STONE'S THROW" vs "Stone's Throw" is OK

### ⚠️ Environment Setup
- **Azure credentials required**: `AZURE_VISION_KEY`, `AZURE_VISION_ENDPOINT` (see [QUICKSTART.md](QUICKSTART.md) for CLI setup)
- **Docker-compose depends on backend healthcheck** — Slow startup possible; health check tolerance = 30 sec (3 retries × 10 sec timeout)
- **No database persistence** — Results lost on server restart; batch jobs are in-memory only

### ⚠️ Testing & Incomplete Features
- **Jest + ts-jest configured but no test files yet** — Coverage baseline is TBD
- **Batch verification endpoint stubbed** — Frontend UI ready, backend `verify-batch` route exists but uses empty application data

---

## File Navigation

| File | Purpose |
|------|---------|
| [QUICKSTART.md](QUICKSTART.md) | 5-minute setup with Azure CLI commands |
| [README_SETUP.md](README_SETUP.md) | Full deployment guide, troubleshooting, API details |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Architecture decisions, tech stack rationale, future enhancements |
| `backend/src/services/labelVerificationService.ts` | Verification algorithm; **modify for matching rules** |
| `backend/src/services/ocrService.ts` | Azure Computer Vision integration; **modify for image handling** |
| `backend/.env.example` | Azure credentials template |
| `docker-compose.yml` | Local dev environment; health check config |

---

## Common Tasks for Agents

### Add a Feature
1. **Backend**: Add route in `backend/src/routes/verification.ts`
2. **Services**: Extend `labelVerificationService.ts` if verification logic changes
3. **Frontend**: Add page in `frontend/src/pages/`, wire to router in `App.tsx`
4. **Types**: Update `src/types/index.ts` (both backend and frontend)
5. **Test**: Add Jest tests in `backend/__tests__/` or `frontend/src/__tests__/`

### Debug Verification Issues
1. Check field extraction: `ocrService.extractTextFromResults()` (line traces in console)
2. Check matching logic: `labelVerificationService.verifyField()` — inspect similarity scores
3. Verify government warning special case: `verifyGovernmentWarning()` at line ~180
4. Test locally: `npm run backend:dev` + upload test label via http://localhost:3000

### Deploy to Azure
- See [README_SETUP.md](README_SETUP.md#deployment) for App Service setup
- Use `azure-pipelines.yml` for CI/CD (provided; not yet wired to CI provider)
- Ensure Azure Container Registry credentials are configured before pushing

### Improve Performance
- **OCR**: Parallelize image preprocessing before Azure Vision call (pre-scale, enhance contrast)
- **Batch**: Implement worker pool or async job queue for 200+ labels
- **Frontend**: Add request debouncing/caching for repeated verification attempts

---

## Stakeholder Context (Why Decisions Were Made)

- **Node.js + Express**: Fast async I/O for 5-second target; minimal boilerplate
- **Azure Computer Vision**: FedRAMP-eligible; government infrastructure compatibility; proven OCR accuracy
- **React + TypeScript**: Component reuse; WCAG accessibility (important for users 50+); type safety
- **Fuzzy Matching for Brand Names**: Tolerates "STONE'S THROW" vs "Stone's Throw" — real-world data is messy
- **Strict Government Warning**: Per Jenny Park: "It has to be exact. Word-for-word. All caps. Bold."
- **No Database**: Prototype-level; persistence TBD for production (Azure Storage or Cosmos DB)

---

## Next Steps for Agents

1. **Implement batch verification** (`backend/src/routes/verification.ts` line ~150) — currently stubbed; needs async iteration
2. **Add integration tests** — Playwright for frontend, Jest for backend verification logic
3. **Improve image preprocessing** — Pre-scale, enhance contrast before OCR to reduce errors
4. **Add API rate limiting** — Prevent DOS; quota management for Azure Vision API
5. **Implement audit logging** — FedRAMP compliance requirement (doc retention policy TBD)

---

**Last Updated**: 2026-06-14  
**For questions**: Refer to [README_SETUP.md](README_SETUP.md) or check inline code comments in `backend/src/services/`.
