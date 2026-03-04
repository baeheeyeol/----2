export const collectLegalMoves = ({ board, side, getLegalMoves, context = {} }) => {
  if (!Array.isArray(board) || typeof getLegalMoves !== 'function') return [];

  const moves = [];
  for (let row = 0; row < board.length; row += 1) {
    const line = board[row];
    if (!Array.isArray(line)) continue;

    for (let col = 0; col < line.length; col += 1) {
      const piece = line[col];
      if (!piece || piece.side !== side) continue;

      const legalMoves = getLegalMoves(board, row, col, context.lastMove, side) || [];
      for (const move of legalMoves) {
        moves.push({
          from: { row, col },
          to: move,
          piece,
        });
      }
    }
  }

  return moves;
};
