import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BatchUploadPage from './pages/BatchUploadPage';
import ResultsPage from './pages/ResultsPage';
import './App.css';

const App: React.FC = () => {
  const [apiEndpoint] = useState(process.env.REACT_APP_API_URL || 'http://localhost:5001');

  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <h1>🍾 Alcohol Label Verification System</h1>
          <p>AI-Powered TTB Compliance Verification</p>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage apiEndpoint={apiEndpoint} />} />
            <Route path="/batch" element={<BatchUploadPage apiEndpoint={apiEndpoint} />} />
            <Route path="/results/:batchId" element={<ResultsPage apiEndpoint={apiEndpoint} />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>TTB Alcohol Label Verification System | Built with React + TypeScript</p>
        </footer>
      </div>
    </Router>
  );
};

export default App;
