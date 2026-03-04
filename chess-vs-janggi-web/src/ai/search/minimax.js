const oppositeSide = (side) => (side === 'top' ? 'bottom' : 'top');

export const minimaxAlphaBeta = ({
  state,
  side,
  depth,
  alpha = -Infinity,
  beta = Infinity,
  maximizingSide = side,
  generateMoves,
  applyMove,
  evaluate,
  isTerminal,
}) => {
  if (depth <= 0 || isTerminal?.(state)) {
    return { score: evaluate(state, maximizingSide), move: null };
  }

  const moves = generateMoves(state, side) || [];
  if (moves.length === 0) {
    return { score: evaluate(state, maximizingSide), move: null };
  }

  const isMaximizing = side === maximizingSide;
  let bestMove = null;

  if (isMaximizing) {
    let bestScore = -Infinity;

    for (const move of moves) {
      const nextState = applyMove(state, move, side);
      const result = minimaxAlphaBeta({
        state: nextState,
        side: oppositeSide(side),
        depth: depth - 1,
        alpha,
        beta,
        maximizingSide,
        generateMoves,
        applyMove,
        evaluate,
        isTerminal,
      });

      if (result.score > bestScore) {
        bestScore = result.score;
        bestMove = move;
      }

      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) break;
    }

    return { score: bestScore, move: bestMove };
  }

  let bestScore = Infinity;

  for (const move of moves) {
    const nextState = applyMove(state, move, side);
    const result = minimaxAlphaBeta({
      state: nextState,
      side: oppositeSide(side),
      depth: depth - 1,
      alpha,
      beta,
      maximizingSide,
      generateMoves,
      applyMove,
      evaluate,
      isTerminal,
    });

    if (result.score < bestScore) {
      bestScore = result.score;
      bestMove = move;
    }

    beta = Math.min(beta, bestScore);
    if (beta <= alpha) break;
  }

  return { score: bestScore, move: bestMove };
};
