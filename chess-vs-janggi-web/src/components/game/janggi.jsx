import React, { useEffect, useMemo, useRef, useState } from 'react';
import './chess.css';
import './janggi.css';
import GameResultBanner from '../shared/game-result-banner';
import GameLeftStatusPanel from '../shared/game-left-status-panel';
import GameRightStatusPanel from '../shared/game-right-status-panel';

const ROWS = 10;
const COLS = 9;
const OMOK_CONNECT_TARGET = 5;

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

const PIECE_COLOR_HEX = {
	white: '#f7fafc',
	black: '#111827',
	red: '#ef4444',
	blue: '#3b82f6',
	green: '#22c55e',
	gold: '#eab308',
	purple: '#a855f7',
};

const DEFAULT_SETUP = {
	started: false,
	turnSide: null,
	firstTurn: null,
	winner: null,
	winnerReason: null,
	battleBoard: null,
	lastMove: null,
	capturedBySide: { top: [], bottom: [] },
	p1Ready: false,
	p2Ready: false,
	p1Mode: 'recommended',
	p2Mode: 'recommended',
	p1RecommendedSide: 'left',
	p2RecommendedSide: 'left',
	p1CustomLayout: [],
	p2CustomLayout: [],
};

const createEmptyBoard = () => Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
const inBounds = (row, col) => row >= 0 && row < ROWS && col >= 0 && col < COLS;
const getDirection = (side) => (side === 'top' ? 1 : -1);

const isInsidePalace = (side, row, col) => {
	if (!inBounds(row, col)) return false;
	if (col < 3 || col > 5) return false;
	if (side === 'top') return row >= 0 && row <= 2;
	return row >= 7 && row <= 9;
};

const isPalaceDiagonalStep = (fromRow, fromCol, toRow, toCol, side) => {
	if (!isInsidePalace(side, fromRow, fromCol) || !isInsidePalace(side, toRow, toCol)) return false;
	return Math.abs(fromRow - toRow) === 1 && Math.abs(fromCol - toCol) === 1;
};

const normalizeFaction = (value) => {
	if (!value) return 'chess';
	const lower = String(value).toLowerCase();
	if (lower.includes('janggi') || value === '장기') return 'janggi';
	if (lower.includes('omok') || value === '오목') return 'omok';
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
	if (piece.faction === 'omok') return '';
	if (piece.faction === 'janggi') return JANGGI_LABELS[piece.type] || '卒';
	return CHESS_LABELS[piece.side]?.[piece.type] || '♟';
};

const hasOmokConnectTarget = (board, side, row, col, target = OMOK_CONNECT_TARGET) => {
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

const getJanggiFixedPlacements = (side) => {
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

const getChessRecommendedPlacements = (side, recommendedSide = 'left') => {
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

const CHESS_POOL = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'];

const canCapture = (piece, target) => !!target && target.side !== piece.side;

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

const getChessMoves = (board, piece, row, col) => {
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

const getJanggiMoves = (board, piece, row, col) => {
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

const getLegalMoves = (board, row, col) => {
	const piece = board[row][col];
	if (!piece) return [];
	return piece.faction === 'chess' ? getChessMoves(board, piece, row, col) : getJanggiMoves(board, piece, row, col);
};

const buildBoardFromPlacements = (topPlacements, bottomPlacements) => {
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

const Janggi = ({ room, user, onUpdateRoomSettings }) => {
	const isHost = user?.id === room?.p1;
	const myKey = isHost ? 'p1' : 'p2';
	const opponentKey = myKey === 'p1' ? 'p2' : 'p1';
	const mySide = myKey === 'p1' ? 'top' : 'bottom';
	const opponentSide = mySide === 'top' ? 'bottom' : 'top';

	const myFaction = normalizeFaction(room?.[`${myKey}Faction`]);
	const opponentFaction = normalizeFaction(room?.[`${opponentKey}Faction`]);
	const isMyChess = myFaction === 'chess';

	const gameSetup = { ...DEFAULT_SETUP, ...(room?.gameSetup || {}) };
	const myMode = gameSetup[`${myKey}Mode`] || 'recommended';
	const myRecommendedSide = gameSetup[`${myKey}RecommendedSide`] === 'right' ? 'right' : 'left';
	const opponentRecommendedSide = gameSetup[`${opponentKey}RecommendedSide`] === 'right' ? 'right' : 'left';
	const myReady = !!gameSetup[`${myKey}Ready`];
	const opponentReady = !!gameSetup[`${opponentKey}Ready`];

	const [selectedPoolPiece, setSelectedPoolPiece] = useState(null);
	const [selectedCell, setSelectedCell] = useState(null);
	const [legalMoves, setLegalMoves] = useState([]);
	const [remainingSeconds, setRemainingSeconds] = useState(60);
	const [warningSoundEnabled, setWarningSoundEnabled] = useState(true);
	const [invalidPlacementNoticeVisible, setInvalidPlacementNoticeVisible] = useState(false);
	const [turnStartNotice, setTurnStartNotice] = useState('');
	const turnStartNoticeTimerRef = useRef(null);
	const prevStartedRef = useRef(false);

	const myCustomLayout = Array.isArray(gameSetup[`${myKey}CustomLayout`]) ? gameSetup[`${myKey}CustomLayout`] : [];
	const opponentCustomLayout = Array.isArray(gameSetup[`${opponentKey}CustomLayout`]) ? gameSetup[`${opponentKey}CustomLayout`] : [];

	const emitPatch = (patch) => {
		onUpdateRoomSettings?.({ gameSetup: { ...gameSetup, ...patch } });
	};

	const myDefault = useMemo(() => {
		if (myFaction === 'janggi') return getJanggiFixedPlacements(mySide);
		if (myFaction === 'omok') return [];
		return getChessRecommendedPlacements(mySide, myRecommendedSide);
	}, [myFaction, mySide, myRecommendedSide]);

	const opponentDefault = useMemo(() => {
		if (opponentFaction === 'janggi') return getJanggiFixedPlacements(opponentSide);
		if (opponentFaction === 'omok') return [];
		return getChessRecommendedPlacements(opponentSide, opponentRecommendedSide);
	}, [opponentFaction, opponentSide, opponentRecommendedSide]);

	const topPlacements = useMemo(() => {
		const topFaction = mySide === 'top' ? myFaction : opponentFaction;
		const topMode = mySide === 'top' ? myMode : (gameSetup[`${opponentKey}Mode`] || 'recommended');
		const topCustom = mySide === 'top' ? myCustomLayout : opponentCustomLayout;
		const topDefault = mySide === 'top' ? myDefault : opponentDefault;
		if (topFaction === 'chess' && topMode === 'custom') return topCustom;
		return topDefault;
	}, [mySide, myFaction, opponentFaction, myMode, gameSetup, opponentKey, myCustomLayout, opponentCustomLayout, myDefault, opponentDefault]);

	const bottomPlacements = useMemo(() => {
		const bottomFaction = mySide === 'bottom' ? myFaction : opponentFaction;
		const bottomMode = mySide === 'bottom' ? myMode : (gameSetup[`${opponentKey}Mode`] || 'recommended');
		const bottomCustom = mySide === 'bottom' ? myCustomLayout : opponentCustomLayout;
		const bottomDefault = mySide === 'bottom' ? myDefault : opponentDefault;
		if (bottomFaction === 'chess' && bottomMode === 'custom') return bottomCustom;
		return bottomDefault;
	}, [mySide, myFaction, opponentFaction, myMode, gameSetup, opponentKey, myCustomLayout, opponentCustomLayout, myDefault, opponentDefault]);

	const setupBoard = useMemo(() => buildBoardFromPlacements(topPlacements, bottomPlacements), [topPlacements, bottomPlacements]);
	const battleBoard = useMemo(() => {
		if (Array.isArray(gameSetup.battleBoard) && gameSetup.battleBoard.length === ROWS) return gameSetup.battleBoard;
		return setupBoard;
	}, [gameSetup.battleBoard, setupBoard]);

	const canHostStart = isHost && gameSetup.p1Ready && gameSetup.p2Ready;
	const currentTurn = gameSetup.turnSide || 'top';
	const winnerId = gameSetup.winner === 'top' ? room?.p1 : gameSetup.winner === 'bottom' ? room?.p2 : null;
	const loserId = gameSetup.winner === 'top' ? room?.p2 : gameSetup.winner === 'bottom' ? room?.p1 : null;
	const turnLimitSeconds = Number(room?.turnSeconds) > 0 ? Number(room.turnSeconds) : 60;

	useEffect(() => {
		if (!gameSetup.started || gameSetup.winner) {
			setRemainingSeconds(turnLimitSeconds);
			return;
		}
		setRemainingSeconds(turnLimitSeconds);
	}, [turnLimitSeconds, gameSetup.started, gameSetup.winner, gameSetup.turnSide]);

	useEffect(() => {
		if (!gameSetup.started || gameSetup.winner) return;
		const timer = window.setInterval(() => {
			setRemainingSeconds((prev) => Math.max(0, prev - 1));
		}, 1000);
		return () => window.clearInterval(timer);
	}, [gameSetup.started, gameSetup.winner, gameSetup.turnSide]);

	useEffect(() => {
		if (!gameSetup.started || gameSetup.winner) return;
		if (remainingSeconds > 0) return;
		if (!isHost) return;

		const nextTurn = currentTurn === 'top' ? 'bottom' : 'top';
		setSelectedCell(null);
		setLegalMoves([]);

		emitPatch({
			started: true,
			turnSide: nextTurn,
			winner: null,
			winnerReason: null,
		});
	}, [remainingSeconds, gameSetup.started, gameSetup.winner, isHost, currentTurn]);

	useEffect(() => {
		if (!invalidPlacementNoticeVisible) return;
		const timeout = window.setTimeout(() => setInvalidPlacementNoticeVisible(false), 1200);
		return () => window.clearTimeout(timeout);
	}, [invalidPlacementNoticeVisible]);

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
			const firstTurnSide = gameSetup.firstTurn || currentTurn;
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
	}, [gameSetup.started, gameSetup.firstTurn, mySide, currentTurn]);

	useEffect(() => {
		return () => {
			if (turnStartNoticeTimerRef.current) {
				clearTimeout(turnStartNoticeTimerRef.current);
			}
		};
	}, []);

	const myPlacedChess = myCustomLayout.filter((item) => item.faction === 'chess').length;
	const canReady = !(isMyChess && myMode === 'custom') || myPlacedChess >= CHESS_POOL.length;

	const isMySetupZone = (row) => (mySide === 'top' ? row <= 2 : row >= 7);
	const showInvalidPlacementNotice = () => setInvalidPlacementNoticeVisible(true);

	const onToggleReady = () => {
		if (!canReady) return;
		emitPatch({ [`${myKey}Ready`]: !myReady, started: false });
	};

	const onModeChange = (nextMode) => {
		if (!isMyChess) return;
		emitPatch({ [`${myKey}Mode`]: nextMode, [`${myKey}Ready`]: false, started: false });
	};

	const updateMyCustom = (nextCustom) => {
		emitPatch({ [`${myKey}CustomLayout`]: nextCustom, [`${myKey}Ready`]: false, started: false });
	};

	const onRecommendedSideChange = (nextRecommendedSide) => {
		if (!isMyChess || myMode !== 'recommended') return;
		emitPatch({ [`${myKey}RecommendedSide`]: nextRecommendedSide, [`${myKey}Ready`]: false, started: false });
	};

	const onStart = () => {
		if (!canHostStart) return;
		const first = Math.random() < 0.5 ? 'top' : 'bottom';
		emitPatch({
			started: true,
			turnSide: first,
			firstTurn: first,
			winner: null,
			winnerReason: null,
			battleBoard: setupBoard,
			capturedBySide: { top: [], bottom: [] },
			lastMove: null,
		});
	};

	const onExit = () => {
		onUpdateRoomSettings?.({
			p1Ready: false,
			p2Ready: false,
			gameSetup: {
				...DEFAULT_SETUP,
				p1Mode: gameSetup.p1Mode || 'recommended',
				p2Mode: gameSetup.p2Mode || 'recommended',
					p1RecommendedSide: gameSetup.p1RecommendedSide || 'left',
					p2RecommendedSide: gameSetup.p2RecommendedSide || 'left',
				p1CustomLayout: gameSetup.p1CustomLayout || [],
				p2CustomLayout: gameSetup.p2CustomLayout || [],
			},
		});
	};

	const onPointClick = (row, col) => {
		if (!gameSetup.started) {
			if (!isMyChess || myMode !== 'custom') return;
			if (!isMySetupZone(row)) {
				showInvalidPlacementNotice();
				return;
			}

			const existing = myCustomLayout.find((item) => item.row === row && item.col === col);
			if (existing) {
				updateMyCustom(myCustomLayout.filter((item) => !(item.row === row && item.col === col)));
				return;
			}
			if (!selectedPoolPiece) {
				showInvalidPlacementNotice();
				return;
			}
			if (setupBoard[row][col] && setupBoard[row][col].side !== mySide) {
				showInvalidPlacementNotice();
				return;
			}

			const next = myCustomLayout.filter((item) => !(item.row === row && item.col === col));
			next.push({ type: selectedPoolPiece, row, col, faction: 'chess' });
			updateMyCustom(next);
			return;
		}

		if (gameSetup.winner) return;
		if (currentTurnUserId && currentTurnUserId !== user?.id) return;
		const currentTurnFaction = sideFaction[currentTurn] || 'janggi';

		if (currentTurnFaction === 'omok') {
			if (battleBoard[row][col]) return;
			const nextBoard = battleBoard.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
			nextBoard[row][col] = createPiece('omok', 'stone', currentTurn, true);

			const nextTurn = currentTurn === 'top' ? 'bottom' : 'top';
			const wonByConnect5 = hasOmokConnectTarget(nextBoard, currentTurn, row, col, OMOK_CONNECT_TARGET);
			const winner = wonByConnect5 ? currentTurn : null;

			emitPatch({
				started: true,
				battleBoard: nextBoard,
				turnSide: nextTurn,
				winner,
				winnerReason: winner ? 'connect5' : null,
				capturedBySide: {
					top: [...(gameSetup.capturedBySide?.top || [])],
					bottom: [...(gameSetup.capturedBySide?.bottom || [])],
				},
				lastMove: { from: null, to: { row, col }, piece: nextBoard[row][col] },
			});

			setSelectedCell(null);
			setLegalMoves([]);
			return;
		}

		const clicked = battleBoard[row][col];
		if (selectedCell) {
			const move = legalMoves.find((m) => m.row === row && m.col === col);
			if (move) {
				const moving = battleBoard[selectedCell.row][selectedCell.col];
				if (!moving) return;

				const nextBoard = battleBoard.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
				const captured = nextBoard[row][col];
				nextBoard[selectedCell.row][selectedCell.col] = null;
				nextBoard[row][col] = { ...moving, moved: true };

				const nextCaptured = {
					top: [...(gameSetup.capturedBySide?.top || [])],
					bottom: [...(gameSetup.capturedBySide?.bottom || [])],
				};
				if (captured) nextCaptured[currentTurn].push(captured);

				const winner = captured?.type === 'king' ? currentTurn : null;
				const nextTurn = currentTurn === 'top' ? 'bottom' : 'top';

				emitPatch({
					started: true,
					battleBoard: nextBoard,
					turnSide: nextTurn,
					winner,
					winnerReason: winner ? 'capture' : null,
					capturedBySide: nextCaptured,
					lastMove: { from: selectedCell, to: { row, col }, piece: nextBoard[row][col] },
				});

				setSelectedCell(null);
				setLegalMoves([]);
				return;
			}
		}

		if (!clicked || clicked.side !== currentTurn) {
			setSelectedCell(null);
			setLegalMoves([]);
			return;
		}

		setSelectedCell({ row, col });
		setLegalMoves(getLegalMoves(battleBoard, row, col));
	};

	const occupiedCountByType = useMemo(() => {
		const countMap = new Map();
		myCustomLayout.forEach((item) => countMap.set(item.type, (countMap.get(item.type) || 0) + 1));
		return countMap;
	}, [myCustomLayout]);

	const remainingPool = useMemo(() => {
		const temp = new Map(occupiedCountByType);
		return CHESS_POOL.map((type, index) => {
			const used = temp.get(type) || 0;
			if (used > 0) {
				temp.set(type, used - 1);
				return null;
			}
			return { id: `${type}-${index}`, type };
		}).filter(Boolean);
	}, [occupiedCountByType]);

	const legalSet = new Set(legalMoves.map((m) => `${m.row}-${m.col}`));
	const isFlipped = mySide === 'top';
    const topUserId = room?.p1 || 'TOP';
	const bottomUserId = room?.p2 || 'BOTTOM';
	const myColorCode = room?.[`${myKey}Color`] || (isHost ? 'white' : 'black');
	const opponentColorCode = room?.[`${opponentKey}Color`] || (isHost ? 'black' : 'white');
	const myPieceColor = PIECE_COLOR_HEX[myColorCode] || PIECE_COLOR_HEX.white;
	const opponentPieceColor = PIECE_COLOR_HEX[opponentColorCode] || PIECE_COLOR_HEX.black;
	const getPieceColorBySide = (side) => (side === mySide ? myPieceColor : opponentPieceColor);
	const currentTurnUserId = currentTurn === 'top' ? topUserId : bottomUserId;
	const sideFaction = mySide === 'top'
		? { top: myFaction, bottom: opponentFaction }
		: { top: opponentFaction, bottom: myFaction };
	const firstTurnSide = gameSetup.firstTurn || currentTurn;
	const firstTurnUserId = firstTurnSide === 'top' ? topUserId : bottomUserId;
	const activeSide = gameSetup.started ? currentTurn : firstTurnSide;
	const myStatusText = myReady ? '준비 완료' : '준비 중';
	const opponentStatusText = opponentReady ? '준비 완료' : '준비 중';
	const myCaptured = gameSetup.capturedBySide?.[mySide] || [];
	const hasOmokPlayer = myFaction === 'omok' || opponentFaction === 'omok';
	const commonRules = [
		'공용: 턴 시간이 0초가 되면 상대 턴으로 자동 전환됩니다.',
		'공용: 상대 왕/궁을 포획하면 즉시 승리합니다.',
		'공용: 내 화면 기준 내 기물은 항상 하단에 표시됩니다.',
		'공용: 장기 기물은 장기 규칙 이동을 따릅니다.',
		'공용: 체스 자율배치는 내 진영 3줄 안에서만 가능합니다.',
		'공용: 체스 추천배치는 좌배치/우배치를 선택할 수 있습니다.',
	];

	const sideRules = [];
	if (myFaction === 'omok') {
		sideRules.push(`내 진영(오목): 빈 칸에만 착수하며 ${OMOK_CONNECT_TARGET}목 완성 시 승리합니다.`);
	}
	if (opponentFaction === 'omok') {
		sideRules.push(`상대 진영(오목): 빈 칸에만 착수하며 ${OMOK_CONNECT_TARGET}목 완성 시 승리합니다.`);
	}

	const ruleItems = hasOmokPlayer ? [...commonRules, ...sideRules] : commonRules;

	const displayToBoard = (dr, dc) => (isFlipped ? { row: ROWS - 1 - dr, col: COLS - 1 - dc } : { row: dr, col: dc });

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
					alertSide={null}
					alertText=""
					alertType={null}
				/>

				<div className="chess-board-area janggi-board-area">
					<div className="janggi-board-shell">
						<div className="janggi-board" role="grid" aria-label="장기판">
							{Array.from({ length: ROWS }, (_, dr) =>
								Array.from({ length: COLS }, (_, dc) => {
									const { row, col } = displayToBoard(dr, dc);
									const piece = (gameSetup.started ? battleBoard : setupBoard)[row][col];
									const selected = selectedCell?.row === row && selectedCell?.col === col;
									const legal = legalSet.has(`${row}-${col}`);
									const palace = isInsidePalace('top', row, col) || isInsidePalace('bottom', row, col);

									return (
										<button
											key={`${dr}-${dc}`}
											type="button"
											className={`janggi-point ${palace ? 'palace' : ''} ${selected ? 'selected' : ''} ${legal ? 'legal' : ''}`}
											onClick={() => onPointClick(row, col)}
										>
											{piece && <span className={`janggi-piece ${piece.faction === 'omok' ? 'omok-stone' : ''} ${piece.side === mySide ? 'mine' : 'opponent'}`} style={{ color: getPieceColorBySide(piece.side) }}>{getPieceSymbol(piece)}</span>}
										</button>
									);
								}),
							)}
						</div>
					</div>
					{invalidPlacementNoticeVisible && (
						<div className="janggi-setup-notice" role="status" aria-live="polite">
							둘 수 없는 자리입니다.
						</div>
					)}
					{turnStartNotice && (
						<>
							<div className="turn-start-backdrop" aria-hidden="true" />
							<div className="turn-start-notice" role="status" aria-live="polite">
								{turnStartNotice}
							</div>
						</>
					)}
				</div>

				<GameRightStatusPanel
					myReady={myReady}
					opponentReady={opponentReady}
					myStatusText={myStatusText}
					opponentStatusText={opponentStatusText}
					canToggleReady={canReady}
					gameStarted={gameSetup.started}
					onToggleReady={onToggleReady}
					showStartButton={isHost}
					canHostStart={canHostStart}
					onStart={onStart}
					customReadyHint={!canReady && isMyChess && myMode === 'custom' ? '자율배치에서는 모든 기물을 배치해야 준비할 수 있습니다.' : ''}
					ruleItems={ruleItems}
					capturedPieces={myCaptured}
						renderCapturedPiece={(piece) => (
							<span key={piece.id} className={`reserve-piece captured-piece ${piece.faction === 'omok' ? 'omok-stone' : ''}`} style={{ color: getPieceColorBySide(piece.side) }}>
							{getPieceSymbol(piece)}
						</span>
					)}
					setupChildren={!gameSetup.started && isMyChess ? (
						<div className="janggi-setup">
							<div className="janggi-setup-row">
								<button type="button" className={`janggi-mode-btn ${myMode === 'recommended' ? 'active' : ''}`} onClick={() => onModeChange('recommended')}>
									추천배치
								</button>
								<button type="button" className={`janggi-mode-btn ${myMode === 'custom' ? 'active' : ''}`} onClick={() => onModeChange('custom')}>
									자율배치
								</button>
							</div>
							{myMode === 'recommended' && (
								<div className="janggi-setup-row">
									<button
										type="button"
										className={`janggi-mode-btn ${myRecommendedSide === 'left' ? 'active' : ''}`}
										onClick={() => onRecommendedSideChange('left')}
									>
										좌배치
									</button>
									<button
										type="button"
										className={`janggi-mode-btn ${myRecommendedSide === 'right' ? 'active' : ''}`}
										onClick={() => onRecommendedSideChange('right')}
									>
										우배치
									</button>
								</div>
							)}
							{myMode === 'custom' && (
								<div className="janggi-pool">
									{remainingPool.map((item) => (
										<button
											key={item.id}
											type="button"
											className={`janggi-pool-piece ${selectedPoolPiece === item.type ? 'active' : ''}`}
											onClick={() => setSelectedPoolPiece(item.type)}
										>
											{getPieceSymbol({ faction: 'chess', type: item.type, side: mySide })}
										</button>
									))}
								</div>
							)}
						</div>
					) : null}
				/>

				<GameResultBanner
					isVisible={!!gameSetup.winner}
					winnerId={winnerId}
					loserId={loserId}
					onExit={onExit}
				/>
			</div>
		</div>
	);
};

export default Janggi;
