const BASE_VALUES = {
  king: 100000,
  queen: 900,
  rook: 500,
  bishop: 330,
  knight: 320,
  pawn: 100,
  cannon: 700,
  horse: 330,
  elephant: 300,
  guard: 250,
  soldier: 120,
  stone: 60,
};

const JANGGI_OVERRIDES = {
  rook: 1300,
  cannon: 700,
};

const PAWN_ADVANCE_STEP_SCORE = 8;

const getPawnAdvanceSteps = (side, row, boardRows) => {
  if (!Number.isFinite(row) || !Number.isFinite(boardRows) || boardRows <= 1) return 0;
  if (side === 'top') return row;
  if (side === 'bottom') return (boardRows - 1) - row;
  return 0;
};

export const getPieceBaseValue = (piece) => {
  if (!piece) return 0;

  if (piece.type === 'king') return BASE_VALUES.king;

  if (piece.faction === 'janggi' && piece.type in JANGGI_OVERRIDES) {
    return JANGGI_OVERRIDES[piece.type];
  }

  return BASE_VALUES[piece.type] ?? 100;
};

export const getPieceEvaluationValue = (piece, context = {}) => {
  if (!piece) return 0;

  const baseValue = getPieceBaseValue(piece);

  if (piece.faction === 'chess' && piece.type === 'pawn') {
    const steps = getPawnAdvanceSteps(piece.side, context.row, context.boardRows);
    return baseValue + steps * PAWN_ADVANCE_STEP_SCORE;
  }

  return baseValue;
};

export const evaluateMaterial = (board, side) => {
  if (!Array.isArray(board) || board.length === 0) return 0;

  const boardRows = board.length;
  let score = 0;

  for (let row = 0; row < board.length; row += 1) {
    const line = board[row];
    if (!Array.isArray(line)) continue;

    for (let col = 0; col < line.length; col += 1) {
      const piece = line[col];
      if (!piece) continue;

      const value = getPieceEvaluationValue(piece, { row, col, boardRows });
      score += piece.side === side ? value : -value;
    }
  }

  return score;
};
