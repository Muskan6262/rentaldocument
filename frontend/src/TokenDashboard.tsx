export interface TokenUsage {
  token_quota: number;
  tokens_used: number;
}

interface Props {
  usage: TokenUsage | null;
}

export default function TokenDashboard({ usage }: Props) {
  if (!usage) return null;
  
  const percentage = Math.min(100, Math.round((usage.tokens_used / usage.token_quota) * 100));
  const isDanger = percentage > 90;
  
  return (
    <div className="token-dashboard">
      <div className="token-header">
        <h3>API Quota</h3>
      </div>
      
      <div className="progress-container">
        <div className="progress-bar-bg">
          <div 
            className={`progress-bar-fill ${isDanger ? 'danger' : ''}`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <div className="token-stats">
          <span>{usage.tokens_used.toLocaleString()} used</span>
          <span>{usage.token_quota.toLocaleString()} limit</span>
        </div>
      </div>
    </div>
  );
}
