import React from "react";
import Context from "../../context";

export default function History() {
  const { history } = React.useContext(Context);
  const [showHistory, setShowHistory] = React.useState(false);
  const historyItemsContainerRef = React.useRef<HTMLDivElement>(null);

  const getBubbleClass = (val: number) => {
    if (val < 2) return 'low';
    if (val <= 10) return 'mid';
    return 'high';
  };

  return (
    <>
      <div className="history-bar">
        <div className="history-content">
          <div className="history-items-container" ref={historyItemsContainerRef}>
            {history.slice(0, 25).map((item, key) => {
              const num = Number(item);
              const cls = getBubbleClass(num);
              return (
                <span key={key} className={`history-item ${cls}`}>
                  {num.toFixed(2)}x
                </span>
              );
            })}
          </div>
        </div>
        <i
          className="fas fa-clock-rotate-left history-icon"
          onClick={() => setShowHistory(!showHistory)}
        ></i>
      </div>

      {/* History Popup */}
      <div className={`history-popup ${showHistory ? 'show' : ''}`}>
        <div className="popup-header">
          <span>Crash History</span>
          <button className="close-popup" onClick={() => setShowHistory(false)}>×</button>
        </div>
        <div className="popup-body">
          {history.length === 0 ? (
            <div style={{ color: '#666', fontSize: '12px' }}>No rounds yet</div>
          ) : (
            history.slice().reverse().map((item, key) => {
              const num = Number(item);
              const cls = getBubbleClass(num);
              return (
                <div key={key} className={`popup-item ${cls}`}>
                  {num.toFixed(2)}x
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
