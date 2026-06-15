import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { VerificationResult } from '../types';
import '../styles/ResultsPage.css';

interface ResultsPageProps {
  apiEndpoint: string;
}

const ResultsPage: React.FC<ResultsPageProps> = ({ apiEndpoint: _apiEndpoint }) => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<VerificationResult | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'matched' | 'mismatched'>('all');

  useEffect(() => {
    // Get results from navigation state or localStorage
    if (location.state?.result) {
      setResults(location.state.result.results);
    }
  }, [location.state]);

  const filteredResults = results.filter(result => {
    if (filterStatus === 'matched') return result.overallMatch;
    if (filterStatus === 'mismatched') return !result.overallMatch;
    return true;
  });

  const matchedCount = results.filter(r => r.overallMatch).length;
  const matchPercentage = results.length > 0 
    ? ((matchedCount / results.length) * 100).toFixed(1)
    : 0;

  const handleExport = () => {
    const csv = generateCSV(results);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-results-${batchId}.csv`;
    a.click();
  };

  const generateCSV = (data: VerificationResult[]): string => {
    const headers = ['Label ID', 'Filename', 'Overall Match', 'Match %', 'Processing Time (ms)'];
    const rows = data.map(r => [
      r.labelId,
      r.filename,
      r.overallMatch ? 'Yes' : 'No',
      r.matchPercentage.toFixed(1),
      r.processingTime
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  };

  return (
    <div className="results-page">
      <div className="container">
        {/* Summary Section */}
        <section className="summary-section">
          <h2>Batch Results - {batchId}</h2>
          <div className="summary-stats">
            <div className="stat">
              <h3>Total Labels</h3>
              <p className="stat-value">{results.length}</p>
            </div>
            <div className="stat">
              <h3>Verified</h3>
              <p className="stat-value verified">{matchedCount}</p>
            </div>
            <div className="stat">
              <h3>Mismatches</h3>
              <p className="stat-value mismatched">{results.length - matchedCount}</p>
            </div>
            <div className="stat">
              <h3>Success Rate</h3>
              <p className="stat-value">{matchPercentage}%</p>
            </div>
          </div>
        </section>

        {/* Filter & Export Section */}
        <section className="controls-section">
          <div className="filters">
            <button
              className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All ({results.length})
            </button>
            <button
              className={`filter-btn ${filterStatus === 'matched' ? 'active' : ''}`}
              onClick={() => setFilterStatus('matched')}
            >
              Verified ({matchedCount})
            </button>
            <button
              className={`filter-btn ${filterStatus === 'mismatched' ? 'active' : ''}`}
              onClick={() => setFilterStatus('mismatched')}
            >
              Issues ({results.length - matchedCount})
            </button>
          </div>

          <button onClick={handleExport} className="export-button">
            📥 Export CSV
          </button>
        </section>

        {/* Results List */}
        <section className="results-list-section">
          <table className="results-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Status</th>
                <th>Match %</th>
                <th>Time (ms)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result, idx) => (
                <tr
                  key={idx}
                  className={result.overallMatch ? 'matched' : 'mismatched'}
                >
                  <td className="filename">{result.filename}</td>
                  <td className="status">
                    {result.overallMatch ? '✓ Verified' : '✗ Issues Found'}
                  </td>
                  <td className="percentage">{result.matchPercentage.toFixed(1)}%</td>
                  <td>{result.processingTime}</td>
                  <td>
                    <button
                      className="detail-button"
                      onClick={() => setSelectedResult(result)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Detail View */}
        {selectedResult && (
          <section className="detail-section">
            <div className="detail-modal">
              <div className="modal-header">
                <h3>{selectedResult.filename}</h3>
                <button
                  className="close-button"
                  onClick={() => setSelectedResult(null)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <table className="verification-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Expected</th>
                      <th>Extracted</th>
                      <th>Status</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedResult.fieldVerifications.map((v, idx) => (
                      <tr key={idx} className={v.isMatch ? 'match' : 'mismatch'}>
                        <td>{v.fieldName}</td>
                        <td>{v.expectedValue || '-'}</td>
                        <td>{v.extractedValue || '-'}</td>
                        <td>{v.isMatch ? '✓' : '✗'}</td>
                        <td>{(v.confidence * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Navigation */}
        <section className="navigation-section">
          <button onClick={() => navigate('/')} className="home-button">
            ← Back to Home
          </button>
          <button onClick={() => navigate('/batch')} className="batch-button">
            Upload Another Batch →
          </button>
        </section>
      </div>
    </div>
  );
};

export default ResultsPage;
