# Alcohol Label Verification Application

## Overview

This is a full-stack AI-powered alcohol label verification system designed for the TTB (Alcohol and Tobacco Tax and Trade Bureau) to streamline compliance review. The application uses Azure Computer Vision API for OCR and intelligent matching algorithms to verify label accuracy against submitted applications.

### Key Features

- **Single Label Verification**: Upload and verify individual labels
- **Batch Processing**: Handle bulk uploads (up to 300 labels)
- **Field Validation**: Verify brand name, ABV, class type, government warnings, and more
- **Performance Optimized**: ~5 seconds per label processing
- **User-Friendly UI**: Simple, intuitive interface for diverse user comfort levels
- **Fuzzy Matching**: Smart matching for case/punctuation variations
- **Strict Compliance**: Exact verification for critical fields like government warnings

## Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **OCR Engine**: Azure Computer Vision API v3.2
- **File Upload**: Multer
- **Testing**: Jest

### Frontend
- **Framework**: React 18 + TypeScript
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Styling**: CSS3
- **Build Tool**: React Scripts

### Infrastructure
- **Deployment**: Azure App Service (recommended)
- **Storage**: Azure Blob Storage (for production)
- **Vision API**: Azure Computer Vision

## Project Structure

```
alcohol-label-verification-app/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server
│   │   ├── routes/
│   │   │   └── verification.ts   # API endpoints
│   │   ├── services/
│   │   │   ├── ocrService.ts     # Azure OCR integration
│   │   │   └── labelVerificationService.ts  # Verification logic
│   │   └── types/
│   │       └── index.ts          # TypeScript interfaces
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── jest.config.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main component
│   │   ├── index.tsx             # Entry point
│   │   ├── pages/
│   │   │   ├── HomePage.tsx      # Single label verification
│   │   │   ├── BatchUploadPage.tsx
│   │   │   └── ResultsPage.tsx
│   │   ├── services/
│   │   │   └── api.ts            # API calls
│   │   ├── types/
│   │   │   └── index.ts          # Frontend types
│   │   ├── styles/
│   │   │   ├── HomePage.css
│   │   │   ├── BatchUploadPage.css
│   │   │   └── ResultsPage.css
│   │   └── App.css
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js 16+ and npm
- Azure subscription with Computer Vision resource
- Git

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. **Configure Azure credentials** in `.env`:
   ```
   PORT=5000
   AZURE_VISION_KEY=your_key_here
   AZURE_VISION_ENDPOINT=https://your-region.api.cognitive.microsoft.com/
   NODE_ENV=development
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

   Server will run on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory** (in a new terminal):
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create `.env` file** (for development):
   ```bash
   REACT_APP_API_URL=http://localhost:5000
   ```

4. **Start development server**:
   ```bash
   npm start
   ```

   Application will open on `http://localhost:3000`

## API Endpoints

### Single Label Verification

**POST** `/api/verification/verify-label`

- **Request**: Multipart form data with image file and application data
- **Response**: Verification result with field-by-field analysis
- **Processing Time**: ~5 seconds

### Batch Verification

**POST** `/api/verification/verify-batch`

- **Request**: Multiple image files + batch metadata
- **Response**: Batch results with status and processing metrics
- **Max Files**: 300 per batch

### JSON-based Verification

**POST** `/api/verification/verify-json`

- **Request**: JSON payload with base64 encoded image
- **Response**: Verification result
- **Use Case**: Direct API integration without multipart

## Verification Fields

The system verifies the following alcohol label fields:

1. **Brand Name** - Fuzzy matching (case-insensitive)
2. **Class/Type** - Category designation (Bourbon, Vodka, Wine, etc.)
3. **Alcohol Content** - ABV percentage and proof
4. **Net Contents** - Bottle volume (mL, oz, etc.)
5. **Bottler Name** - Manufacturer/bottler information
6. **Bottler Address** - Production facility address
7. **Country of Origin** - For imported beverages
8. **Government Warning** - **Exact match required** (all caps, bold required)

## Matching Algorithm

- **Exact Match**: Identical values = 100% confidence
- **Fuzzy Match**: Case-insensitive, punctuation-tolerant (>85% similarity threshold)
- **Government Warning**: Strict validation (must contain "GOVERNMENT WARNING" in caps and required phrases)
- **Overall Match**: All critical fields (brand, ABV, warning) must match

## Performance Characteristics

- **Single Label**: 4-6 seconds (OCR + verification)
- **Batch (10 labels)**: 40-60 seconds
- **Throughput**: ~10 labels/minute per backend instance
- **Image Size Limit**: 50MB per file
- **Batch Size Limit**: 300 files

## Development

### Running Tests

**Backend**:
```bash
cd backend
npm test
```

**Frontend**:
```bash
cd frontend
npm test
```

### Linting

```bash
npm run lint
```

### Building for Production

**Backend**:
```bash
cd backend
npm run build
```

**Frontend**:
```bash
cd frontend
npm run build
```

## Deployment

### Azure App Service

1. **Create App Service**:
   ```bash
   az appservice plan create --name myPlan --resource-group myRG --sku B1
   az webapp create --resource-group myRG --plan myPlan --name myApp --runtime "NODE|18-lts"
   ```

2. **Configure Azure deployment** using GitHub Actions or direct push

3. **Set environment variables** in App Service settings

### Docker Deployment

Backend and frontend can be containerized for deployment to Azure Container Apps or AKS.

## Architecture Decisions

### Why Node.js + Express?
- Fast, lightweight backend ideal for 5-second response requirement
- JavaScript ecosystem provides excellent OCR/image processing libraries
- Easy integration with Azure services
- Rapid prototyping and iteration

### Why React?
- Simple, intuitive UI for diverse user comfort levels
- Component-based architecture for maintainability
- Good accessibility support (WCAG compliance)
- TypeScript for type safety

### Why Azure Computer Vision?
- Government-friendly Azure infrastructure
- FedRAMP compliance ready
- High accuracy for document OCR
- Integrated with existing government IT landscape

## Future Enhancements

1. **ML-based Field Detection**: Train models on TTB label patterns
2. **Batch Status Notifications**: Email/SMS updates on batch completion
3. **Advanced Image Processing**: Handle poor quality, rotated, or glare-affected images
4. **Audit Trail**: Complete logging of all verifications for compliance
5. **Performance Optimization**: Implement caching and parallel processing
6. **Mobile App**: React Native version for mobile verification
7. **API Rate Limiting**: Prevent abuse and manage quotas
8. **Advanced Fuzzy Matching**: Phonetic matching for brand names

## Troubleshooting

### Azure Vision API Connection Issues

1. **Check credentials**: Ensure AZURE_VISION_KEY and AZURE_VISION_ENDPOINT are correct
2. **Check firewall**: Verify outbound HTTPS traffic to Azure endpoints is allowed
3. **Check region**: Ensure region matches your API endpoint

### Slow Processing

1. Monitor backend logs for OCR processing times
2. Consider upgrading Azure Computer Vision tier
3. Implement image preprocessing to reduce OCR load

### Frontend Not Loading

1. Ensure backend is running: `http://localhost:5000/health`
2. Check REACT_APP_API_URL in frontend .env
3. Verify CORS settings in backend

## License

Government work product - See LICENSE file

## Support

For questions or issues, refer to the TTB compliance documentation or contact the development team.
