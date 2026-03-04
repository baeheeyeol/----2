import {
  CHESS_LABELS,
  CHESS_POOL,
  JANGGI_COLS,
  JANGGI_LABELS,
  JANGGI_ROWS,
  OMOK_CONNECT_TARGET,
} from '@/game/constants';

export const ROWS = JANGGI_ROWS;
export const COLS = JANGGI_COLS;

export const createEmptyBoard = () => Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
export const inBounds = (row, col) => row >= 0 && row < ROWS && col >= 0 && col < COLS;
export const getDirection = (side) => (side === 'top' ? 1 : -1);

export const isInsidePalace = (side, row, col) => {
  if (!inBounds(row, col)) return false;
  if (col < 3 || col > 5) return false;
  if (side === 'top') return row >= 0 && row <= 2;
  return row >= 7 && row <= 9;
};

export const isPalaceDiagonalStep = (fromRow, fromCol, toRow, toCol, side) => {
  if (!isInsidePalace(side, fromRow, fromCol) || !isInsidePalace(side, toRow, toCol)) return false;
  return Math.abs(fromRow - toRow) === 1 && Math.abs(fromCol - toCol) === 1;
};

export const normalizeFaction = (value) => {
  if (!value) return 'chess';
  const lower = String(value).toLowerCase();
  if (lower.includes('janggi') || value === '장기') return 'janggi';
  if (lower.includes('omok') || value === '오목') return 'omok';
  return 'chess';
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
  if (piece.faction === 'janggi') return JANGGI_LABELS[piece.type] || '卒';
  return CHESS_LABELS[piece.side]?.[piece.type] || '♟';
};

export const hasOmokConnectTarget = (board, side, row, col, target = OMOK_CONNECT_TARGET) => {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  return directions.some(([dr, dc]) => {
    let count = 1;

    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[r][c]?.faction === 'omok' && board[r][c]?.side === side) {
      count += 1;
      r += dr;
      c += dc;
    }

    r = row - dr;
    c = col - dc;
    while (inBounds(r, c) && board[r][c]?.faction === 'omok' && board[r][c]?.side === side) {
      count += 1;
      r -= dr;
      c -= dc;
    }

    return count >= target;
  });
};

export const getJanggiFixedPlacements = (side) => {
  const backRow = side === 'top' ? 0 : 9;
  const kingRow = side === 'top' ? 1 : 8;
  const cannonRow = side === 'top' ? 2 : 7;
  const soldierRow = side === 'top' ? 3 : 6;

  return [
    { type: 'rook', row: backRow, col: 0, faction: 'janggi' },
    { type: 'horse', row: backRow, col: 1, faction: 'janggi' },
    { type: 'elephant', row: backRow, col: 2, faction: 'janggi' },
    { type: 'guard', row: backRow, col: 3, faction: 'janggi' },
    { type: 'guard', row: backRow, col: 5, faction: 'janggi' },
    { type: 'elephant', row: backRow, col: 6, faction: 'janggi' },
    { type: 'horse', row: backRow, col: 7, faction: 'janggi' },
    { type: 'rook', row: backRow, col: 8, faction: 'janggi' },
    { type: 'king', row: kingRow, col: 4, faction: 'janggi' },
    { type: 'cannon', row: cannonRow, col: 1, faction: 'janggi' },
    { type: 'cannon', row: cannonRow, col: 7, faction: 'janggi' },
    { type: 'soldier', row: soldierRow, col: 0, faction: 'janggi' },
    { type: 'soldier', row: soldierRow, col: 2, faction: 'janggi' },
    { type: 'soldier', row: soldierRow, col: 4, faction: 'janggi' },
    { type: 'soldier', row: soldierRow, col: 6, faction: 'janggi' },
    { type: 'soldier', row: soldierRow, col: 8, faction: 'janggi' },
  ];
};

export const getChessRecommendedPlacements = (side, recommendedSide = 'left') => {
  const backRow = side === 'top' ? 0 : 9;
  const pawnRow = side === 'top' ? 1 : 8;
  const back = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  const pawns = ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'];
  const startCol = side === 'top'
    ? (recommendedSide === 'left' ? 1 : 0)
    : (recommendedSide === 'left' ? 0 : 1);

  return [
    ...back.map((type, col) => ({ type, row: backRow, col: startCol + col, faction: 'chess' })),
    ...pawns.map((type, col) => ({ type, row: pawnRow, col: startCol + col, faction: 'chess' })),
  ];
};

export const canCapture = (piece, target) => !!target && target.side !== piece.side;

const addMoveIfValid = (moves, board, piece, row, col) => {
  if (!inBounds(row, col)) return;
  const target = board[row][col];
  if (!target || canCapture(piece, target)) {
    moves.push({ row, col });
  }
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
        if (canCapture(piece, target)) moves.push({ row: r, col: c });
        break;
      }
      r += dr;
      c += dc;
    }
  });
  return moves;
};

export const getChessMoves = (board, piece, row, col) => {
  const dir = getDirection(piece.side);
  const moves = [];

  if (piece.type === 'pawn') {
    const oneForward = row + dir;
    if (inBounds(oneForward, col) && !board[oneForward][col]) moves.push({ row: oneForward, col });
    [-1, 1].forEach((dc) => {
      const tr = row + dir;
      const tc = col + dc;
      if (!inBounds(tr, tc)) return;
      const target = board[tr][tc];
      if (target && canCapture(piece, target)) moves.push({ row: tr, col: tc });
    });
    return moves;
  }

  if (piece.type === 'rook') return getSlidingMoves(board, piece, row, col, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
  if (piece.type === 'bishop') return getSlidingMoves(board, piece, row, col, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  if (piece.type === 'queen') return getSlidingMoves(board, piece, row, col, [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
  if (piece.type === 'king') {
    [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dr, dc]) => addMoveIfValid(moves, board, piece, row + dr, col + dc));
    return moves;
  }
  if (piece.type === 'knight') {
    [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dr, dc]) => addMoveIfValid(moves, board, piece, row + dr, col + dc));
    return moves;
  }

  return moves;
};

export const getJanggiMoves = (board, piece, row, col) => {
  const moves = [];
  const dir = getDirection(piece.side);

  if (piece.type === 'soldier') {
    addMoveIfValid(moves, board, piece, row + dir, col);
    addMoveIfValid(moves, board, piece, row, col - 1);
    addMoveIfValid(moves, board, piece, row, col + 1);
    if (isInsidePalace(piece.side, row, col)) {
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => {
        const tr = row + dr;
        const tc = col + dc;
        if (!isPalaceDiagonalStep(row, col, tr, tc, piece.side)) return;
        if ((piece.side === 'top' && tr < row) || (piece.side === 'bottom' && tr > row)) return;
        addMoveIfValid(moves, board, piece, tr, tc);
      });
    }
    return moves;
  }
  if (piece.type === 'rook') return getSlidingMoves(board, piece, row, col, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
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
          if (target.type === 'cannon') break;
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

        if (canCapture(piece, target) && target.type !== 'cannon') {
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
      targets.forEach(([dr, dc]) => addMoveIfValid(moves, board, piece, row + dr, col + dc));
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
      addMoveIfValid(moves, board, piece, tr, tc);
    });
    return moves;
  }
  if (piece.type === 'king' || piece.type === 'guard') {
    [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dr, dc]) => {
      const tr = row + dr;
      const tc = col + dc;
      if (!isInsidePalace(piece.side, tr, tc)) return;
      if (Math.abs(dr) === 1 && Math.abs(dc) === 1 && !isPalaceDiagonalStep(row, col, tr, tc, piece.side)) return;
      addMoveIfValid(moves, board, piece, tr, tc);
    });
    return moves;
  }

  return moves;
};

export const getLegalMoves = (board, row, col) => {
  const piece = board[row][col];
  if (!piece) return [];
  return piece.faction === 'chess' ? getChessMoves(board, piece, row, col) : getJanggiMoves(board, piece, row, col);
};

export const buildBoardFromPlacements = (topPlacements, bottomPlacements) => {
  const board = createEmptyBoard();
  topPlacements.forEach((item) => {
    if (!inBounds(item.row, item.col)) return;
    board[item.row][item.col] = createPiece(item.faction, item.type, 'top');
  });
  bottomPlacements.forEach((item) => {
    if (!inBounds(item.row, item.col)) return;
    board[item.row][item.col] = createPiece(item.faction, item.type, 'bottom');
  });
  return board;
};

export { CHESS_POOL, OMOK_CONNECT_TARGET };