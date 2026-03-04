import {
  CHESS_BOARD_SIZE,
  CHESS_LABELS,
  JANGGI_LABELS,
  JANGGI_FORMATIONS,
  FORMATION_KEYS,
  OMOK_CONNECT_TARGET,
} from '@/game/constants';

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

export const createEmptyBoard = () => Array.from({ length: CHESS_BOARD_SIZE }, () => Array.from({ length: CHESS_BOARD_SIZE }, () => null));

export const inBounds = (row, col) => row >= 0 && row < CHESS_BOARD_SIZE && col >= 0 && col < CHESS_BOARD_SIZE;

export const getDirection = (side) => (side === 'top' ? 1 : -1);

export const isInsidePalace = (side, row, col) => {
  const rowMin = side === 'top' ? 0 : 5;
  const rowMax = side === 'top' ? 2 : 7;
  return row >= rowMin && row <= rowMax && col >= 3 && col <= 4;
};

export const normalizeFaction = (value) => {
  if (!value) return 'chess';
  const lower = String(value).toLowerCase();
  if (lower.includes('janggi') || value === '장기') return 'janggi';
  if (lower.includes('omok') || value === '오목') return 'omok';
  return 'chess';
};

export const isOmokStone = (piece) => piece?.faction === 'omok' && piece?.type === 'stone';

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

export const hasOmokConnectTarget = (board, side, row, col, target = OMOK_CONNECT_TARGET) => {
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

export const countCapturedOmokStones = (capturedPieces) => {
  if (!Array.isArray(capturedPieces)) return 0;
  return capturedPieces.filter((piece) => isOmokStone(piece)).length;
};

export const getFactionLabel = (faction) => {
  if (faction === 'janggi') return '장기';
  if (faction === 'omok') return '오목';
  return '체스';
};

export const canCaptureTarget = (piece, target) => {
  if (!piece || !target || piece.faction === 'omok') return false;
  if (isOmokStone(target)) return true;
  return target.side !== piece.side;
};

export const getSideFaction = (room, side) => {
  const p1Faction = normalizeFaction(room?.p1Faction);
  const p2Faction = normalizeFaction(room?.p2Faction);
  const p1Side = p1Faction === 'chess' && p2Faction !== 'chess' ? 'bottom' : p2Faction === 'chess' && p1Faction !== 'chess' ? 'top' : 'bottom';
  const p2Side = p1Side === 'bottom' ? 'top' : 'bottom';
  return side === p1Side ? p1Faction : p2Faction;
};

export const createPiece = (faction, type, side, moved = false) => ({
  id: `${faction}-${type}-${side}-${Math.random().toString(36).slice(2, 10)}`,
  faction,
  type,
  side,
  moved,
});

export const getPieceSymbol = (piece) => {
  if (!piece) return '';
  if (piece.faction === 'omok') return '';
  if (piece.faction === 'chess') {
    return CHESS_LABELS[piece.side]?.[piece.type] || '♟';
  }
  return JANGGI_LABELS[piece.type] || '卒';
};

export const getFormationOrRandom = (value) => {
  if (value && FORMATION_KEYS.includes(value)) return value;
  return FORMATION_KEYS[Math.floor(Math.random() * FORMATION_KEYS.length)];
};

export const getFormationOrDefault = (value) => {
  if (value && FORMATION_KEYS.includes(value)) return value;
  return FORMATION_KEYS[0];
};

export const getDefaultPieceTypes = (faction, formationKey) => {
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

export const getDefaultPlacementsForSide = (faction, side, formationKey) => {
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

export const buildBoardFromPlacements = (topPlacements, bottomPlacements) => {
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

export const getChessMoves = (board, piece, row, col, lastMove) => {
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

export const getJanggiMoves = (board, piece, row, col) => {
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

export const getLegalMoves = (board, row, col, lastMove, currentTurnSide = null) => {
  const piece = board[row][col];
  if (!piece) return [];
  if (piece.faction === 'omok') return [];
  if (piece.frozen && piece.side === currentTurnSide) return [];
  if (piece.faction === 'chess') return getChessMoves(board, piece, row, col, lastMove);
  return getJanggiMoves(board, piece, row, col);
};

export const clearFrozenForSide = (board, side) => {
  return board.map((line) => line.map((cell) => {
    if (!cell || cell.side !== side || !cell.frozen) return cell;
    return { ...cell, frozen: false };
  }));
};

export const applyOmokSuffocation = (board) => {
  const toRemove = [];

  for (let row = 0; row < CHESS_BOARD_SIZE; row += 1) {
    for (let col = 0; col < CHESS_BOARD_SIZE; col += 1) {
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

export const applyMoveOnBoard = (board, from, move) => {
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

export const findKingCell = (board, side) => {
  for (let row = 0; row < CHESS_BOARD_SIZE; row += 1) {
    for (let col = 0; col < CHESS_BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece?.side === side && piece.type === 'king') {
        return { row, col };
      }
    }
  }
  return null;
};

export const isKingInCheck = (board, side, lastMove) => {
  const kingCell = findKingCell(board, side);
  if (!kingCell) return false;

  for (let row = 0; row < CHESS_BOARD_SIZE; row += 1) {
    for (let col = 0; col < CHESS_BOARD_SIZE; col += 1) {
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

export const hasAnyEscapeMove = (board, side, lastMove) => {
  for (let row = 0; row < CHESS_BOARD_SIZE; row += 1) {
    for (let col = 0; col < CHESS_BOARD_SIZE; col += 1) {
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

export const getJanggiPalaceSet = ({ p1Faction, p2Faction }) => {
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