# Implementation Notes & Architecture

## Overview

This document outlines the technical implementation decisions, architecture patterns, and key design choices for the Alcohol Label Verification System.

## Technology Choices

### Why Node.js + Express for Backend?

1. **Performance**: Handles 5-second requirement with async I/O
2. **Rapid Development**: Minimal boilerplate, quick iteration
3. **Azure Integration**: Excellent Azure SDK support
4. **Scalability**: Event-driven architecture scales well
5. **Developer Experience**: Large ecosystem, good tooling

### Why React for Frontend?

1. **Component Reusability**: DRY principle for UI
2. **User Experience**: Responsive, smooth interactions
3. **Accessibility**: Good WCAG support out of the box
4. **Type Safety**: TypeScript prevents runtime errors
5. **Performance**: Virtual DOM optimizes rendering

### Why Azure Computer Vision?

1. **Government Ready**: FedRAMP compliance path
2. **Accuracy**: High success rate on document OCR
3. **Integration**: Seamless with Azure infrastructure
4. **API Stability**: Proven, reliable service
5. **Firewall Friendly**: Works behind government proxies

## Architecture Patterns

### Backend Architecture

```
Express Server
    ├── Routes (Verification endpoints)
    ├── Services
    │   ├── OCRService (Azure integration)
    │   └── LabelVerificationService (Matching logic)
    └── Types (TypeScript interfaces)
```

**Key Patterns**:
- **Service Layer**: Business logic separated from HTTP
- **Dependency Injection**: Services instantiated with config
- **Error Handling**: Try-catch with meaningful messages
- **Async/Await**: Modern async operations

### Frontend Architecture

```
React App
    ├── Pages (Main components)
    ├── Services (API calls)
    ├── Types (Shared interfaces)
    └── Styles (Component CSS)
```

**Key Patterns**:
- **Component Composition**: Reusable page components
- **State Management**: React hooks (useState)
- **API Layer**: Centralized API service
- **Routing**: React Router for navigation

## Verification Algorithm

### Field Matching Strategy

1. **Exact Match** (100% confidence):
   ```
   if (expected === extracted) ✓
   ```

2. **Fuzzy Match** (85%+ confidence):
   ```
   - Normalize: lowercase, remove punctuation
   - Calculate: Levenshtein distance
   - Threshold: 85% similarity = match
   ```

3. **Government Warning** (Strict):
   ```
   - Must contain "GOVERNMENT WARNING" (uppercase)
   - Must contain key phrases (alcoholic, etc.)
   - Exact verification only
   ```

### Critical Fields

These fields MUST match for overall verification:
- Brand Name
- Alcohol Content (ABV)
- Government Warning Statement

### Verification Result Structure

```typescript
{
  labelId: string;
  filename: string;
  extractedData: LabelData;
  fieldVerifications: FieldVerification[];
  overallMatch: boolean;
  matchPercentage: number;
  processingTime: number;
  timestamp: string;
}
```

## Performance Optimization

### OCR Processing (~4-5 seconds)
1. Image → Buffer (network transfer)
2. Call Azure Vision API
3. Poll for results (with backoff)
4. Extract text from response

### Verification Processing (~500ms)
1. Parse extracted text
2. Iterate through fields
3. Calculate similarity scores
4. Aggregate results

### Batch Optimization
- Sequential processing (maintains order)
- Error handling per item (doesn't halt batch)
- Progress tracking (for UI updates)
- Streaming responses (optional future enhancement)

## Data Flow

### Single Label Verification

```
User Upload
    ↓
Frontend: Read file, prepare form data
    ↓
Upload to: POST /api/verification/verify-label
    ↓
Backend: Receive file + application data
    ↓
OCRService: Extract text from image
    ↓
Azure Vision API: Process image
    ↓
LabelVerificationService: Parse & verify
    ↓
Return: VerificationResult JSON
    ↓
Frontend: Display results
```

### Batch Verification

```
User Uploads [File1, File2, ..., FileN]
    ↓
Frontend: Create batch request
    ↓
Upload to: POST /api/verification/verify-batch
    ↓
Backend: Process each file sequentially
    ↓
For Each File:
    - OCRService.extractText()
    - LabelVerificationService.verify()
    - Collect results
    ↓
Return: BatchVerificationResult
    ↓
Frontend: Navigate to results page
```

## Error Handling

### Backend Errors
- **400**: Bad request (missing fields, invalid file)
- **413**: Payload too large (>50MB)
- **500**: Server error (Azure API failure, internal error)

### Frontend Errors
- Display error message in UI
- Preserve form state for retry
- Log to browser console

### Azure Integration Errors
- Timeout handling (max 30 polling attempts)
- Fallback graceful degradation
- Detailed error messages for debugging

## Security Considerations

### Input Validation
- File type verification (MIME type check)
- File size limits (50MB per file)
- No arbitrary code execution

### Data Privacy
- No PII storage (images not persisted)
- HTTPS in production (add SSL termination)
- Azure HTTPS for all API calls

### CORS
- Configured for frontend domain
- Restricts cross-origin requests

### Future: Production Hardening
- Rate limiting (prevent DOS)
- Request signing (prevent tampering)
- Audit logging (compliance requirement)
- Encryption at rest (data persistence)

## Testing Strategy

### Backend Tests
- Unit tests for verification logic
- Mock Azure API responses
- Edge cases: empty fields, special characters

### Frontend Tests
- Component rendering tests
- API integration tests
- User interaction tests

### Integration Tests
- End-to-end label verification
- Batch processing workflows
- Error recovery paths

## Deployment Considerations

### Local Development
- Docker Compose for reproducibility
- Hot reload for rapid iteration
- Volume mounts for code changes

### Staging/Production
- Container Registry (ACR) for images
- App Service for backend/frontend
- Environment-specific configs
- Health checks and monitoring

### Scalability
- Stateless services (no session affinity needed)
- Horizontal scaling possible
- Azure auto-scaling for load

## Future Enhancements

1. **Image Preprocessing**:
   - Rotation correction
   - Glare removal
   - Contrast enhancement

2. **ML Integration**:
   - Train custom OCR models
   - Label field detection
   - Confidence scoring

3. **Advanced Features**:
   - Webhook notifications
   - Batch scheduling
   - Result export (CSV, JSON)
   - Audit trail

4. **Performance**:
   - Caching layer (Redis)
   - Parallel processing
   - Async batch jobs

5. **Monitoring**:
   - Application Insights
   - Error rate tracking
   - Performance metrics
   - Cost monitoring

## Code Quality

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint configured
- **Formatting**: Consistent indentation (2 spaces)
- **Comments**: JSDoc for public APIs
- **Testing**: Jest for unit tests

## Lessons Learned

1. **Government IT**: Plan for firewall restrictions
2. **Accuracy vs Speed**: Trade-off between fuzzy matching and exact verification
3. **User Experience**: Keep UI simple for diverse tech comfort levels
4. **Batch Processing**: Sequential > Parallel for government audit trails
5. **Error Messages**: Clear, actionable messages reduce support burden

---

For implementation details, see specific service files in `backend/src/services/`.
