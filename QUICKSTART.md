# Quick Start Guide

## Prerequisites

- Node.js 16+ and npm
- Azure subscription with Computer Vision resource
- 5 minutes of time

## Fastest Way to Get Running

### 1. Clone or Download the Project
```bash
cd alcohol-label-verification-app
```

### 2. Create Azure Computer Vision Resource

If you don't have one:
```bash
# Create resource group
az group create --name myResourceGroup --location eastus

# Create Computer Vision resource
az cognitiveservices account create --name myVisionResource \
  --resource-group myResourceGroup \
  --kind ComputerVision \
  --sku F0 \
  --location eastus

# Get keys
az cognitiveservices account keys list --name myVisionResource \
  --resource-group myResourceGroup
```

### 3. Set Environment Variables

**Backend (.env)**:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your Azure credentials:
```
PORT=5000
AZURE_VISION_KEY=your_key_from_above
AZURE_VISION_ENDPOINT=https://eastus.api.cognitive.microsoft.com/
NODE_ENV=development
```

**Frontend (.env)**:
```bash
cp frontend/.env.example frontend/.env
# Default is already set to http://localhost:5000
```

### 4. Install & Run

**Option A: Using npm scripts (simplest)**
```bash
# Install all dependencies
npm run install-all

# Start both backend and frontend
npm run dev
```

**Option B: Using Docker (recommended for clean environment)**
```bash
# Start both services
docker-compose up

# Or build first
docker-compose build
docker-compose up
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

## Testing the Application

### 1. Single Label Verification

1. Go to http://localhost:3000
2. Upload any alcohol label image (or create one with AI tools)
3. Fill in expected label data (brand name, ABV, etc.)
4. Click "Verify Label"
5. View results in real-time

### 2. Batch Upload

1. Go to http://localhost:3000/batch
2. Select multiple label images (up to 300)
3. Click "Upload & Verify Batch"
4. Monitor progress and view results

## API Testing

Using curl or Postman:

```bash
# Health check
curl http://localhost:5000/health

# Single verification (form data)
curl -X POST http://localhost:5000/api/verification/verify-label \
  -F "image=@label.jpg" \
  -F "labelId=label-1" \
  -F 'applicationData={"brandName":"OLD TOM","alcoholContent":"45%"}'

# JSON verification (base64 image)
curl -X POST http://localhost:5000/api/verification/verify-json \
  -H "Content-Type: application/json" \
  -d '{
    "labelId": "label-1",
    "filename": "label.jpg",
    "imageBase64": "...",
    "applicationData": {"brandName": "OLD TOM"}
  }'
```

## Troubleshooting

### Backend won't start
```bash
# Check if port 5000 is available
lsof -i :5000

# Check Node version
node --version  # Should be 16+

# Check dependencies
cd backend && npm install
```

### Frontend won't load
```bash
# Check if React app is running
curl http://localhost:3000

# Clear npm cache
npm cache clean --force

# Reinstall
cd frontend && rm -rf node_modules && npm install && npm start
```

### Azure Connection Issues
```bash
# Verify credentials
echo "AZURE_VISION_KEY=$AZURE_VISION_KEY"
echo "AZURE_VISION_ENDPOINT=$AZURE_VISION_ENDPOINT"

# Test connectivity
curl -H "Ocp-Apim-Subscription-Key: YOUR_KEY" \
  https://YOUR_ENDPOINT/vision/v3.2/read/analyze
```

### No results from verification
1. Check backend logs: `npm run backend:dev`
2. Verify image file is valid (JPG, PNG, GIF, WebP)
3. Check image file size (should be under 50MB)
4. Ensure application data has brand name (required field)

## Next Steps

1. **Explore the Code**:
   - Backend: `backend/src/services/` for verification logic
   - Frontend: `frontend/src/pages/` for UI components

2. **Deploy to Azure**:
   - See README_SETUP.md for deployment instructions

3. **Customize Verification**:
   - Edit `backend/src/services/labelVerificationService.ts` to adjust matching logic
   - Update field mappings in parsing logic

4. **Add More Features**:
   - Implement image preprocessing for better OCR
   - Add ML-based field detection
   - Create audit logging

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/index.ts` | Express server setup |
| `backend/src/services/ocrService.ts` | Azure Vision integration |
| `backend/src/services/labelVerificationService.ts` | Verification logic |
| `frontend/src/pages/HomePage.tsx` | Single label UI |
| `frontend/src/pages/BatchUploadPage.tsx` | Batch upload UI |
| `docker-compose.yml` | Local development with Docker |

## Performance Baseline

- Single label: 4-6 seconds
- Batch (100 labels): 6-8 minutes
- API response time (excluding OCR): <500ms
- Memory usage: ~200MB backend, ~150MB frontend

Need help? Check the troubleshooting section or review the logs!
