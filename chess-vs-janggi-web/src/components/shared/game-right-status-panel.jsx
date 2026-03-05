import React, { useEffect, useRef, useState } from 'react';

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
    ruleItems,
    myCapturedPieces,
    opponentCapturedPieces,
    renderCapturedPiece,
}) => {
    const [myCapturedHighlight, setMyCapturedHighlight] = useState(false);
    const [opponentCapturedHighlight, setOpponentCapturedHighlight] = useState(false);
    const previousMyCapturedCountRef = useRef((myCapturedPieces || []).length);
    const previousOpponentCapturedCountRef = useRef((opponentCapturedPieces || []).length);
    const gameStartedInitializedRef = useRef(false);

    useEffect(() => {
        const myCount = (myCapturedPieces || []).length;
        const opponentCount = (opponentCapturedPieces || []).length;

        if (!gameStarted) {
            gameStartedInitializedRef.current = false;
            previousMyCapturedCountRef.current = myCount;
            previousOpponentCapturedCountRef.current = opponentCount;
            setMyCapturedHighlight(false);
            setOpponentCapturedHighlight(false);
            return;
        }

        if (!gameStartedInitializedRef.current) {
            gameStartedInitializedRef.current = true;
            previousMyCapturedCountRef.current = myCount;
            previousOpponentCapturedCountRef.current = opponentCount;
            return;
        }

        if (myCount > previousMyCapturedCountRef.current) {
            setMyCapturedHighlight(true);
            window.setTimeout(() => setMyCapturedHighlight(false), 1100);
        }

        if (opponentCount > previousOpponentCapturedCountRef.current) {
            setOpponentCapturedHighlight(true);
            window.setTimeout(() => setOpponentCapturedHighlight(false), 1100);
        }

        previousMyCapturedCountRef.current = myCount;
        previousOpponentCapturedCountRef.current = opponentCount;
    }, [gameStarted, myCapturedPieces, opponentCapturedPieces]);

    return (
        <aside className="piece-side-panel" aria-label="게임 정보">
            {!gameStarted && (
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
            )}

            {!gameStarted && setupChildren}

            {gameStarted && (
                <>
                    <div className={`capture-area ${myCapturedHighlight ? 'capture-highlight-gain' : ''}`} aria-label="잡은 기물">
                        <div className="reserve-title">내가 잡은 기물</div>
                        <div className="reserve-list">
                            {(myCapturedPieces || []).length === 0 && <div className="reserve-hint">아직 없습니다.</div>}
                            {(myCapturedPieces || []).map(renderCapturedPiece)}
                        </div>
                    </div>

                    <div className={`capture-area ${opponentCapturedHighlight ? 'capture-highlight-loss' : ''}`} aria-label="잡힌 기물">
                        <div className="reserve-title">내가 잡힌 기물</div>
                        <div className="reserve-list">
                            {(opponentCapturedPieces || []).length === 0 && <div className="reserve-hint">아직 없습니다.</div>}
                            {(opponentCapturedPieces || []).map(renderCapturedPiece)}
                        </div>
                    </div>

                    <div className="capture-area" aria-label="규칙">
                        <div className="reserve-title">규칙</div>
                        <ol className="rule-list">
                            {(ruleItems || []).map((item, index) => (
                                <li key={`${index}-${item}`} className="rule-item">{item}</li>
                            ))}
                        </ol>
                    </div>
                </>
            )}
        </aside>
    );
};

export default GameRightStatusPanel;
