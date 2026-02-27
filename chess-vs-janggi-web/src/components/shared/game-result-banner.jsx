import React from 'react';
import './game-result-banner.css';

const GameResultBanner = ({ isVisible, winnerId, loserId, reason }) => {
    if (!isVisible) return null;

    return (
        <div className="game-result-banner" role="status" aria-live="polite">
            <div className="result-title">경기 종료</div>
            <div className="result-winner">승리: {winnerId || '알 수 없음'}</div>
            {loserId && <div className="result-loser">패배: {loserId}</div>}
            {reason && <div className="result-reason">사유: {reason}</div>}
        </div>
    );
};

export default GameResultBanner;
