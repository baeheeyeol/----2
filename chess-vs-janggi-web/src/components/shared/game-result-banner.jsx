import React from 'react';
import './game-result-banner.css';

const GameResultBanner = ({ isVisible, winnerId, loserId, onExit }) => {
    if (!isVisible) return null;

    return (
        <div className="game-result-overlay" role="dialog" aria-modal="true" aria-live="polite" aria-label="게임 결과">
            <div className="game-result-banner">
                <div className="result-title">경기 종료</div>

                <div className="result-players">
                    <div className="result-player-card winner">
                        <div className="result-player-id">{winnerId || '알 수 없음'}</div>
                        <div className="result-player-state winner-state">승리</div>
                    </div>

                    <div className="result-player-card loser">
                        <div className="result-player-id">{loserId || '알 수 없음'}</div>
                        <div className="result-player-state loser-state">패배</div>
                    </div>
                </div>

                <button type="button" className="result-exit-btn" onClick={onExit}>
                    나가기
                </button>
            </div>
        </div>
    );
};

export default GameResultBanner;
