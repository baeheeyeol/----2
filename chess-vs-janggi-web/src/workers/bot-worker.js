import { collectLegalMoves, evaluateMaterial, getPieceEvaluationValue, minimaxAlphaBeta } from '../ai';
import {
  applyMoveOnBoard as applyChessMoveOnBoard,
  clearFrozenForSide,
  getLegalMoves as getChessLegalMoves,
  hasOmokConnectTarget as hasOmokConnectTargetChess,
  createPiece as createChessPiece,
  applyOmokSuffocation,
} from '../game/rules/chessRules';
import {
  getLegalMoves as getJanggiLegalMoves,
  hasOmokConnectTarget as hasOmokConnectTargetJanggi,
  createPiece as createJanggiPiece,
} from '../game/rules/janggiRules';

const oppositeSide = (side) => (side === 'top' ? 'bottom' : 'top');
// 진영/포진/커스텀 레이아웃을 모드 기준으로 정규화합니다.
const normalizeFactionCode = (value) => {
  if (!value) return null;
  const lower = String(value).toLowerCase();
  if (lower.includes('omok') || value === '오목') return 'omok';
  if (lower.includes('janggi') || value === '장기') return 'janggi';
  return 'chess';
};
// 모드/진영/포진을 기준으로 실제 배치를 확정합니다.
const resolveSideFactions = (payload) => {
  const top = normalizeFactionCode(payload?.sideFactions?.top);
  const bottom = normalizeFactionCode(payload?.sideFactions?.bottom);
  return { top, bottom };
};

const resolveTurnFaction = (payload) => {
  const explicit = normalizeFactionCode(payload?.turnFaction);
  if (explicit) return explicit;

  const side = payload?.side;
  if (side !== 'top' && side !== 'bottom') return null;

  const sideFactions = resolveSideFactions(payload);
  return sideFactions[side] || null;
};

const randomPick = (items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const idx = Math.floor(Math.random() * items.length);
  return items[idx] || null;
};

const collectEmptyCells = (board) => {
  const cells = [];
  for (let row = 0; row < board.length; row += 1) {
    const line = board[row] || [];
    for (let col = 0; col < line.length; col += 1) {
      if (!line[col]) cells.push({ row, col });
    }
  }
  return cells;
};

const getOmokLineLength = (board, side, row, col) => {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  let best = 1;

  for (const [dr, dc] of dirs) {
    let count = 1;

    let nr = row + dr;
    let nc = col + dc;
    while (nr >= 0 && nr < board.length && nc >= 0 && nc < board[0].length) {
      const piece = board[nr][nc];
      if (!piece || piece.faction !== 'omok' || piece.side !== side) break;
      count += 1;
      nr += dr;
      nc += dc;
    }

    nr = row - dr;
    nc = col - dc;
    while (nr >= 0 && nr < board.length && nc >= 0 && nc < board[0].length) {
      const piece = board[nr][nc];
      if (!piece || piece.faction !== 'omok' || piece.side !== side) break;
      count += 1;
      nr -= dr;
      nc -= dc;
    }

    if (count > best) best = count;
  }

  return best;
};

const evaluateRemovedPieces = (removedPieces, mySide, boardRows) => {
  if (!Array.isArray(removedPieces) || removedPieces.length === 0) return 0;

  let score = 0;
  for (const piece of removedPieces) {
    if (!piece || piece.faction === 'omok') continue;
    const value = piece.type === 'king'
      ? 180000
      : (getPieceEvaluationValue(piece, { row: 0, boardRows }) * 15 + 80);
    score += piece.side === mySide ? -value : value;
  }

  return score;
};

const countImmediateConnectThreats = ({ board, side, variant, hasOmokConnectTarget, createPiece }) => {
  const empties = collectEmptyCells(board);
  let threatCount = 0;

  for (const cell of empties) {
    const cloned = board.map((line) => line.map((piece) => (piece ? { ...piece } : null)));
    cloned[cell.row][cell.col] = createPiece('omok', 'stone', side, true);
    const scoredBoard = variant === 'chess' ? applyOmokSuffocation(cloned).nextBoard : cloned;
    if (hasOmokConnectTarget(scoredBoard, side, cell.row, cell.col, 5)) {
      threatCount += 1;
    }
  }

  return threatCount;
};

const chooseOmokMove = ({ board, side, variant, level }) => {
  const empties = collectEmptyCells(board);
  if (empties.length === 0) return null;
  if (level === 1) return randomPick(empties);

  const hasOmokConnectTarget = variant === 'chess' ? hasOmokConnectTargetChess : hasOmokConnectTargetJanggi;
  const createPiece = variant === 'chess' ? createChessPiece : createJanggiPiece;
  const enemySide = oppositeSide(side);
  const enemyThreatsBefore = countImmediateConnectThreats({
    board,
    side: enemySide,
    variant,
    hasOmokConnectTarget,
    createPiece,
  });
  let best = null;

  for (const cell of empties) {
    const cloned = board.map((line) => line.map((piece) => (piece ? { ...piece } : null)));
    cloned[cell.row][cell.col] = createPiece('omok', 'stone', side, true);

    const suffocationResult = variant === 'chess'
      ? applyOmokSuffocation(cloned)
      : { nextBoard: cloned, removedPieces: [] };
    const scoredBoard = suffocationResult.nextBoard;
    const winNow = hasOmokConnectTarget(scoredBoard, side, cell.row, cell.col, 5);

    const removedScore = evaluateRemovedPieces(suffocationResult.removedPieces, side, board.length);
    const lineScore = getOmokLineLength(scoredBoard, side, cell.row, cell.col);

    const enemyThreatsAfter = countImmediateConnectThreats({
      board: scoredBoard,
      side: enemySide,
      variant,
      hasOmokConnectTarget,
      createPiece,
    });
    const blockedThreats = Math.max(0, enemyThreatsBefore - enemyThreatsAfter);
    const hardBlockBonus = enemyThreatsBefore > 0 && enemyThreatsAfter === 0 ? 22000 : 0;

    const centerRow = (board.length - 1) / 2;
    const centerCol = (board[0].length - 1) / 2;
    const centerScore = 20 - (Math.abs(cell.row - centerRow) + Math.abs(cell.col - centerCol));
    const score =
      (winNow ? 200000 : 0)
      + removedScore
      + lineScore * 42
      + centerScore
      + blockedThreats * 3800
      + hardBlockBonus;

    if (!best || score > best.score || (score === best.score && Math.random() > 0.5)) {
      best = { ...cell, score };
    }
  }

  return best ? { row: best.row, col: best.col } : null;
};

const greedyPickChessMove = ({ board, side, lastMove }) => {
  const moves = collectLegalMoves({
    board,
    side,
    getLegalMoves: getChessLegalMoves,
    context: { lastMove },
  });
  if (moves.length === 0) return null;

  let best = null;
  for (const move of moves) {
    const before = evaluateMaterial(board, side);
    const { nextBoard, movedPiece, captured } = applyChessMoveOnBoard(board, move.from, move.to);
    if (!movedPiece) continue;

    const after = evaluateMaterial(nextBoard, side);
    const captureBonus = captured ? getPieceEvaluationValue(captured, { row: move.to.row, boardRows: board.length }) * 12 : 0;
    const score = (after - before) + captureBonus + (captured?.type === 'king' ? 100000 : 0);

    if (!best || score > best.score) {
      best = { ...move, score };
    }
  }

  return best;
};

const greedyPickJanggiMove = ({ board, side }) => {
  const moves = collectLegalMoves({
    board,
    side,
    getLegalMoves: getJanggiLegalMoves,
  });
  if (moves.length === 0) return null;

  let best = null;
  for (const move of moves) {
    const before = evaluateMaterial(board, side);
    const nextBoard = board.map((line) => line.map((piece) => (piece ? { ...piece } : null)));
    const moving = nextBoard[move.from.row][move.from.col];
    if (!moving) continue;
    const captured = nextBoard[move.to.row][move.to.col];
    nextBoard[move.from.row][move.from.col] = null;
    nextBoard[move.to.row][move.to.col] = { ...moving, moved: true };

    const after = evaluateMaterial(nextBoard, side);
    const captureBonus = captured ? getPieceEvaluationValue(captured, { row: move.to.row, boardRows: board.length }) * 12 : 0;
    const score = (after - before) + captureBonus + (captured?.type === 'king' ? 100000 : 0);

    if (!best || score > best.score) {
      best = { ...move, score };
    }
  }

  return best;
};

const minimaxChessMove = ({ board, side, lastMove }) => {
  const depth = 3;
  const initial = {
    board,
    lastMove,
  };

  const generateMoves = (state, activeSide) => collectLegalMoves({
    board: state.board,
    side: activeSide,
    getLegalMoves: getChessLegalMoves,
    context: { lastMove: state.lastMove },
  });

  const applyMove = (state, move, activeSide) => {
    const { nextBoard, movedPiece, captured } = applyChessMoveOnBoard(state.board, move.from, move.to);
    if (!movedPiece) return state;

    const thawed = clearFrozenForSide(nextBoard, activeSide);
    const nextLastMove = {
      piece: thawed[move.to.row][move.to.col] || movedPiece,
      from: move.from,
      to: { row: move.to.row, col: move.to.col },
      wasDoubleStep:
        movedPiece.faction === 'chess'
        && movedPiece.type === 'pawn'
        && Math.abs(move.to.row - move.from.row) === 2,
      captured,
    };

    return {
      board: thawed,
      lastMove: nextLastMove,
    };
  };

  const evaluate = (state, maximizingSide) => evaluateMaterial(state.board, maximizingSide);

  const isTerminal = (state) => {
    let topKing = false;
    let bottomKing = false;

    for (let row = 0; row < state.board.length; row += 1) {
      for (let col = 0; col < state.board[row].length; col += 1) {
        const piece = state.board[row][col];
        if (!piece || piece.type !== 'king') continue;
        if (piece.side === 'top') topKing = true;
        if (piece.side === 'bottom') bottomKing = true;
      }
    }

    return !topKing || !bottomKing;
  };

  const result = minimaxAlphaBeta({
    state: initial,
    side,
    depth,
    generateMoves,
    applyMove,
    evaluate,
    isTerminal,
  });

  return result.move || null;
};

const minimaxJanggiMove = ({ board, side }) => {
  const depth = 3;
  const initial = { board };

  const generateMoves = (state, activeSide) => collectLegalMoves({
    board: state.board,
    side: activeSide,
    getLegalMoves: getJanggiLegalMoves,
  });

  const applyMove = (state, move) => {
    const nextBoard = state.board.map((line) => line.map((piece) => (piece ? { ...piece } : null)));
    const moving = nextBoard[move.from.row][move.from.col];
    if (!moving) return state;
    nextBoard[move.from.row][move.from.col] = null;
    nextBoard[move.to.row][move.to.col] = { ...moving, moved: true };
    return { board: nextBoard };
  };

  const evaluate = (state, maximizingSide) => evaluateMaterial(state.board, maximizingSide);

  const isTerminal = (state) => {
    let topKing = false;
    let bottomKing = false;

    for (let row = 0; row < state.board.length; row += 1) {
      for (let col = 0; col < state.board[row].length; col += 1) {
        const piece = state.board[row][col];
        if (!piece || piece.type !== 'king') continue;
        if (piece.side === 'top') topKing = true;
        if (piece.side === 'bottom') bottomKing = true;
      }
    }

    return !topKing || !bottomKing;
  };

  const result = minimaxAlphaBeta({
    state: initial,
    side,
    depth,
    generateMoves,
    applyMove,
    evaluate,
    isTerminal,
  });

  return result.move || null;
};

const chooseChessMove = ({ level, board, side, lastMove }) => {
  if (level <= 1) {
    const random = collectLegalMoves({
      board,
      side,
      getLegalMoves: getChessLegalMoves,
      context: { lastMove },
    });
    return randomPick(random);
  }

  if (level === 2) {
    return greedyPickChessMove({ board, side, lastMove });
  }

  return minimaxChessMove({ board, side, lastMove }) || greedyPickChessMove({ board, side, lastMove });
};

const chooseJanggiMove = ({ level, board, side }) => {
  if (level <= 1) {
    const random = collectLegalMoves({
      board,
      side,
      getLegalMoves: getJanggiLegalMoves,
    });
    return randomPick(random);
  }

  if (level === 2) {
    return greedyPickJanggiMove({ board, side });
  }

  return minimaxJanggiMove({ board, side }) || greedyPickJanggiMove({ board, side });
};

self.onmessage = (event) => {
  const payload = event?.data || {};
  const requestId = payload.requestId;

  try {
    const level = Number.isFinite(Number(payload.level)) ? Math.max(1, Math.min(3, Number(payload.level))) : 2;
    const turnFaction = resolveTurnFaction(payload);

    if (payload.mode === 'omok' || turnFaction === 'omok') {
      const move = chooseOmokMove({
        board: payload.board,
        side: payload.side,
        variant: payload.variant,
        level,
      });
      self.postMessage({ requestId, move });
      return;
    }

    const move = payload.variant === 'janggi'
      ? chooseJanggiMove({ level, board: payload.board, side: payload.side })
      : chooseChessMove({ level, board: payload.board, side: payload.side, lastMove: payload.lastMove });

    self.postMessage({ requestId, move });
  } catch (error) {
    self.postMessage({ requestId, error: error?.message || 'BOT_WORKER_ERROR' });
  }
};
