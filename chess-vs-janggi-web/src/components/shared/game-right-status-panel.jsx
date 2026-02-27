import React from 'react';

const GameRightStatusPanel = ({
    myReady,
    opponentReady,
    myStatusText,
    opponentStatusText,
    canToggleReady,
    gameStarted,
    onToggleReady,
    showStartButton,
    canHostStart,
    onStart,
    customReadyHint,
    setupChildren,
    winnerHint,
    capturedPieces,
    renderCapturedPiece,
}) => {
    return (
        <aside className="piece-side-panel" aria-label="게임 정보">
            <div className="capture-area">
                <div className="reserve-title">준비 상태</div>
                <div className="ready-status-row">
                    <span className="ready-label">나</span>
                    <span className={`ready-badge ${myReady ? 'ready' : 'wait'}`}>{myStatusText}</span>
                </div>
                <div className="ready-status-row">
                    <span className="ready-label">상대</span>
                    <span className={`ready-badge ${opponentReady ? 'ready' : 'wait'}`}>{opponentStatusText}</span>
                </div>
                <button
                    type="button"
                    className={`placement-ready-btn ${myReady ? 'is-ready' : ''}`}
                    disabled={!canToggleReady || gameStarted}
                    onClick={onToggleReady}
                >
                    {myReady ? '준비 취소' : '준비'}
                </button>
                {customReadyHint && <div className="reserve-hint">{customReadyHint}</div>}
                {showStartButton && (
                    <button type="button" className="placement-ready-btn" disabled={!canHostStart || gameStarted} onClick={onStart}>
                        시작
                    </button>
                )}
            </div>

            {!gameStarted && setupChildren}

            {gameStarted && (
                <>
                    <div className="capture-area" aria-label="게임 결과 힌트">
                        <div className="reserve-hint">{winnerHint}</div>
                    </div>

                    <div className="capture-area" aria-label="잡은 기물">
                        <div className="reserve-title">내가 잡은 기물</div>
                        <div className="reserve-list">
                            {capturedPieces.length === 0 && <div className="reserve-hint">아직 없습니다.</div>}
                            {capturedPieces.map(renderCapturedPiece)}
                        </div>
                    </div>
                </>
            )}
        </aside>
    );
};

export default GameRightStatusPanel;
