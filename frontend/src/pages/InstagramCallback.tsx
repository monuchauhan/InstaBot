import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { instagramApi } from '../services/api';

const InstagramCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        setError(errorDescription || errorParam);
        setIsProcessing(false);
        return;
      }

      if (!code) {
        setError('No authorization code received');
        setIsProcessing(false);
        return;
      }

      try {
        await instagramApi.callback(code);
        navigate('/accounts', { 
          state: { message: 'Instagram account connected successfully!' } 
        });
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to connect Instagram account');
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="callback-page">
        <div className="callback-card error">
          <div className="callback-icon">❌</div>
          <h2>Connection Failed</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/accounts')}>Back to Accounts</button>
        </div>
        <style>{`
          .callback-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 1rem;
          }
          .callback-card {
            background: white;
            border-radius: 16px;
            padding: 3rem;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          }
          .callback-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .callback-card h2 {
            color: #333;
            margin-bottom: 0.5rem;
          }
          .callback-card p {
            color: #666;
            margin-bottom: 1.5rem;
          }
          .callback-card button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="callback-page">
      <div className="callback-card">
        <div className="loading-spinner"></div>
        <h2>Connecting Instagram</h2>
        <p>Please wait while we connect your account...</p>
      </div>
      <style>{`
        .callback-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 1rem;
        }
        .callback-card {
          background: white;
          border-radius: 16px;
          padding: 3rem;
          text-align: center;
          max-width: 400px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }
        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e1e5eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1.5rem;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .callback-card h2 {
          color: #333;
          margin-bottom: 0.5rem;
        }
        .callback-card p {
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default InstagramCallback;
