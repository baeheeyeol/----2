import React, { useEffect, useMemo, useState } from 'react';
import GameResultBanner from '../shared/game-result-banner';
import './omok.css';

const SIZE = 15;

const createBoard = () => Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));

const countLine = (board, row, col, dr, dc, color) => {
    let count = 0;
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r][c] === color) {
        count += 1;
        r += dr;
        c += dc;
    }
    return count;
};

const isFive = (board, row, col, color) => {
    const dirs = [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
    ];
    return dirs.some(([dr, dc]) => {
        const total = 1 + countLine(board, row, col, dr, dc, color) + countLine(board, row, col, -dr, -dc, color);
        return total >= 5;
    });
};

const Omok = ({ room, user, onUpdateRoomSettings }) => {
    const isHost = user?.id === room?.p1;
    const myKey = isHost ? 'p1' : 'p2';
    const opponentKey = myKey === 'p1' ? 'p2' : 'p1';

    const gameSetup = {
        started: false,
        firstTurn: null,
        turnSide: null,
        winner: null,
        winnerReason: null,
        battleBoard: null,
        p1Ready: false,
        p2Ready: false,
        ...(room?.gameSetup || {}),
    };

    const mySide = myKey === 'p1' ? 'top' : 'bottom';
    const myStone = mySide === 'top' ? 'black' : 'white';
    const currentTurn = gameSetup.turnSide || 'top';
    const currentTurnUserId = currentTurn === 'top' ? room?.p1 : room?.p2;

    const board = useMemo(() => {
        if (Array.isArray(gameSetup.battleBoard) && gameSetup.battleBoard.length === SIZE) {
            return gameSetup.battleBoard;
        }
        return createBoard();
    }, [gameSetup.battleBoard]);

    const emitSetupPatch = (patch) => {
        onUpdateRoomSettings?.({ gameSetup: { ...gameSetup, ...patch } });
    };

    const toggleReady = () => {
        emitSetupPatch({ [`${myKey}Ready`]: !gameSetup[`${myKey}Ready`], started: false });
    };

    const canHostStart = isHost && gameSetup.p1Ready && gameSetup.p2Ready;

    const startGame = () => {
        if (!canHostStart) return;
        emitSetupPatch({
            started: true,
            firstTurn: 'top',
            turnSide: 'top',
            winner: null,
            winnerReason: null,
            battleBoard: createBoard(),
        });
    };

    const onCellClick = (row, col) => {
        if (!gameSetup.started || gameSetup.winner) return;
        if (currentTurnUserId && currentTurnUserId !== user?.id) return;
        if (board[row][col]) return;

        const nextBoard = board.map((line) => line.slice());
        const color = currentTurn === 'top' ? 'black' : 'white';
        nextBoard[row][col] = color;

        const won = isFive(nextBoard, row, col, color);
        const nextTurn = currentTurn === 'top' ? 'bottom' : 'top';

        emitSetupPatch({
            started: true,
            battleBoard: nextBoard,
            turnSide: nextTurn,
            winner: won ? currentTurn : null,
            winnerReason: won ? 'connect5' : null,
        });
    };

    const winnerId = gameSetup.winner === 'top' ? room?.p1 : gameSetup.winner === 'bottom' ? room?.p2 : null;
    const loserId = gameSetup.winner === 'top' ? room?.p2 : gameSetup.winner === 'bottom' ? room?.p1 : null;

    return (
        <div className="omok-wrap">
            <div className="omok-topbar">
                <div className="omok-status">현재 턴: {currentTurnUserId || '-'}</div>
                <div className="omok-status">내 돌: {myStone === 'black' ? '흑' : '백'}</div>
            </div>

            <div className="omok-board" role="grid" aria-label="오목판">
                {board.map((row, r) =>
                    row.map((cell, c) => (
                        <button key={`${r}-${c}`} type="button" className="omok-cell" onClick={() => onCellClick(r, c)}>
                            {cell && <span className={`omok-stone ${cell}`} />}
                        </button>
                    )),
                )}
            </div>

            <div className="omok-actions">
                <button type="button" className={`omok-btn ${gameSetup[`${myKey}Ready`] ? 'ready' : ''}`} onClick={toggleReady}>
                    {gameSetup[`${myKey}Ready`] ? '준비 취소' : '준비'}
                </button>
                {isHost && (
                    <button type="button" className="omok-btn" onClick={startGame} disabled={!canHostStart || gameSetup.started}>
                        시작
                    </button>
                )}
            </div>

            <GameResultBanner isVisible={!!gameSetup.winner} winnerId={winnerId} loserId={loserId} reason={gameSetup.winnerReason === 'connect5' ? '오목 완성' : ''} />
        </div>
    );
};

export default Omok;
