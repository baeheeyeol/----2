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

const ORTHOGONAL_DIRS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
];

const DIAGONAL_DIRS = [
    [1, 1],
    [1, -1],
];

const OMOK_CONNECT_TARGET = 5;
const DEFAULT_STONE_CAPTURE_WIN_TARGET = 8;

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
    if (lower.includes('omok') || value === '오목') return 'omok';
    return 'chess';
};

const isOmokStone = (piece) => piece?.faction === 'omok' && piece?.type === 'stone';

const countLineOmokStone = (board, side, row, col, dr, dc) => {
    let count = 0;
    let nr = row + dr;
    let nc = col + dc;

    while (inBounds(nr, nc)) {
        const piece = board[nr][nc];
        if (!isOmokStone(piece) || piece.side !== side) break;
        count += 1;
        nr += dr;
        nc += dc;
    }

    return count;
};

const hasOmokConnectTarget = (board, side, row, col, target = OMOK_CONNECT_TARGET) => {
    const center = board[row][col];
    if (!isOmokStone(center) || center.side !== side) return false;

    const axes = [[1, 0], [0, 1], ...DIAGONAL_DIRS];
    return axes.some(([dr, dc]) => {
        const total = 1
            + countLineOmokStone(board, side, row, col, dr, dc)
            + countLineOmokStone(board, side, row, col, -dr, -dc);
        return total >= target;
    });
};

const countCapturedOmokStones = (capturedPieces) => {
    if (!Array.isArray(capturedPieces)) return 0;
    return capturedPieces.filter((piece) => isOmokStone(piece)).length;
};

const getFactionLabel = (faction) => {
    if (faction === 'janggi') return '장기';
    if (faction === 'omok') return '오목';
    return '체스';
};

const canCaptureTarget = (piece, target) => {
    if (!piece || !target || piece.faction === 'omok') return false;
    if (isOmokStone(target)) return true;
    return target.side !== piece.side;
};

const getSideFaction = (room, side) => {
    const p1Faction = normalizeFaction(room?.p1Faction);
    const p2Faction = normalizeFaction(room?.p2Faction);
    const p1Side = p1Faction === 'chess' && p2Faction !== 'chess' ? 'bottom' : p2Faction === 'chess' && p1Faction !== 'chess' ? 'top' : 'bottom';
    const p2Side = p1Side === 'bottom' ? 'top' : 'bottom';
    return side === p1Side ? p1Faction : p2Faction;
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
    if (piece.faction === 'omok') {
        return '';
    }
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
    if (faction === 'omok') {
        return [];
    }

    if (faction === 'chess') {
        return ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'];
    }

    const formation = JANGGI_FORMATIONS[getFormationOrRandom(formationKey)];
    const [f1, f2, f3, f4] = formation.order;
    return ['rook', f1, f2, 'guard', 'king', f3, f4, 'rook', 'cannon', 'soldier', 'soldier', 'soldier', 'soldier', 'soldier', 'soldier', 'cannon'];
};

const getDefaultPlacementsForSide = (faction, side, formationKey) => {
    const placements = [];
    if (faction === 'omok') {
        return placements;
    }

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

const addMoveIfValid = (moves, board, piece, row, col, extra = {}) => {
    if (!inBounds(row, col)) return;
    const target = board[row][col];
    if (target && !canCaptureTarget(piece, target)) return;
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
                if (canCaptureTarget(piece, target)) {
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
            if (target && canCaptureTarget(piece, target)) {
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
        jumps.forEach(([dr, dc]) => {
            const tr = row + dr;
            const tc = col + dc;
            if (!inBounds(tr, tc)) return;
            const target = board[tr][tc];
            if (!target || canCaptureTarget(piece, target)) {
                moves.push({ row: tr, col: tc });
            }
        });
        return moves;
    }

    if (piece.type === 'king') {
        const around = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        around.forEach(([dr, dc]) => addMoveIfValid(moves, board, piece, row + dr, col + dc));

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

    const addJanggiMove = (targetRow, targetCol, extra = {}) => {
        if (!inBounds(targetRow, targetCol)) return;
        const target = board[targetRow][targetCol];
        if (!target || canCaptureTarget(piece, target)) {
            moves.push({ row: targetRow, col: targetCol, ...extra });
        }
    };

    if (piece.type === 'soldier') {
        addJanggiMove(row + dir, col);
        addJanggiMove(row, col - 1);
        addJanggiMove(row, col + 1);
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
            if (!inBounds(br, bc)) return;
            if (board[br][bc] && !isOmokStone(board[br][bc])) return;
            targets.forEach(([dr, dc]) => addJanggiMove(row + dr, col + dc));
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
            if (board[b1r][b1c] && !isOmokStone(board[b1r][b1c])) return;
            if (board[b2r][b2c] && !isOmokStone(board[b2r][b2c])) return;
            addJanggiMove(tr, tc);
        });

        return moves;
    }

    if (piece.type === 'king' || piece.type === 'guard') {
        const around = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        around.forEach(([dr, dc]) => {
            const tr = row + dr;
            const tc = col + dc;
            if (!isInsidePalace(piece.side, tr, tc)) return;
            addJanggiMove(tr, tc);
        });
        return moves;
    }

    return moves;
};

const getLegalMoves = (board, row, col, lastMove, currentTurnSide = null) => {
    const piece = board[row][col];
    if (!piece) return [];
    if (piece.faction === 'omok') return [];
    if (piece.frozen && piece.side === currentTurnSide) return [];
    if (piece.faction === 'chess') return getChessMoves(board, piece, row, col, lastMove);
    return getJanggiMoves(board, piece, row, col);
};

const clearFrozenForSide = (board, side) => {
    return board.map((line) => line.map((cell) => {
        if (!cell || cell.side !== side || !cell.frozen) return cell;
        return { ...cell, frozen: false };
    }));
};

const applyOmokSuffocation = (board) => {
    const toRemove = [];

    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            const piece = board[row][col];
            if (!piece || isOmokStone(piece)) continue;

            const blockedByCross = ORTHOGONAL_DIRS.every(([dr, dc]) => {
                const nr = row + dr;
                const nc = col + dc;
                return inBounds(nr, nc) && isOmokStone(board[nr][nc]);
            });

            if (blockedByCross) {
                toRemove.push({ row, col, piece });
            }
        }
    }

    if (toRemove.length === 0) {
        return { nextBoard: board, removedPieces: [] };
    }

    const nextBoard = board.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
    toRemove.forEach(({ row, col }) => {
        nextBoard[row][col] = null;
    });

    return { nextBoard, removedPieces: toRemove.map((item) => item.piece) };
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
            if (piece.frozen) continue;
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
            const moves = getLegalMoves(board, row, col, lastMove, side);
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

const getJanggiPalaceSet = ({ p1Faction, p2Faction }) => {
    const palace = new Set();
    const p1 = normalizeFaction(p1Faction);
    const p2 = normalizeFaction(p2Faction);
    const p1Side = p1 === 'chess' && p2 !== 'chess' ? 'bottom' : p2 === 'chess' && p1 !== 'chess' ? 'top' : 'bottom';
    const p2Side = p1Side === 'bottom' ? 'top' : 'bottom';

    const addPalaceForSide = (side) => {
        const rowStart = side === 'top' ? 0 : 5;
        const rowEnd = side === 'top' ? 2 : 7;
        for (let row = rowStart; row <= rowEnd; row += 1) {
            for (let col = 3; col <= 5; col += 1) {
                palace.add(`${row}-${col}`);
            }
        }
    };

    if (p1 === 'janggi') addPalaceForSide(p1Side);
    if (p2 === 'janggi') addPalaceForSide(p2Side);

    return palace;
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
    const [remainingSeconds, setRemainingSeconds] = useState(60);
    const [warningSoundEnabled, setWarningSoundEnabled] = useState(true);
    const [frozenNoticeVisible, setFrozenNoticeVisible] = useState(false);
    const [turnStartNotice, setTurnStartNotice] = useState('');
    const lastWarningBeepSecondRef = useRef(null);
    const frozenNoticeTimerRef = useRef(null);
    const turnStartNoticeTimerRef = useRef(null);
    const prevStartedRef = useRef(false);

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
    const stoneCaptureWinTarget = Number.isFinite(Number(room?.omokStoneTarget))
        ? Math.min(12, Math.max(6, Math.floor(Number(room.omokStoneTarget))))
        : DEFAULT_STONE_CAPTURE_WIN_TARGET;

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
        return () => {
            if (frozenNoticeTimerRef.current) {
                clearTimeout(frozenNoticeTimerRef.current);
            }
            if (turnStartNoticeTimerRef.current) {
                clearTimeout(turnStartNoticeTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const started = !!gameSetup.started;
        if (!started) {
            prevStartedRef.current = false;
            setTurnStartNotice('');
            if (turnStartNoticeTimerRef.current) {
                clearTimeout(turnStartNoticeTimerRef.current);
                turnStartNoticeTimerRef.current = null;
            }
            return;
        }

        if (!prevStartedRef.current) {
            const firstTurnSide = gameSetup.firstTurn || turnSide;
            const noticeText = firstTurnSide === mySide ? '선턴' : '후턴';
            setTurnStartNotice(noticeText);
            if (turnStartNoticeTimerRef.current) {
                clearTimeout(turnStartNoticeTimerRef.current);
            }
            turnStartNoticeTimerRef.current = setTimeout(() => {
                setTurnStartNotice('');
                turnStartNoticeTimerRef.current = null;
            }, 1400);
        }

        prevStartedRef.current = started;
    }, [gameSetup.started, gameSetup.firstTurn, mySide, turnSide]);

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
    }, [remainingSeconds, gameSetup.started, winner, isHost, turnSide]);

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
            if (clicked) return;

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
            return;
        }

        if (selectedCell) {
            const validMove = legalMoves.find((move) => move.row === row && move.col === col);
            if (validMove) {
                const moving = battleBoard[selectedCell.row][selectedCell.col];
                if (!moving) return;

                const { nextBoard, movedPiece, captured } = applyMoveOnBoard(battleBoard, selectedCell, validMove);
                if (!movedPiece) return;

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

                const capturedStoneCount = countCapturedOmokStones(nextCapturedBySide[turnSide]);
                const wonByStoneCapture = capturedStoneCount >= stoneCaptureWinTarget;

                const nextTurn = turnSide === 'top' ? 'bottom' : 'top';
                const nextLastMove = {
                    piece: finalMovedPiece,
                    from: selectedCell,
                    to: { row: validMove.row, col: validMove.col },
                    wasDoubleStep:
                        finalMovedPiece.faction === 'chess' &&
                        finalMovedPiece.type === 'pawn' &&
                        Math.abs(validMove.row - selectedCell.row) === 2,
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

    const getPieceColorBySide = (side) => (side === mySide ? myPieceColor : opponentPieceColor);

    const opponentStatusText = opponentReady ? '준비 완료' : '준비 중';
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
