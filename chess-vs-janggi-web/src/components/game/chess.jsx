import React, { useEffect, useMemo, useRef, useState } from 'react';
import './chess.css';
import GameResultBanner from '../shared/game-result-banner';
import GameLeftStatusPanel from '../shared/game-left-status-panel';
import GameRightStatusPanel from '../shared/game-right-status-panel';

const CHESS_LABELS = {
    top: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
    bottom: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
};

const JANGGI_LABELS = {
    king: '帥',
    guard: '士',
    elephant: '象',
    horse: '馬',
    rook: '車',
    cannon: '包',
    soldier: '卒',
};

const JANGGI_FORMATIONS = {
    an_sang: { label: '안상차림', order: ['horse', 'elephant', 'elephant', 'horse'], preview: '마-상-상-마' },
    an_ma: { label: '안마차림', order: ['elephant', 'horse', 'horse', 'elephant'], preview: '상-마-마-상' },
    left_sang: { label: '왼상차림', order: ['elephant', 'horse', 'elephant', 'horse'], preview: '상-마-상-마' },
    right_sang: { label: '오른상차림', order: ['horse', 'elephant', 'horse', 'elephant'], preview: '마-상-마-상' },
};

const FORMATION_KEYS = Object.keys(JANGGI_FORMATIONS);

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

const PIECE_COLOR_HEX = {
    white: '#f7fafc',
    black: '#111827',
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
    gold: '#eab308',
    purple: '#a855f7',
};

const createEmptyBoard = () => Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

const inBounds = (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8;

const getDirection = (side) => (side === 'top' ? 1 : -1);

const isInsidePalace = (side, row, col) => {
    const rowMin = side === 'top' ? 0 : 5;
    const rowMax = side === 'top' ? 2 : 7;
    return row >= rowMin && row <= rowMax && col >= 3 && col <= 4;
};

const normalizeFaction = (value) => {
    if (!value) return 'chess';
    const lower = String(value).toLowerCase();
    if (lower.includes('janggi') || value === '장기') return 'janggi';
    return 'chess';
};

const createPiece = (faction, type, side, moved = false) => ({
    id: `${faction}-${type}-${side}-${Math.random().toString(36).slice(2, 10)}`,
    faction,
    type,
    side,
    moved,
});

const getPieceSymbol = (piece) => {
    if (!piece) return '';
    if (piece.faction === 'chess') {
        return CHESS_LABELS[piece.side]?.[piece.type] || '♟';
    }
    return JANGGI_LABELS[piece.type] || '卒';
};

const getFormationOrRandom = (value) => {
    if (value && FORMATION_KEYS.includes(value)) return value;
    return FORMATION_KEYS[Math.floor(Math.random() * FORMATION_KEYS.length)];
};

const getFormationOrDefault = (value) => {
    if (value && FORMATION_KEYS.includes(value)) return value;
    return FORMATION_KEYS[0];
};

const getDefaultPieceTypes = (faction, formationKey) => {
    if (faction === 'chess') {
        return ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'];
    }

    const formation = JANGGI_FORMATIONS[getFormationOrRandom(formationKey)];
    const [f1, f2, f3, f4] = formation.order;
    return ['rook', f1, f2, 'guard', 'king', f3, f4, 'rook', 'cannon', 'soldier', 'soldier', 'soldier', 'soldier', 'soldier', 'soldier', 'cannon'];
};

const getDefaultPlacementsForSide = (faction, side, formationKey) => {
    const placements = [];
    if (faction === 'chess') {
        const back = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        const front = ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'];
        const backRow = side === 'top' ? 0 : 7;
        const frontRow = side === 'top' ? 1 : 6;
        back.forEach((type, col) => placements.push({ type, row: backRow, col, faction }));
        front.forEach((type, col) => placements.push({ type, row: frontRow, col, faction }));
        return placements;
    }

    const formation = JANGGI_FORMATIONS[getFormationOrRandom(formationKey)];
    const [f1, f2, f3, f4] = formation.order;
    const back = ['rook', f1, f2, 'guard', 'king', f3, f4, 'rook'];
    const front = ['cannon', 'soldier', 'soldier', 'soldier', 'soldier', 'soldier', 'soldier', 'cannon'];
    const backRow = side === 'top' ? 0 : 7;
    const frontRow = side === 'top' ? 1 : 6;
    back.forEach((type, col) => placements.push({ type, row: backRow, col, faction }));
    front.forEach((type, col) => placements.push({ type, row: frontRow, col, faction }));
    return placements;
};

const buildBoardFromPlacements = (topPlacements, bottomPlacements) => {
    const board = createEmptyBoard();
    topPlacements.forEach((placement) => {
        if (!inBounds(placement.row, placement.col)) return;
        board[placement.row][placement.col] = createPiece(placement.faction, placement.type, 'top');
    });
    bottomPlacements.forEach((placement) => {
        if (!inBounds(placement.row, placement.col)) return;
        board[placement.row][placement.col] = createPiece(placement.faction, placement.type, 'bottom');
    });
    return board;
};

const addMoveIfValid = (moves, board, side, row, col, extra = {}) => {
    if (!inBounds(row, col)) return;
    const target = board[row][col];
    if (target && target.side === side) return;
    moves.push({ row, col, ...extra });
};

const getSlidingMoves = (board, piece, row, col, directions) => {
    const moves = [];
    directions.forEach(([dr, dc]) => {
        let r = row + dr;
        let c = col + dc;
        while (inBounds(r, c)) {
            const target = board[r][c];
            if (!target) {
                moves.push({ row: r, col: c });
            } else {
                if (target.side !== piece.side) {
                    moves.push({ row: r, col: c });
                }
                break;
            }
            r += dr;
            c += dc;
        }
    });
    return moves;
};

const getChessMoves = (board, piece, row, col, lastMove) => {
    const moves = [];
    const dir = getDirection(piece.side);

    if (piece.type === 'pawn') {
        const oneForward = row + dir;
        if (inBounds(oneForward, col) && !board[oneForward][col]) {
            moves.push({ row: oneForward, col });
            const twoForward = row + dir * 2;
            if (!piece.moved && inBounds(twoForward, col) && !board[twoForward][col]) {
                moves.push({ row: twoForward, col, isDoubleStep: true });
            }
        }

        [-1, 1].forEach((dc) => {
            const tr = row + dir;
            const tc = col + dc;
            if (!inBounds(tr, tc)) return;
            const target = board[tr][tc];
            if (target && target.side !== piece.side) {
                moves.push({ row: tr, col: tc });
            }
        });

        if (lastMove?.piece?.faction === 'chess' && lastMove.piece.type === 'pawn' && lastMove.wasDoubleStep) {
            const { to } = lastMove;
            if (to.row === row && Math.abs(to.col - col) === 1) {
                const captureRow = row + dir;
                moves.push({ row: captureRow, col: to.col, isEnPassant: true, captureAt: { row, col: to.col } });
            }
        }

        return moves;
    }

    if (piece.type === 'rook') {
        return getSlidingMoves(board, piece, row, col, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
    }

    if (piece.type === 'bishop') {
        return getSlidingMoves(board, piece, row, col, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    }

    if (piece.type === 'queen') {
        return getSlidingMoves(board, piece, row, col, [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
    }

    if (piece.type === 'knight') {
        const jumps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        jumps.forEach(([dr, dc]) => addMoveIfValid(moves, board, piece.side, row + dr, col + dc));
        return moves;
    }

    if (piece.type === 'king') {
        const around = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        around.forEach(([dr, dc]) => addMoveIfValid(moves, board, piece.side, row + dr, col + dc));

        if (!piece.moved) {
            const leftRook = board[row][0];
            const rightRook = board[row][7];
            if (leftRook?.faction === 'chess' && leftRook.type === 'rook' && leftRook.side === piece.side && !leftRook.moved) {
                if (!board[row][1] && !board[row][2] && !board[row][3]) {
                    moves.push({ row, col: 2, isCastle: true, rookFrom: { row, col: 0 }, rookTo: { row, col: 3 } });
                }
            }
            if (rightRook?.faction === 'chess' && rightRook.type === 'rook' && rightRook.side === piece.side && !rightRook.moved) {
                if (!board[row][5] && !board[row][6]) {
                    moves.push({ row, col: 6, isCastle: true, rookFrom: { row, col: 7 }, rookTo: { row, col: 5 } });
                }
            }
        }

        return moves;
    }

    return moves;
};

const getJanggiMoves = (board, piece, row, col) => {
    const moves = [];
    const dir = getDirection(piece.side);

    if (piece.type === 'soldier') {
        addMoveIfValid(moves, board, piece.side, row + dir, col);
        addMoveIfValid(moves, board, piece.side, row, col - 1);
        addMoveIfValid(moves, board, piece.side, row, col + 1);
        return moves;
    }

    if (piece.type === 'rook') {
        return getSlidingMoves(board, piece, row, col, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
    }

    if (piece.type === 'cannon') {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
            let r = row + dr;
            let c = col + dc;
            let screenFound = false;

            while (inBounds(r, c)) {
                const target = board[r][c];

                if (!screenFound) {
                    if (!target) {
                        r += dr;
                        c += dc;
                        continue;
                    }
                    if (target.type === 'cannon') {
                        break;
                    }
                    screenFound = true;
                    r += dr;
                    c += dc;
                    continue;
                }

                if (!target) {
                    moves.push({ row: r, col: c });
                    r += dr;
                    c += dc;
                    continue;
                }

                if (target.side !== piece.side && target.type !== 'cannon') {
                    moves.push({ row: r, col: c });
                }
                break;
            }
        });
        return moves;
    }

    if (piece.type === 'horse') {
        const patterns = [
            { block: [-1, 0], targets: [[-2, -1], [-2, 1]] },
            { block: [1, 0], targets: [[2, -1], [2, 1]] },
            { block: [0, -1], targets: [[-1, -2], [1, -2]] },
            { block: [0, 1], targets: [[-1, 2], [1, 2]] },
        ];
        patterns.forEach(({ block, targets }) => {
            const br = row + block[0];
            const bc = col + block[1];
            if (!inBounds(br, bc) || board[br][bc]) return;
            targets.forEach(([dr, dc]) => addMoveIfValid(moves, board, piece.side, row + dr, col + dc));
        });
        return moves;
    }

    if (piece.type === 'elephant') {
        const patterns = [
            { b1: [-1, 0], b2: [-2, -1], target: [-3, -2] },
            { b1: [-1, 0], b2: [-2, 1], target: [-3, 2] },
            { b1: [1, 0], b2: [2, -1], target: [3, -2] },
            { b1: [1, 0], b2: [2, 1], target: [3, 2] },
            { b1: [0, -1], b2: [-1, -2], target: [-2, -3] },
            { b1: [0, -1], b2: [1, -2], target: [2, -3] },
            { b1: [0, 1], b2: [-1, 2], target: [-2, 3] },
            { b1: [0, 1], b2: [1, 2], target: [2, 3] },
        ];

        patterns.forEach(({ b1, b2, target }) => {
            const b1r = row + b1[0];
            const b1c = col + b1[1];
            const b2r = row + b2[0];
            const b2c = col + b2[1];
            const tr = row + target[0];
            const tc = col + target[1];
            if (!inBounds(b1r, b1c) || !inBounds(b2r, b2c) || !inBounds(tr, tc)) return;
            if (board[b1r][b1c] || board[b2r][b2c]) return;
            addMoveIfValid(moves, board, piece.side, tr, tc);
        });

        return moves;
    }

    if (piece.type === 'king' || piece.type === 'guard') {
        const around = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        around.forEach(([dr, dc]) => {
            const tr = row + dr;
            const tc = col + dc;
            if (!isInsidePalace(piece.side, tr, tc)) return;
            addMoveIfValid(moves, board, piece.side, tr, tc);
        });
        return moves;
    }

    return moves;
};

const getLegalMoves = (board, row, col, lastMove) => {
    const piece = board[row][col];
    if (!piece) return [];
    if (piece.faction === 'chess') return getChessMoves(board, piece, row, col, lastMove);
    return getJanggiMoves(board, piece, row, col);
};

const applyMoveOnBoard = (board, from, move) => {
    const moving = board[from.row][from.col];
    if (!moving) {
        return { nextBoard: board, movedPiece: null, captured: null };
    }

    const nextBoard = board.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
    let captured = nextBoard[move.row][move.col];

    if (move.isEnPassant && move.captureAt) {
        captured = nextBoard[move.captureAt.row][move.captureAt.col];
        nextBoard[move.captureAt.row][move.captureAt.col] = null;
    }

    nextBoard[from.row][from.col] = null;
    const movedPiece = { ...moving, moved: true };
    nextBoard[move.row][move.col] = movedPiece;

    if (move.isCastle && move.rookFrom && move.rookTo) {
        const rook = nextBoard[move.rookFrom.row][move.rookFrom.col];
        if (rook) {
            nextBoard[move.rookFrom.row][move.rookFrom.col] = null;
            nextBoard[move.rookTo.row][move.rookTo.col] = { ...rook, moved: true };
        }
    }

    if (movedPiece.faction === 'chess' && movedPiece.type === 'pawn') {
        const promoteRow = movedPiece.side === 'top' ? 7 : 0;
        if (move.row === promoteRow) {
            nextBoard[move.row][move.col] = { ...movedPiece, type: 'queen' };
        }
    }

    return { nextBoard, movedPiece: nextBoard[move.row][move.col], captured };
};

const findKingCell = (board, side) => {
    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            const piece = board[row][col];
            if (piece?.side === side && piece.type === 'king') {
                return { row, col };
            }
        }
    }
    return null;
};

const isKingInCheck = (board, side, lastMove) => {
    const kingCell = findKingCell(board, side);
    if (!kingCell) return false;

    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            const piece = board[row][col];
            if (!piece || piece.side === side) continue;
            const moves = getLegalMoves(board, row, col, lastMove);
            if (moves.some((move) => move.row === kingCell.row && move.col === kingCell.col)) {
                return true;
            }
        }
    }
    return false;
};

const hasAnyEscapeMove = (board, side, lastMove) => {
    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            const piece = board[row][col];
            if (!piece || piece.side !== side) continue;
            const moves = getLegalMoves(board, row, col, lastMove);
            for (const move of moves) {
                const { nextBoard } = applyMoveOnBoard(board, { row, col }, move);
                if (!isKingInCheck(nextBoard, side, lastMove)) {
                    return true;
                }
            }
        }
    }
    return false;
};

const toMap = (placements) => {
    const map = new Map();
    placements.forEach((item) => {
        map.set(`${item.row}-${item.col}`, item);
    });
    return map;
};

const Chess = ({ room, user, onUpdateRoomSettings }) => {
    const myKey = user?.id === room?.p1 ? 'p1' : 'p2';
    const opponentKey = myKey === 'p1' ? 'p2' : 'p1';
    const isHost = user?.id === room?.p1;

    const myFaction = normalizeFaction(room?.[`${myKey}Faction`]);
    const opponentFaction = normalizeFaction(room?.[`${opponentKey}Faction`]);
    const p1Side = normalizeFaction(room?.p1Faction) === 'chess' ? 'bottom' : 'top';
    const p2Side = normalizeFaction(room?.p2Faction) === 'chess' ? 'bottom' : 'top';
    const sideToUserId = {
        [p1Side]: room?.p1,
        [p2Side]: room?.p2,
    };

    const mySide = myFaction === 'chess' ? 'bottom' : 'top';
    const opponentSide = opponentFaction === 'chess' ? 'bottom' : 'top';
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
    const [remainingSeconds, setRemainingSeconds] = useState(60);
    const [warningSoundEnabled, setWarningSoundEnabled] = useState(true);
    const lastWarningBeepSecondRef = useRef(null);

    const myCustomLayout = Array.isArray(gameSetup[`${myKey}CustomLayout`]) ? gameSetup[`${myKey}CustomLayout`] : [];
    const opponentCustomLayout = Array.isArray(gameSetup[`${opponentKey}CustomLayout`]) ? gameSetup[`${opponentKey}CustomLayout`] : [];

    const emitSetupPatch = (patch) => {
        const next = { ...gameSetup, ...patch };
        onUpdateRoomSettings?.({ gameSetup: next });
    };

    const mapDisplayToBoard = (displayRow, displayCol) => {
        if (!isFlipped) return { row: displayRow, col: displayCol };
        return { row: 7 - displayRow, col: 7 - displayCol };
    };

    const mapBoardToDisplay = (row, col) => {
        if (!isFlipped) return { row, col };
        return { row: 7 - row, col: 7 - col };
    };

    const isMyDisplaySetupZone = (displayRow) => displayRow >= 5;

    const normalizedMyLayout = useMemo(() => myCustomLayout.filter((item) => inBounds(item.row, item.col) && item.faction === myFaction), [myCustomLayout, myFaction]);
    const normalizedOpponentLayout = useMemo(
        () => opponentCustomLayout.filter((item) => inBounds(item.row, item.col) && item.faction === opponentFaction),
        [opponentCustomLayout, opponentFaction],
    );

    const myDefaultPlacements = useMemo(() => getDefaultPlacementsForSide(myFaction, mySide, myFormation), [myFaction, mySide, myFormation]);
    const opponentDefaultPlacements = useMemo(
        () => getDefaultPlacementsForSide(opponentFaction, opponentSide, opponentFormation),
        [opponentFaction, opponentSide, opponentFormation],
    );

    const setupTopPlacements = useMemo(() => {
        if (mySide === 'top') {
            return effectiveMyMode === 'custom' ? normalizedMyLayout : myDefaultPlacements;
        }
        return opponentSide === 'top'
            ? (opponentMode === 'custom' ? normalizedOpponentLayout : opponentDefaultPlacements)
            : [];
    }, [mySide, effectiveMyMode, normalizedMyLayout, myDefaultPlacements, opponentSide, opponentMode, normalizedOpponentLayout, opponentDefaultPlacements]);

    const setupBottomPlacements = useMemo(() => {
        if (mySide === 'bottom') {
            return effectiveMyMode === 'custom' ? normalizedMyLayout : myDefaultPlacements;
        }
        return opponentSide === 'bottom'
            ? (opponentMode === 'custom' ? normalizedOpponentLayout : opponentDefaultPlacements)
            : [];
    }, [mySide, effectiveMyMode, normalizedMyLayout, myDefaultPlacements, opponentSide, opponentMode, normalizedOpponentLayout, opponentDefaultPlacements]);

    const setupBoard = useMemo(() => buildBoardFromPlacements(setupTopPlacements, setupBottomPlacements), [setupTopPlacements, setupBottomPlacements]);

    const poolTypes = useMemo(() => getDefaultPieceTypes(myFaction, myFormation), [myFaction, myFormation]);
    const placedCountByType = useMemo(() => {
        const map = new Map();
        normalizedMyLayout.forEach((item) => map.set(item.type, (map.get(item.type) || 0) + 1));
        return map;
    }, [normalizedMyLayout]);

    const unplacedPool = useMemo(() => {
        const temp = new Map(placedCountByType);
        return poolTypes
            .map((type, index) => {
                const used = temp.get(type) || 0;
                if (used > 0) {
                    temp.set(type, used - 1);
                    return null;
                }
                return { id: `${type}-${index}`, type };
            })
            .filter(Boolean);
    }, [poolTypes, placedCountByType]);

    const myReady = !!gameSetup[`${myKey}Ready`];
    const opponentReady = !!gameSetup[`${opponentKey}Ready`];
    const canToggleReady = effectiveMyMode !== 'custom' || unplacedPool.length === 0;
    const turnLimitSeconds = Number.isFinite(Number(room?.turnSeconds)) ? Math.min(600, Math.max(1, Math.floor(Number(room.turnSeconds)))) : 60;
    const p1Lives = Number.isFinite(Number(gameSetup.p1Lives)) ? Math.min(3, Math.max(0, Math.floor(Number(gameSetup.p1Lives)))) : 3;
    const p2Lives = Number.isFinite(Number(gameSetup.p2Lives)) ? Math.min(3, Math.max(0, Math.floor(Number(gameSetup.p2Lives)))) : 3;

    const formationPreviewItems = useMemo(
        () => FORMATION_KEYS.map((key) => ({ key, ...JANGGI_FORMATIONS[key] })),
        [],
    );

    useEffect(() => {
        if (!selectedPalette) return;
        const stillExists = unplacedPool.some((item) => item.id === selectedPalette.id);
        if (!stillExists) {
            setSelectedPalette(unplacedPool[0] || null);
        }
    }, [selectedPalette, unplacedPool]);

    useEffect(() => {
        if (isCustomAllowed) return;
        if (myMode !== 'custom') return;

        emitSetupPatch({
            [`${myKey}Mode`]: 'formation',
            [`${myKey}Ready`]: false,
            started: false,
        });
    }, [isCustomAllowed, myMode]);

    useEffect(() => {
        if (!gameSetup.started) return;
        const board = Array.isArray(gameSetup.battleBoard) && gameSetup.battleBoard.length === 8
            ? gameSetup.battleBoard
            : buildBoardFromPlacements(
                opponentSide === 'top' ? (opponentMode === 'custom' ? normalizedOpponentLayout : opponentDefaultPlacements) : (mySide === 'top' ? (effectiveMyMode === 'custom' ? normalizedMyLayout : myDefaultPlacements) : []),
                opponentSide === 'bottom' ? (opponentMode === 'custom' ? normalizedOpponentLayout : opponentDefaultPlacements) : (mySide === 'bottom' ? (effectiveMyMode === 'custom' ? normalizedMyLayout : myDefaultPlacements) : []),
            );

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
        mySide,
        effectiveMyMode,
        opponentSide,
        opponentMode,
        normalizedMyLayout,
        normalizedOpponentLayout,
        myDefaultPlacements,
        opponentDefaultPlacements,
    ]);

    useEffect(() => {
        if (!gameSetup.started) {
            setRemainingSeconds(turnLimitSeconds);
            lastWarningBeepSecondRef.current = null;
            return;
        }
        setRemainingSeconds(turnLimitSeconds);
        lastWarningBeepSecondRef.current = null;
    }, [gameSetup.started, turnSide, turnLimitSeconds]);

    useEffect(() => {
        if (!gameSetup.started || winner || !warningSoundEnabled) return;
        if (remainingSeconds <= 0 || remainingSeconds > 5) return;
        if (lastWarningBeepSecondRef.current === remainingSeconds) return;

        lastWarningBeepSecondRef.current = remainingSeconds;

        try {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextCtor) return;
            const context = new AudioContextCtor();
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = 'square';
            oscillator.frequency.value = 880;
            gain.gain.setValueAtTime(0.0001, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(context.currentTime);
            oscillator.stop(context.currentTime + 0.18);

            oscillator.onended = () => {
                context.close().catch(() => { });
            };
        } catch (error) {
        }
    }, [gameSetup.started, winner, remainingSeconds, warningSoundEnabled]);

    useEffect(() => {
        if (!gameSetup.started || winner) return;
        const timerId = setInterval(() => {
            setRemainingSeconds((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timerId);
    }, [gameSetup.started, winner, turnSide, turnLimitSeconds]);

    useEffect(() => {
        if (!gameSetup.started || winner) return;
        if (remainingSeconds > 0) return;
        if (!isHost) return;

        const loserSide = turnSide;
        const nextTurn = loserSide === 'top' ? 'bottom' : 'top';
        const loserIsP1 = loserSide === p1Side;
        const nextP1Lives = loserIsP1 ? Math.max(0, p1Lives - 1) : p1Lives;
        const nextP2Lives = loserIsP1 ? p2Lives : Math.max(0, p2Lives - 1);
        const loserLives = loserIsP1 ? nextP1Lives : nextP2Lives;

        if (loserLives <= 0) {
            const timeoutWinner = nextTurn;
            setWinner(timeoutWinner);
            setWinnerReason('timeout');

            emitSetupPatch({
                started: true,
                turnSide: timeoutWinner,
                winner: timeoutWinner,
                winnerReason: 'timeout',
                p1Lives: nextP1Lives,
                p2Lives: nextP2Lives,
            });
            return;
        }

        setTurnSide(nextTurn);
        setSelectedCell(null);
        setLegalMoves([]);

        emitSetupPatch({
            started: true,
            turnSide: nextTurn,
            winner: null,
            winnerReason: null,
            p1Lives: nextP1Lives,
            p2Lives: nextP2Lives,
        });
    }, [remainingSeconds, gameSetup.started, winner, isHost, turnSide, p1Side, p1Lives, p2Lives]);

    const updateCustomLayout = (nextLayout) => {
        emitSetupPatch({
            [`${myKey}CustomLayout`]: nextLayout,
            [`${myKey}Ready`]: false,
            started: false,
        });
    };

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

    const handleBoardPieceRemove = (displayRow, displayCol) => {
        if (effectiveMyMode !== 'custom' || gameSetup.started) return;
        const { row, col } = mapDisplayToBoard(displayRow, displayCol);
        const nextLayout = normalizedMyLayout.filter((item) => !(item.row === row && item.col === col));
        if (nextLayout.length !== normalizedMyLayout.length) {
            updateCustomLayout(nextLayout);
        }
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
        const clicked = battleBoard[row][col];

        if (selectedCell) {
            const validMove = legalMoves.find((move) => move.row === row && move.col === col);
            if (validMove) {
                const moving = battleBoard[selectedCell.row][selectedCell.col];
                if (!moving) return;

                const { nextBoard, movedPiece, captured } = applyMoveOnBoard(battleBoard, selectedCell, validMove);
                if (!movedPiece) return;

                const nextCapturedBySide = {
                    top: [...capturedBySide.top],
                    bottom: [...capturedBySide.bottom],
                };
                if (captured) {
                    nextCapturedBySide[turnSide].push(captured);
                }

                const nextTurn = turnSide === 'top' ? 'bottom' : 'top';
                const nextLastMove = {
                    piece: movedPiece,
                    from: selectedCell,
                    to: { row: validMove.row, col: validMove.col },
                    wasDoubleStep:
                        movedPiece.faction === 'chess' &&
                        movedPiece.type === 'pawn' &&
                        Math.abs(validMove.row - selectedCell.row) === 2,
                };

                const nextWinner = captured?.type === 'king' ? turnSide : null;
                const nextWinnerReason = captured?.type === 'king' ? 'capture' : null;

                setBattleBoard(nextBoard);
                setLastMove(nextLastMove);
                setSelectedCell(null);
                setLegalMoves([]);
                setCapturedBySide(nextCapturedBySide);
                setWinner(nextWinner);
                setWinnerReason(nextWinnerReason);
                setTurnSide(nextTurn);

                emitSetupPatch({
                    started: true,
                    battleBoard: nextBoard,
                    turnSide: nextTurn,
                    winner: nextWinner,
                    winnerReason: nextWinnerReason,
                    lastMove: nextLastMove,
                    capturedBySide: nextCapturedBySide,
                });
                return;
            }
        }

        if (!clicked || clicked.side !== turnSide) {
            setSelectedCell(null);
            setLegalMoves([]);
            return;
        }

        setSelectedCell({ row, col });
        const rawMoves = getLegalMoves(battleBoard, row, col, lastMove);
        setLegalMoves(rawMoves);
    };

    const handleDragStartPalette = (event, piece) => {
        event.dataTransfer.setData('text/piece-type', piece.type);
    };

    const handleDragStartBoardPiece = (event, displayRow, displayCol) => {
        const { row, col } = mapDisplayToBoard(displayRow, displayCol);
        const target = setupBoard[row][col];
        if (!target || target.side !== mySide || effectiveMyMode !== 'custom' || gameSetup.started) return;
        event.dataTransfer.setData('text/piece-type', target.type);
        event.dataTransfer.setData('text/from', `${row}-${col}`);
    };

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

    const handleAllowDrop = (event) => {
        if (effectiveMyMode !== 'custom' || gameSetup.started) return;
        event.preventDefault();
    };

    const toggleMyReady = () => {
        if (!canToggleReady) return;
        emitSetupPatch({ [`${myKey}Ready`]: !myReady, started: false });
    };

    const handleModeChange = (nextMode) => {
        if (nextMode === 'custom' && !isCustomAllowed) return;
        emitSetupPatch({
            [`${myKey}Mode`]: nextMode,
            [`${myKey}Ready`]: false,
            started: false,
        });
    };

    const handleFormationSelect = (key) => {
        emitSetupPatch({
            [`${myKey}Formation`]: key,
            [`${myKey}Ready`]: false,
            started: false,
        });
    };

    const canHostStart = isHost && gameSetup.p1Ready && gameSetup.p2Ready;

    const startBattle = () => {
        if (!canHostStart) return;
        const firstTurn = Math.random() < 0.5 ? 'bottom' : 'top';
        const initialBoard = buildBoardFromPlacements(
            opponentSide === 'top' ? (opponentMode === 'custom' ? normalizedOpponentLayout : opponentDefaultPlacements) : (mySide === 'top' ? (effectiveMyMode === 'custom' ? normalizedMyLayout : myDefaultPlacements) : []),
            opponentSide === 'bottom' ? (opponentMode === 'custom' ? normalizedOpponentLayout : opponentDefaultPlacements) : (mySide === 'bottom' ? (effectiveMyMode === 'custom' ? normalizedMyLayout : myDefaultPlacements) : []),
        );

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
            p1Formation: getFormationOrRandom(gameSetup.p1Formation),
            p2Formation: getFormationOrRandom(gameSetup.p2Formation),
        });
    };

    const moveKeySet = new Set(legalMoves.map((move) => `${move.row}-${move.col}`));

    const myCaptured = capturedBySide[mySide] || [];

    const getCellDataByDisplay = (displayRow, displayCol) => {
        const { row, col } = mapDisplayToBoard(displayRow, displayCol);
        const boardSource = gameSetup.started ? battleBoard : setupBoard;
        return {
            boardRow: row,
            boardCol: col,
            piece: boardSource[row][col],
            isSelected: selectedCell?.row === row && selectedCell?.col === col,
            isLegal: moveKeySet.has(`${row}-${col}`),
        };
    };

    const getPieceColorBySide = (side) => (side === mySide ? myPieceColor : opponentPieceColor);

    const opponentStatusText = opponentReady ? '준비 완료' : '준비 중';
    const myStatusText = myReady ? '준비 완료' : '준비 중';
    const firstTurnSide = gameSetup.firstTurn || turnSide;
    const firstTurnUserId = sideToUserId[firstTurnSide] || (firstTurnSide === 'bottom' ? '체스' : '장기');
    const currentTurnUserId = sideToUserId[turnSide] || (turnSide === 'bottom' ? '체스' : '장기');
    const checkedNow = gameSetup.started && !winner ? isKingInCheck(battleBoard, turnSide, lastMove) : false;
    const checkmateNow = checkedNow && hasAnyEscapeMove(battleBoard, turnSide, lastMove) === false;
    const checkedUserId = checkedNow ? currentTurnUserId : null;
    const winnerUserId = winner ? sideToUserId[winner] : null;
    const loserUserId = winner ? sideToUserId[winner === 'top' ? 'bottom' : 'top'] : null;
    const winnerReasonLabel = winnerReason === 'checkmate' ? '체크메이트' : winnerReason === 'capture' ? '왕/궁 포획' : winnerReason === 'timeout' ? '시간패' : '';
    const topUserId = sideToUserId.top || (normalizeFaction(room?.p1Faction) === 'janggi' ? room?.p1 : room?.p2) || 'TOP';
    const bottomUserId = sideToUserId.bottom || (normalizeFaction(room?.p1Faction) === 'chess' ? room?.p1 : room?.p2) || 'BOTTOM';
    const activeSide = gameSetup.started ? turnSide : firstTurnSide;
    const myLives = myKey === 'p1' ? p1Lives : p2Lives;
    const opponentLives = myKey === 'p1' ? p2Lives : p1Lives;
    const leftAlertType = checkmateNow ? 'checkmate' : checkedUserId ? 'check' : null;
    const alertSide = checkmateNow || checkedNow ? turnSide : null;
    const leftAlertText = checkmateNow
        ? `체크메이트 경고: ${checkedUserId || '상대'}`
        : checkedUserId
            ? `장군: ${checkedUserId}`
            : '';

    return (
        <div className="chess-board-wrapper">
            <div className="chess-layout">
                <GameLeftStatusPanel
                    topUserId={topUserId}
                    bottomUserId={bottomUserId}
                    activeSide={activeSide}
                    firstTurnUserId={firstTurnUserId}
                    remainingSeconds={remainingSeconds}
                    myLives={myLives}
                    opponentLives={opponentLives}
                    warningSoundEnabled={warningSoundEnabled}
                    onToggleWarningSound={() => setWarningSoundEnabled((prev) => !prev)}
                    alertSide={alertSide}
                    alertType={leftAlertType}
                    alertText={leftAlertText}
                />

                <div className="chess-board-area">
                    <div className="board-top-info">내 화면 기준: 내 기물은 항상 하단에 표시됩니다.</div>
                    <div className={`chess-board ${!gameSetup.started && effectiveMyMode === 'custom' ? 'setup-custom' : ''}`} role="grid" aria-label="체스 vs 장기 보드">
                        {Array.from({ length: 8 }, (_, displayRow) =>
                            Array.from({ length: 8 }, (_, displayCol) => {
                                const { piece, isSelected, isLegal } = getCellDataByDisplay(displayRow, displayCol);
                                const isDark = (displayRow + displayCol) % 2 === 1;

                                return (
                                    <button
                                        key={`${displayRow}-${displayCol}`}
                                        type="button"
                                        className={`chess-cell ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isLegal ? 'legal' : ''}`}
                                        role="gridcell"
                                        onClick={() => handleCellClick(displayRow, displayCol)}
                                        onDragOver={handleAllowDrop}
                                        onDrop={(event) => handleDropCell(event, displayRow, displayCol)}
                                    >
                                        {piece && (
                                            <span
                                                draggable={!gameSetup.started && effectiveMyMode === 'custom' && piece.side === mySide}
                                                onDragStart={(event) => handleDragStartBoardPiece(event, displayRow, displayCol)}
                                                className={`chess-piece ${piece.side === mySide ? 'mine' : 'opponent'} ${!gameSetup.started && effectiveMyMode === 'custom' ? 'custom-setup-piece' : ''}`}
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
                    <div className="board-bottom-info">상대 준비 상태: {opponentStatusText}</div>
                </div>

                <GameRightStatusPanel
                    myReady={myReady}
                    opponentReady={opponentReady}
                    myStatusText={myStatusText}
                    opponentStatusText={opponentStatusText}
                    canToggleReady={canToggleReady}
                    gameStarted={gameSetup.started}
                    onToggleReady={toggleMyReady}
                    showStartButton={isHost}
                    canHostStart={canHostStart}
                    onStart={startBattle}
                    customReadyHint={!canToggleReady && effectiveMyMode === 'custom' ? '자율선택 모드에서는 모든 기물을 배치해야 준비할 수 있습니다.' : ''}
                    winnerHint={winner ? `${winner === 'bottom' ? '체스' : '장기'} 승리 (${winnerReason === 'timeout' ? '시간패' : '왕/궁 포획'})` : '시간 0초 시 목숨 1개가 줄고 턴이 자동으로 넘어갑니다.'}
                    capturedPieces={myCaptured}
                    renderCapturedPiece={(piece) => (
                        <span key={piece.id} className="reserve-piece captured-piece" style={{ color: getPieceColorBySide(piece.side) }}>
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
                    reason={winnerReasonLabel}
                />
            </div>
        </div>
    );
};

export default Chess;
