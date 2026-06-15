import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyBatchCSV } from '../services/api';
import { BatchRowResult, BatchSummary } from '../types';
import '../styles/BatchUploadPage.css';

interface BatchUploadPageProps {
  apiEndpoint: string;
}

interface CSVRow {
  filename: string;
  [key: string]: string;
}

function parseCSV(text: string): CSVRow[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: CSVRow = { filename: '' };
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() || '';
    });
    if (row.filename) rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  values.push(current);
  return values;
}

function generateFullCSVReport(results: BatchRowResult[]): string {
  const fieldNames = [
    'brandName', 'classType', 'alcoholContent', 'netContents',
    'bottlerName', 'bottlerAddress', 'countryOfOrigin', 'governmentWarning'
  ];
  const fieldLabels = [
    'Brand Name', 'Class/Type', 'Alcohol Content', 'Net Contents',
    'Bottler Name', 'Bottler Address', 'Country of Origin', 'Government Warning'
  ];

  // Build header row
  const headers = ['Filename', 'Status', 'Match %', 'Processing Time (ms)'];
  fieldLabels.forEach(label => {
    headers.push(`${label} (Expected)`, `${label} (Extracted)`, `${label} Match`, `${label} Confidence`);
  });

  const rows = results.map(r => {
    const row: string[] = [
      r.filename,
      r.status.toUpperCase().replace('-', ' '),
      r.matchPercentage.toFixed(1),
      String(r.processingTime)
    ];

    fieldNames.forEach(fieldName => {
      const v = r.fieldVerifications.find(fv => fv.fieldName === fieldName);
      row.push(
        v?.expectedValue || '',
        v?.extractedValue || '',
        v ? (v.isMatch ? 'Yes' : 'No') : 'N/A',
        v ? `${(v.confidence * 100).toFixed(0)}%` : 'N/A'
      );
    });

    return row;
  });

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
}

const BatchUploadPage: React.FC<BatchUploadPageProps> = ({ apiEndpoint }) => {
  const navigate = useNavigate();

  // File state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvTotalRows, setCsvTotalRows] = useState(0);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [currentFile, setCurrentFile] = useState('');
  const [error, setError] = useState('');

  // Results state
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Refs for accumulating results during streaming
  const resultsRef = useRef<BatchRowResult[]>([]);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleCSVSelect = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a .csv file');
      return;
    }
    setCsvFile(file);
    setError('');
    setSummary(null);

    // Parse CSV for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const headers = lines[0] ? parseCSVLine(lines[0]).map(h => h.trim()) : [];
      setCsvHeaders(headers);
      setCsvPreview(rows.slice(0, 5));
      setCsvTotalRows(rows.length);
    };
    reader.readAsText(file);
  }, []);

  const handleZIPSelect = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please select a .zip file');
      return;
    }
    setZipFile(file);
    setError('');
    setSummary(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, type: 'csv' | 'zip') => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      type === 'csv' ? handleCSVSelect(file) : handleZIPSelect(file);
    }
  }, [handleCSVSelect, handleZIPSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleStartVerification = async () => {
    if (!csvFile || !zipFile) {
      setError('Please select both a CSV file and a ZIP file');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSummary(null);
    setExpandedRow(null);
    resultsRef.current = [];
    setProgress({ processed: 0, total: csvTotalRows });

    try {
      await verifyBatchCSV(csvFile, zipFile, apiEndpoint, (result, processed, total) => {
        resultsRef.current = [...resultsRef.current, result];
        setProgress({ processed, total });
        setCurrentFile(result.filename);
      });

      // Build summary
      const results = resultsRef.current;
      const passed = results.filter(r => r.status === 'pass').length;
      const failed = results.filter(r => r.status === 'fail').length;
      const needsReview = results.filter(r => r.status === 'needs-review').length;

      setSummary({
        total: results.length,
        passed,
        failed,
        needsReview,
        results
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch verification failed');
    } finally {
      setIsProcessing(false);
      setCurrentFile('');
    }
  };

  const handleDownloadReport = () => {
    if (!summary) return;
    const csv = generateFullCSVReport(summary.results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-verification-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setCsvFile(null);
    setZipFile(null);
    setCsvPreview([]);
    setCsvHeaders([]);
    setCsvTotalRows(0);
    setSummary(null);
    setError('');
    setProgress({ processed: 0, total: 0 });
    setExpandedRow(null);
    resultsRef.current = [];
    if (csvInputRef.current) csvInputRef.current.value = '';
    if (zipInputRef.current) zipInputRef.current.value = '';
  };

  const progressPercent = progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div className="batch-upload-page">
      <div className="container">
        <section className="batch-section">
          <h2>Batch Label Verification</h2>
          <p>Upload a CSV file with application data and a ZIP file containing matching label images.</p>

          {/* File Upload Area */}
          {!summary && (
            <div className="upload-grid">
              {/* CSV Dropzone */}
              <div
                className={`dropzone ${csvFile ? 'has-file' : ''}`}
                onDrop={(e) => handleDrop(e, 'csv')}
                onDragOver={handleDragOver}
                onClick={() => csvInputRef.current?.click()}
              >
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && handleCSVSelect(e.target.files[0])}
                  className="file-input-hidden"
                />
                <div className="dropzone-icon">📄</div>
                <div className="dropzone-label">CSV Application Data</div>
                {csvFile ? (
                  <div className="dropzone-file">
                    <span className="file-name">{csvFile.name}</span>
                    <span className="file-meta">{csvTotalRows} rows</span>
                  </div>
                ) : (
                  <div className="dropzone-hint">Click or drop .csv file</div>
                )}
              </div>

              {/* ZIP Dropzone */}
              <div
                className={`dropzone ${zipFile ? 'has-file' : ''}`}
                onDrop={(e) => handleDrop(e, 'zip')}
                onDragOver={handleDragOver}
                onClick={() => zipInputRef.current?.click()}
              >
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  onChange={(e) => e.target.files?.[0] && handleZIPSelect(e.target.files[0])}
                  className="file-input-hidden"
                />
                <div className="dropzone-icon">🗜️</div>
                <div className="dropzone-label">ZIP Label Images</div>
                {zipFile ? (
                  <div className="dropzone-file">
                    <span className="file-name">{zipFile.name}</span>
                    <span className="file-meta">{(zipFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                ) : (
                  <div className="dropzone-hint">Click or drop .zip file</div>
                )}
              </div>
            </div>
          )}

          {/* CSV Preview */}
          {csvPreview.length > 0 && !summary && !isProcessing && (
            <div className="csv-preview">
              <h3>CSV Preview <span className="preview-count">({csvTotalRows} total rows)</span></h3>
              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      {csvHeaders.map((h, i) => <th key={i}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i}>
                        {csvHeaders.map((h, j) => <td key={j}>{row[h] || '-'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvTotalRows > 5 && (
                <p className="preview-more">Showing first 5 of {csvTotalRows} rows</p>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && <div className="error-message">{error}</div>}

          {/* Progress Section */}
          {isProcessing && (
            <div className="progress-section">
              <div className="progress-header">
                <span className="progress-label">Processing {progress.processed} of {progress.total}...</span>
                <span className="progress-percent">{progressPercent}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }}>
                  <div className="progress-glow"></div>
                </div>
              </div>
              {currentFile && (
                <p className="current-file">Current: <strong>{currentFile}</strong></p>
              )}
            </div>
          )}

          {/* Start Button */}
          {!summary && (
            <button
              onClick={handleStartVerification}
              disabled={isProcessing || !csvFile || !zipFile}
              className="start-button"
              id="start-batch-verification"
            >
              {isProcessing ? (
                <><span className="spinner"></span> Processing...</>
              ) : (
                '🚀 Start Batch Verification'
              )}
            </button>
          )}

          {/* ===== RESULTS SECTION ===== */}
          {summary && (
            <div className="results-area">
              {/* Summary Cards */}
              <div className="summary-cards">
                <div className="summary-card total">
                  <div className="card-number">{summary.total}</div>
                  <div className="card-label">Total Labels</div>
                </div>
                <div className="summary-card passed">
                  <div className="card-number">{summary.passed}</div>
                  <div className="card-label">Passed ✓</div>
                </div>
                <div className="summary-card failed">
                  <div className="card-number">{summary.failed}</div>
                  <div className="card-label">Failed ✗</div>
                </div>
                <div className="summary-card review">
                  <div className="card-number">{summary.needsReview}</div>
                  <div className="card-label">Needs Review ⚠</div>
                </div>
              </div>

              {/* Actions */}
              <div className="results-actions">
                <button onClick={handleDownloadReport} className="download-button" id="download-csv-report">
                  📥 Download Full CSV Report
                </button>
                <button onClick={handleReset} className="reset-button">
                  🔄 New Batch
                </button>
              </div>

              {/* Results Table */}
              <div className="results-table-wrapper">
                <table className="batch-results-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Filename</th>
                      <th>Status</th>
                      <th>Match %</th>
                      <th>Time (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.results.map((r, idx) => (
                      <React.Fragment key={idx}>
                        <tr
                          className={`result-row ${r.status} ${expandedRow === idx ? 'expanded' : ''}`}
                          onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                        >
                          <td>{idx + 1}</td>
                          <td className="cell-filename">{r.filename}</td>
                          <td>
                            <span className={`status-badge ${r.status}`}>
                              {r.status === 'pass' && '✓ Pass'}
                              {r.status === 'fail' && '✗ Fail'}
                              {r.status === 'needs-review' && '⚠ Review'}
                            </span>
                          </td>
                          <td>{r.matchPercentage.toFixed(1)}%</td>
                          <td>{r.processingTime}</td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {expandedRow === idx && (
                          <tr className="detail-row">
                            <td colSpan={5}>
                              <div className="detail-content">
                                <table className="detail-table">
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
                                    {r.fieldVerifications.map((v, vi) => (
                                      <tr key={vi} className={!v.expectedValue ? 'skipped' : v.isMatch ? 'match' : 'mismatch'}>
                                        <td className="field-name">{v.fieldName}</td>
                                        <td>{v.expectedValue || '-'}</td>
                                        <td>{v.extractedValue || '-'}</td>
                                        <td>{!v.expectedValue ? 'Skipped' : v.isMatch ? '✓' : '✗'}</td>
                                        <td>{!v.expectedValue ? '-' : `${(v.confidence * 100).toFixed(0)}%`}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {r.error && <div className="detail-error">Error: {r.error}</div>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Navigation */}
          <button onClick={() => navigate('/')} className="back-button">
            ← Back to Single Verification
          </button>
        </section>
      </div>
    </div>
  );
};

export default BatchUploadPage;
