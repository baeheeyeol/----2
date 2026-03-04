import React, { useEffect, useMemo, useRef, useState } from 'react';
import './chess.css';
import GameResultBanner from '../shared/game-result-banner';
import GameLeftStatusPanel from '../shared/game-left-status-panel';
import GameRightStatusPanel from '../shared/game-right-status-panel';
import { playGameSound } from '../../utils/game-sound';
import { useTurnFeedback } from '../../hooks/useTurnFeedback';
import { useChessComputedState } from '@/hooks/game';
import { getPieceEvaluationValue } from '@/ai';
import {
    DEFAULT_STONE_CAPTURE_WIN_TARGET,
    FORMATION_KEYS,
    JANGGI_FORMATIONS,
    OMOK_CONNECT_TARGET,
    PIECE_COLOR_HEX,
} from '@/game/constants';
import {
    applyMoveOnBoard,
    applyOmokSuffocation,
    buildBoardFromPlacements,
    clearFrozenForSide,
    countCapturedOmokStones,
    createEmptyBoard,
    createPiece,
    getDefaultPieceTypes,
    getDefaultPlacementsForSide,
    getFactionLabel,
    getFormationOrRandom,
    getFormationOrDefault,
    getJanggiPalaceSet,
    getLegalMoves,
    getPieceSymbol,
    getSideFaction,
    hasAnyEscapeMove,
    hasOmokConnectTarget,
    inBounds,
    isOmokStone,
    isKingInCheck,
    normalizeFaction,
} from '@/game/rules/chessRules';

const DEFAULT_GAME_SETUP = {
    started: false,
    firstTurn: null,
    turnSide: null,
    winner: null,
    winnerReason: null,
    battleBoard: null,
    lastMove: null,
    capturedBySide: { top: [], bottom: [] },
    p1Lives: 3,
    p2Lives: 3,
    p1Ready: false,
    p2Ready: false,
    p1Mode: 'formation',
    p2Mode: 'formation',
    p1Formation: null,
    p2Formation: null,
    p1CustomLayout: [],
    p2CustomLayout: [],
};

// 배치 목록을 좌표 키 기반 맵으로 변환합니다.
const toMap = (placements) => {
    const map = new Map();
    placements.forEach((item) => {
        map.set(`${item.row}-${item.col}`, item);
    });
    return map;
};

const BOT_ID_PREFIX = '[BOT';
const BOT_LEVEL2_MIN_DELAY = 360;
const BOT_LEVEL2_MAX_DELAY = 760;
const normalizeBotLevel = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 2;
    return Math.min(3, Math.max(1, Math.floor(parsed)));
};

const isBotUserId = (value) => typeof value === 'string' && value.startsWith(BOT_ID_PREFIX);

const getCenterBonus = (row, col, size = 8) => {
    const center = (size - 1) / 2;
    const distance = Math.abs(row - center) + Math.abs(col - center);
    return Math.max(0, 6 - distance);
};

const getOmokLineLength = (board, side, row, col) => {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    let best = 1;

    dirs.forEach(([dr, dc]) => {
        let count = 1;
        let nr = row + dr;
        let nc = col + dc;
        while (inBounds(nr, nc) && isOmokStone(board[nr][nc]) && board[nr][nc].side === side) {
            count += 1;
            nr += dr;
            nc += dc;
        }

        nr = row - dr;
        nc = col - dc;
        while (inBounds(nr, nc) && isOmokStone(board[nr][nc]) && board[nr][nc].side === side) {
            count += 1;
            nr -= dr;
            nc -= dc;
        }

        if (count > best) best = count;
    });

    return best;
};

const pickHeuristicOmokMove = (board, side) => {
    let best = null;

    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            if (board[row][col]) continue;

            const boardWithStone = board.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
            boardWithStone[row][col] = createPiece('omok', 'stone', side, true);
            const { nextBoard, removedPieces } = applyOmokSuffocation(boardWithStone);

            const wonByConnect5 = hasOmokConnectTarget(nextBoard, side, row, col, OMOK_CONNECT_TARGET);
            const kingKilled = removedPieces.some((piece) => piece.type === 'king');
            const lineScore = getOmokLineLength(nextBoard, side, row, col);
            const centerScore = getCenterBonus(row, col, 8);

            const score =
                (wonByConnect5 ? 200000 : 0)
                + (kingKilled ? 160000 : 0)
                + removedPieces.length * 220
                + lineScore * 38
                + centerScore;

            if (!best || score > best.score || (score === best.score && Math.random() > 0.5)) {
                best = { row, col, score };
            }
        }
    }

    return best;
};

const pickRandomOmokMove = (board) => {
    const emptyCells = [];
    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            if (!board[row][col]) {
                emptyCells.push({ row, col });
            }
        }
    }

    if (emptyCells.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randomIndex] || null;
};

const isSquareThreatenedByOpponent = (board, side, row, col, lastMove) => {
    const opponentSide = side === 'top' ? 'bottom' : 'top';

    for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
            const piece = board[r][c];
            if (!piece || piece.side !== opponentSide || piece.frozen) continue;
            const moves = getLegalMoves(board, r, c, lastMove, opponentSide);
            if (moves.some((move) => move.row === row && move.col === col)) {
                return true;
            }
        }
    }

    return false;
};

const pickHeuristicPieceMove = ({ board, side, lastMove, capturedBySide, stoneCaptureWinTarget }) => {
    let best = null;

    for (let fromRow = 0; fromRow < 8; fromRow += 1) {
        for (let fromCol = 0; fromCol < 8; fromCol += 1) {
            const moving = board[fromRow][fromCol];
            if (!moving || moving.side !== side || moving.frozen) continue;

            const candidateMoves = getLegalMoves(board, fromRow, fromCol, lastMove, side);
            for (const move of candidateMoves) {
                const { nextBoard, movedPiece, captured } = applyMoveOnBoard(board, { row: fromRow, col: fromCol }, move);
                if (!movedPiece) continue;

                const thawedBoard = clearFrozenForSide(nextBoard, side);
                if (isOmokStone(captured)) {
                    const updatedMover = thawedBoard[move.row][move.col];
                    if (updatedMover) {
                        thawedBoard[move.row][move.col] = { ...updatedMover, frozen: true };
                    }
                }
                const finalMovedPiece = thawedBoard[move.row][move.col] || movedPiece;

                const nextCapturedBySide = {
                    top: [...(capturedBySide.top || [])],
                    bottom: [...(capturedBySide.bottom || [])],
                };
                if (captured) {
                    nextCapturedBySide[side].push(captured);
                }

                const capturedStoneCount = countCapturedOmokStones(nextCapturedBySide[side]);
                const wonByStoneCapture = capturedStoneCount >= stoneCaptureWinTarget;
                const nextLastMove = {
                    piece: finalMovedPiece,
                    from: { row: fromRow, col: fromCol },
                    to: { row: move.row, col: move.col },
                    wasDoubleStep:
                        finalMovedPiece.faction === 'chess'
                        && finalMovedPiece.type === 'pawn'
                        && Math.abs(move.row - fromRow) === 2,
                };

                let score = 0;
                score += getCenterBonus(move.row, move.col, 8) * 2;
                score += (move.isCastle ? 18 : 0);
                score += (captured ? getPieceEvaluationValue(captured, { row: move.row, boardRows: 8 }) * 14 + 50 : 0);
                score += (wonByStoneCapture ? 120000 : 0);
                score += (captured?.type === 'king' ? 180000 : 0);

                if (isSquareThreatenedByOpponent(thawedBoard, side, move.row, move.col, nextLastMove)) {
                    score -= getPieceEvaluationValue(finalMovedPiece, { row: move.row, boardRows: 8 }) * 7;
                }

                if (!best || score > best.score || (score === best.score && Math.random() > 0.5)) {
                    best = {
                        from: { row: fromRow, col: fromCol },
                        to: move,
                        score,
                    };
                }
            }
        }
    }

    return best;
};

const pickRandomPieceMove = ({ board, side, lastMove }) => {
    const allMoves = [];

    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            const piece = board[row][col];
            if (!piece || piece.side !== side || piece.frozen) continue;
            const legal = getLegalMoves(board, row, col, lastMove, side);
            legal.forEach((to) => {
                allMoves.push({ from: { row, col }, to });
            });
        }
    }

    if (allMoves.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * allMoves.length);
    return allMoves[randomIndex] || null;
};

// 체스/장기/오목 통합 대전 보드를 렌더링합니다.
const Chess = ({ room, user, onUpdateRoomSettings }) => {
    const myKey = user?.id === room?.p1 ? 'p1' : 'p2';
    const opponentKey = myKey === 'p1' ? 'p2' : 'p1';
    const isHost = user?.id === room?.p1;

    const myFaction = normalizeFaction(room?.[`${myKey}Faction`]);
    const opponentFaction = normalizeFaction(room?.[`${opponentKey}Faction`]);
    const p1Side = normalizeFaction(room?.p1Faction) === 'chess' && normalizeFaction(room?.p2Faction) !== 'chess'
        ? 'bottom'
        : normalizeFaction(room?.p2Faction) === 'chess' && normalizeFaction(room?.p1Faction) !== 'chess'
            ? 'top'
            : 'bottom';
    const p2Side = p1Side === 'bottom' ? 'top' : 'bottom';
    const sideToUserId = {
        [p1Side]: room?.p1,
        [p2Side]: room?.p2,
    };

    const mySide = myKey === 'p1' ? p1Side : p2Side;
    const opponentSide = myKey === 'p1' ? p2Side : p1Side;
    const isFlipped = mySide === 'top';
    const myColorCode = room?.[`${myKey}Color`] || (isHost ? 'white' : 'black');
    const opponentColorCode = room?.[`${opponentKey}Color`] || (isHost ? 'black' : 'white');
    const myPieceColor = PIECE_COLOR_HEX[myColorCode] || PIECE_COLOR_HEX.white;
    const opponentPieceColor = PIECE_COLOR_HEX[opponentColorCode] || PIECE_COLOR_HEX.black;

    const gameSetup = { ...DEFAULT_GAME_SETUP, ...(room?.gameSetup || {}) };
    const myMode = gameSetup[`${myKey}Mode`] || 'formation';
    const opponentMode = gameSetup[`${opponentKey}Mode`] || 'formation';
    const myFormation = getFormationOrDefault(gameSetup[`${myKey}Formation`]);
    const opponentFormation = getFormationOrDefault(gameSetup[`${opponentKey}Formation`]);
    const isCustomAllowed = myFaction === 'janggi';
    const effectiveMyMode = isCustomAllowed ? myMode : 'formation';

    const [selectedPalette, setSelectedPalette] = useState(null);
    const [battleBoard, setBattleBoard] = useState(createEmptyBoard());
    const [selectedCell, setSelectedCell] = useState(null);
    const [legalMoves, setLegalMoves] = useState([]);
    const [turnSide, setTurnSide] = useState('bottom');
    const [winner, setWinner] = useState(null);
    const [winnerReason, setWinnerReason] = useState(null);
    const [lastMove, setLastMove] = useState(null);
    const [capturedBySide, setCapturedBySide] = useState({ top: [], bottom: [] });
    const [warningSoundEnabled, setWarningSoundEnabled] = useState(true);
    const [frozenNoticeVisible, setFrozenNoticeVisible] = useState(false);
    const frozenNoticeTimerRef = useRef(null);
    const botTurnTimerRef = useRef(null);
    const botWorkerRef = useRef(null);
    const botWorkerRequestSeqRef = useRef(0);
    const botWorkerPendingRef = useRef(new Map());

    const myCustomLayout = Array.isArray(gameSetup[`${myKey}CustomLayout`]) ? gameSetup[`${myKey}CustomLayout`] : [];
    const opponentCustomLayout = Array.isArray(gameSetup[`${opponentKey}CustomLayout`]) ? gameSetup[`${opponentKey}CustomLayout`] : [];

    const playEventSound = (soundKey) => {
        playGameSound(soundKey, { enabled: warningSoundEnabled });
    };

    const requestBotWorkerMove = (payload) => {
        if (!botWorkerRef.current) {
            return Promise.resolve(null);
        }

        return new Promise((resolve) => {
            const requestId = `${Date.now()}-${botWorkerRequestSeqRef.current++}`;
            const timeout = window.setTimeout(() => {
                botWorkerPendingRef.current.delete(requestId);
                resolve(null);
            }, 1800);

            botWorkerPendingRef.current.set(requestId, {
                resolve: (move) => {
                    window.clearTimeout(timeout);
                    resolve(move || null);
                },
            });

            botWorkerRef.current.postMessage({ ...payload, requestId });
        });
    };

    // 게임 설정 패치를 서버에 반영합니다.
    const emitSetupPatch = (patch) => {
        const next = { ...gameSetup, ...patch };
        if (room?.isBotRoom && isBotUserId(sideToUserId[p2Side])) {
            next.p2Ready = true;
        }
        onUpdateRoomSettings?.({ gameSetup: next });
    };

    // 화면 좌표를 실제 보드 좌표로 변환합니다.
    const mapDisplayToBoard = (displayRow, displayCol) => {
        if (!isFlipped) return { row: displayRow, col: displayCol };
        return { row: 7 - displayRow, col: 7 - displayCol };
    };

    // 실제 보드 좌표를 화면 좌표로 변환합니다.
    const mapBoardToDisplay = (row, col) => {
        if (!isFlipped) return { row, col };
        return { row: 7 - row, col: 7 - col };
    };

    // 내 커스텀 배치 가능 영역인지 확인합니다.
    const isMyDisplaySetupZone = (displayRow) => displayRow >= 5;

    // 보드/배치/예비기물/제한값 계산을 전용 훅으로 분리합니다.
    const {
        normalizedMyLayout,
        setupTopPlacements,
        setupBottomPlacements,
        setupBoard,
        unplacedPool,
        myReady,
        opponentReady,
        canToggleReady,
        turnLimitSeconds,
        stoneCaptureWinTarget,
        formationPreviewItems,
    } = useChessComputedState({
        gameSetup,
        myKey,
        opponentKey,
        room,
        myCustomLayout,
        opponentCustomLayout,
        myFaction,
        opponentFaction,
        mySide,
        opponentSide,
        myFormation,
        opponentFormation,
        opponentMode,
        effectiveMyMode,
        inBounds,
        getDefaultPlacementsForSide,
        getDefaultPieceTypes,
        buildBoardFromPlacements,
        formationKeys: FORMATION_KEYS,
        janggiFormations: JANGGI_FORMATIONS,
        defaultStoneCaptureWinTarget: DEFAULT_STONE_CAPTURE_WIN_TARGET,
    });

    // 턴 타임아웃 시 호스트가 턴을 강제 전환합니다.
    const handleTurnTimeout = () => {
        const nextTurn = turnSide === 'top' ? 'bottom' : 'top';

        setTurnSide(nextTurn);
        setSelectedCell(null);
        setLegalMoves([]);

        emitSetupPatch({
            started: true,
            turnSide: nextTurn,
            winner: null,
            winnerReason: null,
        });
    };

    // 턴 제한/경고/시작 안내/승패 사운드를 단일 훅으로 처리합니다.
    const { remainingSeconds, turnStartNotice } = useTurnFeedback({
        started: !!gameSetup.started,
        winner,
        turnToken: turnSide,
        firstTurnSide: gameSetup.firstTurn,
        currentTurnSide: turnSide,
        mySide,
        limitSeconds: turnLimitSeconds,
        isHost,
        warningEnabled: warningSoundEnabled,
        onWarning: () => playEventSound('warning'),
        onTimeout: handleTurnTimeout,
        playEventSound,
    });

    // 선택된 팔레트 기물이 소진되면 남아 있는 첫 기물로 자동 선택을 이동합니다.
    useEffect(() => {
        if (!selectedPalette) return;
        const stillExists = unplacedPool.some((item) => item.id === selectedPalette.id);
        if (!stillExists) {
            setSelectedPalette(unplacedPool[0] || null);
        }
    }, [selectedPalette, unplacedPool]);

    // 자율배치 불가 진영은 모드를 강제로 formation으로 되돌립니다.
    useEffect(() => {
        if (isCustomAllowed) return;
        if (myMode !== 'custom') return;

        emitSetupPatch({
            [`${myKey}Mode`]: 'formation',
            [`${myKey}Ready`]: false,
            started: false,
        });
    }, [isCustomAllowed, myMode]);

    // 서버 gameSetup을 로컬 전투 상태와 동기화합니다.
    useEffect(() => {
        if (!gameSetup.started) return;
        const board = Array.isArray(gameSetup.battleBoard) && gameSetup.battleBoard.length === 8
            ? gameSetup.battleBoard
            : buildBoardFromPlacements(setupTopPlacements, setupBottomPlacements);

        setBattleBoard(board);
        setSelectedCell(null);
        setLegalMoves([]);
        setTurnSide(gameSetup.turnSide || gameSetup.firstTurn || 'bottom');
        setWinner(gameSetup.winner || null);
        setWinnerReason(gameSetup.winnerReason || null);
        setLastMove(gameSetup.lastMove || null);
        setCapturedBySide(gameSetup.capturedBySide || { top: [], bottom: [] });
    }, [
        gameSetup.started,
        gameSetup.firstTurn,
        gameSetup.turnSide,
        gameSetup.winner,
        gameSetup.winnerReason,
        gameSetup.lastMove,
        gameSetup.capturedBySide,
        gameSetup.battleBoard,
        setupTopPlacements,
        setupBottomPlacements,
    ]);

    // 컴포넌트 종료 시 동결 안내 타이머를 정리합니다.
    useEffect(() => {
        return () => {
            if (frozenNoticeTimerRef.current) {
                clearTimeout(frozenNoticeTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const worker = new Worker(new URL('../../workers/bot-worker.js', import.meta.url), { type: 'module' });
        botWorkerRef.current = worker;

        worker.onmessage = (event) => {
            const { requestId, move } = event.data || {};
            if (!requestId) return;

            const pending = botWorkerPendingRef.current.get(requestId);
            if (!pending) return;

            botWorkerPendingRef.current.delete(requestId);
            pending.resolve(move || null);
        };

        return () => {
            botWorkerPendingRef.current.forEach((pending) => pending.resolve(null));
            botWorkerPendingRef.current.clear();
            worker.terminate();
            botWorkerRef.current = null;
        };
    }, []);

    // 커스텀 배치 정보를 갱신합니다.
    const updateCustomLayout = (nextLayout) => {
        emitSetupPatch({
            [`${myKey}CustomLayout`]: nextLayout,
            [`${myKey}Ready`]: false,
            started: false,
        });
    };

    // 선택한 기물을 커스텀 배치판에 놓습니다.
    const placeCustomPiece = (displayRow, displayCol, pieceType) => {
        if (effectiveMyMode !== 'custom' || gameSetup.started || !pieceType) return;
        if (!isMyDisplaySetupZone(displayRow)) return;

        const { row, col } = mapDisplayToBoard(displayRow, displayCol);
        const boardAtTarget = setupBoard[row][col];
        if (boardAtTarget && boardAtTarget.side !== mySide) return;

        const nextLayout = normalizedMyLayout.filter((item) => !(item.row === row && item.col === col));
        nextLayout.push({ type: pieceType, row, col, faction: myFaction });
        updateCustomLayout(nextLayout);
    };

    // 커스텀 배치된 기물을 보드에서 제거합니다.
    const handleBoardPieceRemove = (displayRow, displayCol) => {
        if (effectiveMyMode !== 'custom' || gameSetup.started) return;
        const { row, col } = mapDisplayToBoard(displayRow, displayCol);
        const nextLayout = normalizedMyLayout.filter((item) => !(item.row === row && item.col === col));
        if (nextLayout.length !== normalizedMyLayout.length) {
            updateCustomLayout(nextLayout);
        }
    };

    // 보드 셀 클릭 동작(배치/이동)을 처리합니다.
    const applyOmokPlacementMove = (row, col) => {
        const clicked = battleBoard[row][col];
        if (clicked) return false;

        const boardWithStone = battleBoard.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
        boardWithStone[row][col] = createPiece('omok', 'stone', turnSide, true);

        const { nextBoard: afterSuffocation, removedPieces } = applyOmokSuffocation(boardWithStone);
        const nextCapturedBySide = {
            top: [...capturedBySide.top],
            bottom: [...capturedBySide.bottom],
        };
        if (removedPieces.length > 0) {
            nextCapturedBySide[turnSide].push(...removedPieces);
        }
        playEventSound(removedPieces.length > 0 ? 'capture' : 'move');

        const nextTurn = turnSide === 'top' ? 'bottom' : 'top';
        const wonByConnect5 = hasOmokConnectTarget(afterSuffocation, turnSide, row, col, OMOK_CONNECT_TARGET);
        const kingKilled = removedPieces.some((piece) => piece.type === 'king');
        const nextWinner = wonByConnect5 || kingKilled ? turnSide : null;
        const nextWinnerReason = wonByConnect5 ? 'connect5' : kingKilled ? 'capture' : null;

        setBattleBoard(afterSuffocation);
        setSelectedCell(null);
        setLegalMoves([]);
        setCapturedBySide(nextCapturedBySide);
        setWinner(nextWinner);
        setWinnerReason(nextWinnerReason);
        setTurnSide(nextTurn);

        emitSetupPatch({
            started: true,
            battleBoard: afterSuffocation,
            turnSide: nextTurn,
            winner: nextWinner,
            winnerReason: nextWinnerReason,
            lastMove: {
                piece: boardWithStone[row][col],
                from: null,
                to: { row, col },
                wasDoubleStep: false,
            },
            capturedBySide: nextCapturedBySide,
        });

        return true;
    };

    const applyPieceBattleMove = (fromCell, validMove) => {
        const moving = battleBoard[fromCell.row][fromCell.col];
        if (!moving) return false;

        const { nextBoard, movedPiece, captured } = applyMoveOnBoard(battleBoard, fromCell, validMove);
        if (!movedPiece) return false;

        const thawedBoard = clearFrozenForSide(nextBoard, turnSide);
        const capturedStone = isOmokStone(captured);
        if (capturedStone) {
            const updatedMover = thawedBoard[validMove.row][validMove.col];
            if (updatedMover) {
                thawedBoard[validMove.row][validMove.col] = { ...updatedMover, frozen: true };
            }
        }
        const finalMovedPiece = thawedBoard[validMove.row][validMove.col] || movedPiece;

        const nextCapturedBySide = {
            top: [...capturedBySide.top],
            bottom: [...capturedBySide.bottom],
        };
        if (captured) {
            nextCapturedBySide[turnSide].push(captured);
        }
        playEventSound(captured ? 'capture' : 'move');

        const capturedStoneCount = countCapturedOmokStones(nextCapturedBySide[turnSide]);
        const wonByStoneCapture = capturedStoneCount >= stoneCaptureWinTarget;

        const nextTurn = turnSide === 'top' ? 'bottom' : 'top';
        const nextLastMove = {
            piece: finalMovedPiece,
            from: fromCell,
            to: { row: validMove.row, col: validMove.col },
            wasDoubleStep:
                finalMovedPiece.faction === 'chess'
                && finalMovedPiece.type === 'pawn'
                && Math.abs(validMove.row - fromCell.row) === 2,
        };

        const nextWinner = wonByStoneCapture || captured?.type === 'king' ? turnSide : null;
        const nextWinnerReason = wonByStoneCapture || captured?.type === 'king' ? 'capture' : null;

        setBattleBoard(thawedBoard);
        setLastMove(nextLastMove);
        setSelectedCell(null);
        setLegalMoves([]);
        setCapturedBySide(nextCapturedBySide);
        setWinner(nextWinner);
        setWinnerReason(nextWinnerReason);
        setTurnSide(nextTurn);

        emitSetupPatch({
            started: true,
            battleBoard: thawedBoard,
            turnSide: nextTurn,
            winner: nextWinner,
            winnerReason: nextWinnerReason,
            lastMove: nextLastMove,
            capturedBySide: nextCapturedBySide,
        });

        return true;
    };

    const handleCellClick = (displayRow, displayCol) => {
        const { row, col } = mapDisplayToBoard(displayRow, displayCol);

        if (!gameSetup.started) {
            if (effectiveMyMode !== 'custom') return;
            const current = setupBoard[row][col];
            if (current?.side === mySide && !selectedPalette) {
                handleBoardPieceRemove(displayRow, displayCol);
                return;
            }
            if (!selectedPalette) return;
            placeCustomPiece(displayRow, displayCol, selectedPalette.type);
            return;
        }

        if (winner) return;
        const currentTurnUserId = sideToUserId[turnSide];
        if (currentTurnUserId && user?.id !== currentTurnUserId) return;
        const currentTurnFaction = getSideFaction(room, turnSide);
        const clicked = battleBoard[row][col];

        if (clicked?.side === turnSide && clicked?.frozen) {
            setSelectedCell(null);
            setLegalMoves([]);
            setFrozenNoticeVisible(true);
            if (frozenNoticeTimerRef.current) {
                clearTimeout(frozenNoticeTimerRef.current);
            }
            frozenNoticeTimerRef.current = setTimeout(() => {
                setFrozenNoticeVisible(false);
                frozenNoticeTimerRef.current = null;
            }, 1700);
            return;
        }

        if (currentTurnFaction === 'omok') {
            applyOmokPlacementMove(row, col);
            return;
        }

        if (selectedCell) {
            const validMove = legalMoves.find((move) => move.row === row && move.col === col);
            if (validMove) {
                applyPieceBattleMove(selectedCell, validMove);
                return;
            }
        }

        if (!clicked || clicked.side !== turnSide) {
            setSelectedCell(null);
            setLegalMoves([]);
            return;
        }

        setSelectedCell({ row, col });
        const rawMoves = getLegalMoves(battleBoard, row, col, lastMove, turnSide);
        setLegalMoves(rawMoves);
    };

    useEffect(() => {
        if (!gameSetup.started || winner) return;

        const currentTurnUserId = sideToUserId[turnSide];
        if (!isBotUserId(currentTurnUserId)) return;
        const botLevel = normalizeBotLevel(room?.botLevel);

        if (botTurnTimerRef.current) {
            clearTimeout(botTurnTimerRef.current);
        }

        const delay = BOT_LEVEL2_MIN_DELAY + Math.floor(Math.random() * (BOT_LEVEL2_MAX_DELAY - BOT_LEVEL2_MIN_DELAY + 1));

        botTurnTimerRef.current = window.setTimeout(async () => {
            botTurnTimerRef.current = null;

            const sideFactions = {
                top: getSideFaction(room, 'top'),
                bottom: getSideFaction(room, 'bottom'),
            };
            const turnFaction = sideFactions[turnSide] || getSideFaction(room, turnSide);

            if (turnFaction === 'omok') {
                const omokMove = botLevel === 3
                    ? await requestBotWorkerMove({
                        variant: 'chess',
                        mode: 'omok',
                        level: botLevel,
                        board: battleBoard,
                        side: turnSide,
                        turnFaction,
                        sideFactions,
                    })
                    : botLevel === 1
                        ? pickRandomOmokMove(battleBoard)
                        : pickHeuristicOmokMove(battleBoard, turnSide);
                if (omokMove) {
                    applyOmokPlacementMove(omokMove.row, omokMove.col);
                }
                return;
            }

            let pieceMove = null;

            if (botLevel === 3) {
                pieceMove = await requestBotWorkerMove({
                    variant: 'chess',
                    mode: 'piece',
                    level: botLevel,
                    board: battleBoard,
                    side: turnSide,
                    lastMove,
                    turnFaction,
                    sideFactions,
                });
            } else if (botLevel === 2) {
                pieceMove = pickHeuristicPieceMove({
                    board: battleBoard,
                    side: turnSide,
                    lastMove,
                    capturedBySide,
                    stoneCaptureWinTarget,
                });
            } else {
                pieceMove = pickRandomPieceMove({
                    board: battleBoard,
                    side: turnSide,
                    lastMove,
                });
            }

            if (pieceMove) {
                applyPieceBattleMove(pieceMove.from, pieceMove.to);
                return;
            }

            const nextTurn = turnSide === 'top' ? 'bottom' : 'top';
            setTurnSide(nextTurn);
            setSelectedCell(null);
            setLegalMoves([]);
            emitSetupPatch({
                started: true,
                turnSide: nextTurn,
                winner: null,
                winnerReason: null,
            });
        }, delay);

        return () => {
            if (botTurnTimerRef.current) {
                clearTimeout(botTurnTimerRef.current);
                botTurnTimerRef.current = null;
            }
        };
    }, [
        gameSetup.started,
        winner,
        sideToUserId,
        turnSide,
        room,
        room?.botLevel,
        battleBoard,
        lastMove,
        capturedBySide,
        stoneCaptureWinTarget,
    ]);

    // 팔레트 기물 드래그 시작 데이터를 설정합니다.
    const handleDragStartPalette = (event, piece) => {
        event.dataTransfer.setData('text/piece-type', piece.type);
    };

    // 보드 기물 드래그 시작 데이터를 설정합니다.
    const handleDragStartBoardPiece = (event, displayRow, displayCol) => {
        const { row, col } = mapDisplayToBoard(displayRow, displayCol);
        const target = setupBoard[row][col];
        if (!target || target.side !== mySide || effectiveMyMode !== 'custom' || gameSetup.started) return;
        event.dataTransfer.setData('text/piece-type', target.type);
        event.dataTransfer.setData('text/from', `${row}-${col}`);
    };

    // 드롭된 기물을 대상 셀에 배치합니다.
    const handleDropCell = (event, displayRow, displayCol) => {
        if (effectiveMyMode !== 'custom' || gameSetup.started) return;
        event.preventDefault();
        const pieceType = event.dataTransfer.getData('text/piece-type');
        if (!pieceType) return;

        const from = event.dataTransfer.getData('text/from');
        if (from) {
            const [fromRow, fromCol] = from.split('-').map(Number);
            const nextLayout = normalizedMyLayout.filter((item) => !(item.row === fromRow && item.col === fromCol));
            const { row, col } = mapDisplayToBoard(displayRow, displayCol);
            if (!isMyDisplaySetupZone(displayRow)) return;
            const current = setupBoard[row][col];
            if (current?.side !== mySide && current) return;
            nextLayout.push({ type: pieceType, row, col, faction: myFaction });
            updateCustomLayout(nextLayout);
            return;
        }

        placeCustomPiece(displayRow, displayCol, pieceType);
    };

    // 드롭 가능 상태일 때 기본 동작을 막습니다.
    const handleAllowDrop = (event) => {
        if (effectiveMyMode !== 'custom' || gameSetup.started) return;
        event.preventDefault();
    };

    // 내 준비 상태를 토글합니다.
    const toggleMyReady = () => {
        if (!canToggleReady) return;
        emitSetupPatch({ [`${myKey}Ready`]: !myReady, started: false });
    };

    // 배치 모드(기본/커스텀) 변경을 처리합니다.
    const handleModeChange = (nextMode) => {
        if (nextMode === 'custom' && !isCustomAllowed) return;
        emitSetupPatch({
            [`${myKey}Mode`]: nextMode,
            [`${myKey}Ready`]: false,
            started: false,
        });
    };

    // 장기 포진 선택 값을 반영합니다.
    const handleFormationSelect = (key) => {
        emitSetupPatch({
            [`${myKey}Formation`]: key,
            [`${myKey}Ready`]: false,
            started: false,
        });
    };

    const botRoomReady = !!room?.isBotRoom && !!room?.p1Ready && !!room?.p2Ready;
    const setupReady = !!gameSetup.p1Ready && !!gameSetup.p2Ready;
    const canHostStart = isHost && (setupReady || botRoomReady);

    // 양측 준비 완료 시 실제 대전을 시작합니다.
    const startBattle = () => {
        if (!canHostStart) return;
        const firstTurn = Math.random() < 0.5 ? 'bottom' : 'top';
        const initialBoard = buildBoardFromPlacements(setupTopPlacements, setupBottomPlacements);

        emitSetupPatch({
            started: true,
            firstTurn,
            turnSide: firstTurn,
            winner: null,
            winnerReason: null,
            battleBoard: initialBoard,
            lastMove: null,
            capturedBySide: { top: [], bottom: [] },
            p1Lives: 3,
            p2Lives: 3,
            p1Ready: false,
            p2Ready: false,
            p1Mode: 'formation',
            p2Mode: 'formation',
            p1Formation: getFormationOrRandom(gameSetup.p1Formation),
            p2Formation: getFormationOrRandom(gameSetup.p2Formation),
        });
    };

    // 진행 중 게임 상태를 초기화하고 로비로 복귀합니다.
    const handleExitToRoomLobby = () => {
        onUpdateRoomSettings?.({
            p1Ready: false,
            p2Ready: false,
            gameSetup: {
                started: false,
                firstTurn: null,
                turnSide: null,
                winner: null,
                winnerReason: null,
                battleBoard: null,
                lastMove: null,
                capturedBySide: { top: [], bottom: [] },
                p1Lives: 3,
                p2Lives: 3,
                p1Ready: false,
                p2Ready: false,
            },
        });
    };

    const moveKeySet = new Set(legalMoves.map((move) => `${move.row}-${move.col}`));

    const myCaptured = capturedBySide[mySide] || [];
    const janggiPalaceSet = useMemo(
        () => getJanggiPalaceSet({ p1Faction: room?.p1Faction, p2Faction: room?.p2Faction }),
        [room?.p1Faction, room?.p2Faction],
    );

    // 화면 셀 기준으로 렌더링용 메타 정보를 계산합니다.
    const getCellDataByDisplay = (displayRow, displayCol) => {
        const { row, col } = mapDisplayToBoard(displayRow, displayCol);
        const boardSource = gameSetup.started ? battleBoard : setupBoard;
        const key = `${row}-${col}`;
        const isJanggiPalace = janggiPalaceSet.has(key);
        const hasTop = janggiPalaceSet.has(`${row - 1}-${col}`);
        const hasBottom = janggiPalaceSet.has(`${row + 1}-${col}`);
        const hasLeft = janggiPalaceSet.has(`${row}-${col - 1}`);
        const hasRight = janggiPalaceSet.has(`${row}-${col + 1}`);
        return {
            boardRow: row,
            boardCol: col,
            piece: boardSource[row][col],
            isSelected: selectedCell?.row === row && selectedCell?.col === col,
            isLegal: moveKeySet.has(`${row}-${col}`),
            isJanggiPalace,
            palaceTopEdge: isJanggiPalace && !hasTop,
            palaceBottomEdge: isJanggiPalace && !hasBottom,
            palaceLeftEdge: isJanggiPalace && !hasLeft,
            palaceRightEdge: isJanggiPalace && !hasRight,
        };
    };

    // 진영에 맞는 말 색상을 반환합니다.
    const getPieceColorBySide = (side) => (side === mySide ? myPieceColor : opponentPieceColor);

    const uiOpponentReady = opponentReady || (room?.isBotRoom && isBotUserId(sideToUserId[opponentSide]));
    const opponentStatusText = uiOpponentReady ? '준비 완료' : '준비 중';
    const myStatusText = myReady ? '준비 완료' : '준비 중';
    const firstTurnSide = gameSetup.firstTurn || turnSide;
    const firstTurnUserId = sideToUserId[firstTurnSide] || (firstTurnSide === 'bottom' ? '체스' : '장기');
    const currentTurnUserId = sideToUserId[turnSide] || (turnSide === 'bottom' ? '체스' : '장기');
    const winnerUserId = winner ? sideToUserId[winner] : null;
    const loserUserId = winner ? sideToUserId[winner === 'top' ? 'bottom' : 'top'] : null;
    const winnerFaction = winner ? getSideFaction(room, winner) : null;
    const winnerCapturedStoneCount = winner ? countCapturedOmokStones(capturedBySide[winner] || []) : 0;
    const isStoneCaptureWin = winnerReason === 'capture' && winnerFaction !== 'omok' && winnerCapturedStoneCount >= stoneCaptureWinTarget;
    const winnerReasonLabel = winnerReason === 'checkmate'
        ? '체크메이트'
        : winnerReason === 'connect5'
            ? `${OMOK_CONNECT_TARGET}목 완성`
            : winnerReason === 'capture'
                ? (isStoneCaptureWin ? `돌 ${stoneCaptureWinTarget}개 제거` : '왕/궁 포획')
                : winnerReason === 'timeout'
                    ? '시간패'
                    : '';
    const topUserId = sideToUserId.top || (normalizeFaction(room?.p1Faction) === 'janggi' ? room?.p1 : room?.p2) || 'TOP';
    const bottomUserId = sideToUserId.bottom || (normalizeFaction(room?.p1Faction) === 'chess' ? room?.p1 : room?.p2) || 'BOTTOM';
    const activeSide = gameSetup.started ? turnSide : firstTurnSide;
    const hasOmokPlayer = myFaction === 'omok' || opponentFaction === 'omok';
    const commonRules = [
        '공용: 턴 시간이 0초가 되면 상대 턴으로 자동 전환됩니다.',
        '공용: 왕/궁을 포획하면 즉시 승리합니다.',
    ];
    if (hasOmokPlayer) {
        commonRules.push(
            '공용(오목전): 오목 돌은 벽입니다. (나이트/마/상 제외)',
            '공용(오목전): 비오목 기물은 돌을 밟아 파괴할 수 있습니다.',
            '공용(오목전): 돌을 파괴한 기물은 1턴 동결됩니다.',
            '공용(오목전): 오목이 상하좌우 4방향 포위하면 기물이 제거됩니다.',
            `공용(오목전): 비오목 진영은 돌 ${stoneCaptureWinTarget}개 제거 시 승리합니다.`,
        );
    }

    const sideRules = [];
    if (myFaction === 'omok') {
        sideRules.push(`내 진영(오목): ${OMOK_CONNECT_TARGET}목 완성 시 승리합니다.`);
    }
    if (opponentFaction === 'omok') {
        sideRules.push(`상대 진영(오목): ${OMOK_CONNECT_TARGET}목 완성 시 승리합니다.`);
    }

    const ruleItems = [...commonRules, ...sideRules];
    const leftAlertType = null;
    const alertSide = null;
    const leftAlertText = '';

    return (
        <div className="chess-board-wrapper">
            <div className="chess-layout">
                {/* 좌측 패널: 턴/타이머/경고음 토글/알림 상태 표시 */}
                <GameLeftStatusPanel
                    topUserId={topUserId}
                    bottomUserId={bottomUserId}
                    activeSide={activeSide}
                    firstTurnUserId={firstTurnUserId}
                    remainingSeconds={remainingSeconds}
                    warningSoundEnabled={warningSoundEnabled}
                    onToggleWarningSound={() => setWarningSoundEnabled((prev) => !prev)}
                    alertSide={alertSide}
                    alertType={leftAlertType}
                    alertText={leftAlertText}
                />

                <div className="chess-board-area">
                    <div className={`chess-board ${!gameSetup.started && effectiveMyMode === 'custom' ? 'setup-custom' : ''}`} role="grid" aria-label="체스 vs 장기 보드">
                        {Array.from({ length: 8 }, (_, displayRow) =>
                            Array.from({ length: 8 }, (_, displayCol) => {
                                const { piece, isSelected, isLegal, isJanggiPalace, palaceTopEdge, palaceBottomEdge, palaceLeftEdge, palaceRightEdge } = getCellDataByDisplay(displayRow, displayCol);
                                const isDark = (displayRow + displayCol) % 2 === 1;

                                return (
                                    <button
                                        key={`${displayRow}-${displayCol}`}
                                        type="button"
                                        className={`chess-cell ${isDark ? 'dark' : 'light'} ${isJanggiPalace ? 'janggi-palace-cell' : ''} ${palaceTopEdge ? 'palace-edge-top' : ''} ${palaceBottomEdge ? 'palace-edge-bottom' : ''} ${palaceLeftEdge ? 'palace-edge-left' : ''} ${palaceRightEdge ? 'palace-edge-right' : ''} ${isSelected ? 'selected' : ''} ${isLegal ? 'legal' : ''}`}
                                        role="gridcell"
                                        onClick={() => handleCellClick(displayRow, displayCol)}
                                        onDragOver={handleAllowDrop}
                                        onDrop={(event) => handleDropCell(event, displayRow, displayCol)}
                                    >
                                        {piece && (
                                            <span
                                                draggable={!gameSetup.started && effectiveMyMode === 'custom' && piece.side === mySide}
                                                onDragStart={(event) => handleDragStartBoardPiece(event, displayRow, displayCol)}
                                                className={`chess-piece ${piece.side === mySide ? 'mine' : 'opponent'} ${piece.faction === 'janggi' ? 'janggi-token-piece' : ''} ${piece.faction === 'omok' ? 'omok-stone-piece' : ''} ${piece.frozen ? 'frozen' : ''} ${!gameSetup.started && effectiveMyMode === 'custom' ? 'custom-setup-piece' : ''}`}
                                                style={{ color: getPieceColorBySide(piece.side) }}
                                            >
                                                {getPieceSymbol(piece)}
                                            </span>
                                        )}
                                    </button>
                                );
                            }),
                        )}
                    </div>
                    {turnStartNotice && (
                        <>
                            <div className="turn-start-backdrop" aria-hidden="true" />
                            <div className="turn-start-notice" role="status" aria-live="polite">
                                {turnStartNotice}
                            </div>
                        </>
                    )}
                    {frozenNoticeVisible && (
                        <div className="frozen-notice" role="status" aria-live="polite">
                            동결 상태: 이 기물은 이번 턴에 움직일 수 없습니다.
                        </div>
                    )}
                </div>

                {/* 우측 패널: 준비/시작/룰/포획/배치 UI를 담당 */}
                <GameRightStatusPanel
                    myReady={myReady}
                    opponentReady={uiOpponentReady}
                    myStatusText={myStatusText}
                    opponentStatusText={opponentStatusText}
                    canToggleReady={canToggleReady}
                    gameStarted={gameSetup.started}
                    onToggleReady={toggleMyReady}
                    showStartButton={isHost}
                    canHostStart={canHostStart}
                    onStart={startBattle}
                    customReadyHint={!canToggleReady && effectiveMyMode === 'custom' ? '자율선택 모드에서는 모든 기물을 배치해야 준비할 수 있습니다.' : ''}
                    ruleItems={ruleItems}
                    capturedPieces={myCaptured}
                    renderCapturedPiece={(piece) => (
                        <span
                            key={piece.id}
                            className={`reserve-piece captured-piece ${piece.faction === 'omok' ? 'captured-omok-stone' : ''}`}
                            style={{ color: getPieceColorBySide(piece.side) }}
                        >
                            {getPieceSymbol(piece)}
                        </span>
                    )}
                    setupChildren={(
                        <div className="reserve-area">
                            <div className="reserve-title">배치 모드</div>
                            <div className="mode-row">
                                <button
                                    type="button"
                                    className={`mode-btn ${effectiveMyMode === 'formation' ? 'active' : ''}`}
                                    onClick={() => handleModeChange('formation')}
                                >
                                    상차림 선택
                                </button>
                                <button
                                    type="button"
                                    className={`mode-btn ${effectiveMyMode === 'custom' ? 'active' : ''}`}
                                    onClick={() => handleModeChange('custom')}
                                    disabled={!isCustomAllowed}
                                >
                                    자율선택
                                </button>
                            </div>

                            {!isCustomAllowed && <div className="reserve-hint">체스 진영은 자율선택을 사용할 수 없습니다.</div>}

                            {myFaction === 'janggi' && effectiveMyMode === 'formation' && (
                                <div className="formation-list">
                                    {formationPreviewItems.map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            className={`formation-card ${myFormation === item.key ? 'active' : ''}`}
                                            onClick={() => handleFormationSelect(item.key)}
                                            disabled={effectiveMyMode !== 'formation'}
                                        >
                                            <strong>{item.label}</strong>
                                            <span>{item.preview}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {effectiveMyMode === 'custom' && (
                                <>
                                    <div className="reserve-title">예비 기물 ({unplacedPool.length})</div>
                                    <div className="reserve-list">
                                        {unplacedPool.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={`reserve-piece ${selectedPalette?.id === item.id ? 'active' : ''} ${effectiveMyMode === 'custom' ? 'custom-setup-palette' : ''}`}
                                                onClick={() => setSelectedPalette(item)}
                                                draggable
                                                onDragStart={(event) => handleDragStartPalette(event, item)}
                                                style={{ color: myPieceColor }}
                                            >
                                                {getPieceSymbol({ faction: myFaction, type: item.type, side: mySide })}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="reserve-hint">클릭 선택 후 배치하거나 드래그해서 배치할 수 있습니다.</div>
                                    <div className="reserve-hint">내 화면 기준 하단 3줄에서만 배치 가능합니다.</div>
                                </>
                            )}
                        </div>
                    )}
                />

                <GameResultBanner
                    isVisible={!!winner}
                    winnerId={winnerUserId}
                    loserId={loserUserId}
                    onExit={handleExitToRoomLobby}
                />
            </div>
        </div>
    );
};

export default Chess;

// 룰 문자열을 화면 표준 룰 값으로 정규화합니다.
const normalizeRule = (rule) => {
    const ruleMap = {
        auto: GAME_RULES.FREE,
        AUTO: GAME_RULES.FREE,
        FREE: GAME_RULES.FREE,
        RANDOM: GAME_RULES.RANDOM,
        HOST: GAME_RULES.HOST,
        [GAME_RULES.FREE]: GAME_RULES.FREE,
        [GAME_RULES.RANDOM]: GAME_RULES.RANDOM,
        [GAME_RULES.HOST]: GAME_RULES.HOST,
    };

    return ruleMap[rule] || GAME_RULES.FREE;
};

// 진영 코드에 해당하는 진영 메타 정보를 반환합니다.
const getFactionByCode = (factionCode, fallback = FACTIONS.CHESS) => {
    return Object.values(FACTIONS).find(f => f.code === factionCode) || fallback;
};

// 방 상세 화면과 참가자 준비 상태 UI를 처리합니다.
const RoomPage = ({ room, user, onLeave, onUpdateRoomSettings }) => {
    // ...existing code...

    // 랜덤 배정 시 주사위 롤링 애니메이션을 실행합니다.
    const triggerDiceRollEffect = () => {
        if (diceRollTimerRef.current) {
            clearTimeout(diceRollTimerRef.current);
        }

        setIsDiceRolling(true);
        diceRollTimerRef.current = setTimeout(() => {
            setIsDiceRolling(false);
            diceRollTimerRef.current = null;
        }, 800);
    };

    // 준비 버튼 클릭 시 현재 사용자 준비 상태를 토글합니다.
    const handleReadyClick = () => {
        if (!isP2Joined) return;
        onUpdateRoomSettings?.(isHost ? { p1Ready: !isP1Ready } : { p2Ready: !isP2Ready });
    };

    // 방 규칙 변경을 서버에 반영합니다.
    const handleRuleChange = (e) => {
        // ...existing code...
    };

    // ...existing code...
};

export { RoomPage };
