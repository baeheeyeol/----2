import React from 'react';

const formatSeconds = (seconds) => {
    const safe = Math.max(0, Number.isFinite(seconds) ? Math.floor(seconds) : 0);
    const mm = String(Math.floor(safe / 60)).padStart(2, '0');
    const ss = String(safe % 60).padStart(2, '0');
    return `${mm}:${ss}`;
};

const GameLeftStatusPanel = ({
    topUserId,
    bottomUserId,
    activeSide,
    firstTurnUserId,
    remainingSeconds,
    myLives,
    opponentLives,
    warningSoundEnabled,
    onToggleWarningSound,
    alertSide,
    alertText,
    alertType,
}) => {
    return (
        <aside className="turn-side-panel" aria-label="턴 정보">
            <div className="turn-side-title">현재 턴</div>

            <div className={`turn-player-card ${activeSide === 'top' ? 'active' : ''}`}>
                <div className="turn-player-label"></div>
                <div className="turn-player-id">{topUserId || '대기 중'}</div>
                {alertText && alertSide === 'top' && <div className={`left-alert ${alertType === 'checkmate' ? 'checkmate' : 'check'}`}>{alertText}</div>}
            </div>

            <div className="turn-vs">VS</div>

            <div className={`turn-player-card ${activeSide === 'bottom' ? 'active' : ''}`}>
                <div className="turn-player-label"></div>
                <div className="turn-player-id">{bottomUserId || '대기 중'}</div>
                {alertText && alertSide === 'bottom' && <div className={`left-alert ${alertType === 'checkmate' ? 'checkmate' : 'check'}`}>{alertText}</div>}
            </div>

            <div className="turn-side-time-label">남은 시간</div>
            <div className={`turn-side-time ${remainingSeconds <= 10 ? 'danger' : ''}`}>{formatSeconds(remainingSeconds)}</div>
            <div className="turn-side-sub">선공: {firstTurnUserId}</div>
            <div className="turn-side-sub">목숨: 나 {myLives} / 상대 {opponentLives}</div>
            <button type="button" className="sound-toggle-btn" onClick={onToggleWarningSound}>
                경고음 {warningSoundEnabled ? 'ON' : 'OFF'}
            </button>
        </aside>
    );
};

export default GameLeftStatusPanel;
