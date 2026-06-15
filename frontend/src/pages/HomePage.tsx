import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VerificationResult, LabelData } from '../types';
import { verifyLabel } from '../services/api';
import '../styles/HomePage.css';

interface HomePageProps {
  apiEndpoint: string;
}

const HomePage: React.FC<HomePageProps> = ({ apiEndpoint }) => {
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [applicationData, setApplicationData] = useState<LabelData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const extractedDataFields: Array<[keyof LabelData, string]> = [
    ['brandName', 'Brand Name'],
    ['classType', 'Class/Type'],
    ['alcoholContent', 'Alcohol Content'],
    ['netContents', 'Net Contents'],
    ['bottlerName', 'Bottler Name'],
    ['bottlerAddress', 'Bottler Address'],
    ['countryOfOrigin', 'Country of Origin'],
    ['governmentWarning', 'Government Warning']
  ];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleInputChange = (field: keyof LabelData, value: string) => {
    setApplicationData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleVerify = async () => {
    if (!imageFile) {
      setError('Please select an image file');
      return;
    }

    if (!applicationData.brandName) {
      setError('Please enter at least the brand name');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const verificationResult = await verifyLabel(
        imageFile,
        applicationData,
        apiEndpoint
      );
      setResult(verificationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="home-page">
      <div className="container">
        <section className="verification-section">
          <h2>Single Label Verification</h2>
          <p>Upload a label image and enter the application data to verify compliance.</p>

          <div className="verification-form">
            {/* Image Upload Section */}
            <div className="form-group">
              <label>Label Image</label>
              <div className="image-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="file-input"
                />
                {previewUrl && (
                  <div className="image-preview">
                    <img src={previewUrl} alt="Label preview" />
                  </div>
                )}
              </div>
            </div>

            {/* Application Data Form */}
            <div className="application-data">
              <h3>Application Data</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="brandName">Brand Name *</label>
                  <input
                    id="brandName"
                    type="text"
                    value={applicationData.brandName || ''}
                    onChange={(e) => handleInputChange('brandName', e.target.value)}
                    placeholder="e.g., OLD TOM DISTILLERY"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="classType">Class/Type</label>
                  <input
                    id="classType"
                    type="text"
                    value={applicationData.classType || ''}
                    onChange={(e) => handleInputChange('classType', e.target.value)}
                    placeholder="e.g., Kentucky Straight Bourbon Whiskey"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="alcoholContent">Alcohol Content</label>
                  <input
                    id="alcoholContent"
                    type="text"
                    value={applicationData.alcoholContent || ''}
                    onChange={(e) => handleInputChange('alcoholContent', e.target.value)}
                    placeholder="e.g., 45% Alc./Vol. (90 Proof)"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="netContents">Net Contents</label>
                  <input
                    id="netContents"
                    type="text"
                    value={applicationData.netContents || ''}
                    onChange={(e) => handleInputChange('netContents', e.target.value)}
                    placeholder="e.g., 750 mL"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="bottlerName">Bottler Name</label>
                  <input
                    id="bottlerName"
                    type="text"
                    value={applicationData.bottlerName || ''}
                    onChange={(e) => handleInputChange('bottlerName', e.target.value)}
                    placeholder="Bottler name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="countryOfOrigin">Country of Origin</label>
                  <input
                    id="countryOfOrigin"
                    type="text"
                    value={applicationData.countryOfOrigin || ''}
                    onChange={(e) => handleInputChange('countryOfOrigin', e.target.value)}
                    placeholder="e.g., United States"
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label htmlFor="governmentWarning">Government Warning Statement</label>
                <textarea
                  id="governmentWarning"
                  value={applicationData.governmentWarning || ''}
                  onChange={(e) => handleInputChange('governmentWarning', e.target.value)}
                  placeholder="Government warning text..."
                  rows={3}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && <div className="error-message">{error}</div>}

            {/* Verify Button */}
            <button
              onClick={handleVerify}
              disabled={isLoading}
              className="verify-button"
            >
              {isLoading ? 'Processing...' : 'Verify Label'}
            </button>
          </div>
        </section>

        {/* Results Section */}
        {result && (
          <section className="results-section">
            <h2>Verification Results</h2>
            <div className={`result-summary ${result.overallMatch ? 'match' : 'mismatch'}`}>
              <div className="summary-header">
                <h3>{result.overallMatch ? '✓ Verified' : '✗ Not Verified'}</h3>
                <p>Match: {result.matchPercentage.toFixed(1)}% | Processing Time: {result.processingTime}ms</p>
              </div>

              <div className="extracted-data-panel">
                <h4>Extracted Data</h4>
                <dl className="extracted-data-grid">
                  {extractedDataFields.map(([field, label]) => (
                    <React.Fragment key={field}>
                      <dt>{label}</dt>
                      <dd>{result.extractedData[field] || '-'}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>

              <table className="results-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Expected</th>
                    <th>Extracted</th>
                    <th>Match</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {result.fieldVerifications.map((verification, idx) => (
                    <tr
                      key={idx}
                      className={!verification.expectedValue ? 'skipped' : verification.isMatch ? 'match' : 'mismatch'}
                    >
                      <td className="field-name">{verification.fieldName}</td>
                      <td>{verification.expectedValue || '-'}</td>
                      <td>{verification.extractedValue || '-'}</td>
                      <td>{!verification.expectedValue ? 'Skipped' : verification.isMatch ? '✓' : '✗'}</td>
                      <td>{!verification.expectedValue ? '-' : `${(verification.confidence * 100).toFixed(0)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Navigation */}
        <section className="navigation">
          <button onClick={() => navigate('/batch')} className="batch-button">
            📦 Go to Batch Upload
          </button>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
