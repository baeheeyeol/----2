import React, { useEffect, useRef, useState } from 'react';
import './chess.css';
import './janggi.css';
import GameResultBanner from '../shared/game-result-banner';
import GameLeftStatusPanel from '../shared/game-left-status-panel';
import GameRightStatusPanel from '../shared/game-right-status-panel';
import { playGameSound } from '../../utils/game-sound';
import { useTurnFeedback } from '../../hooks/useTurnFeedback';
import { useJanggiComputedState } from '@/hooks/game';
import { getPieceEvaluationValue } from '@/ai';
import { PIECE_COLOR_HEX, TURN_SECONDS_DEFAULT } from '@/game/constants';
import { resolveRoomReadyState } from '@/game/room-settings';
import { resolveFixedFirstTurnSide, resolveFixedPieceColorsByFirstTurn } from '@/game/turn-rules';
import {
	buildBoardFromPlacements,
	CHESS_POOL,
	COLS,
	createPiece,
	getChessRecommendedPlacements,
	getJanggiFixedPlacements,
	getLegalMoves,
	getPieceSymbol,
	hasOmokConnectTarget,
	isInsidePalace,
	normalizeFaction,
	OMOK_CONNECT_TARGET,
	ROWS,
} from '@/game/rules/janggiRules';

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

const BOT_ID_PREFIX = '[BOT';
const BOT_LEVEL2_MIN_DELAY = 360;
const BOT_LEVEL2_MAX_DELAY = 760;
const normalizeBotLevel = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return 2;
	return Math.min(3, Math.max(1, Math.floor(parsed)));
};

const isBotUserId = (value) => typeof value === 'string' && value.startsWith(BOT_ID_PREFIX);

const getCenterBonus = (row, col) => {
	const centerRow = (ROWS - 1) / 2;
	const centerCol = (COLS - 1) / 2;
	const distance = Math.abs(row - centerRow) + Math.abs(col - centerCol);
	return Math.max(0, 8 - distance);
};

const getOmokLineLength = (board, side, row, col) => {
	const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
	let best = 1;

	dirs.forEach(([dr, dc]) => {
		let count = 1;
		let nr = row + dr;
		let nc = col + dc;
		while (inBounds(nr, nc) && board[nr][nc]?.faction === 'omok' && board[nr][nc]?.side === side) {
			count += 1;
			nr += dr;
			nc += dc;
		}

		nr = row - dr;
		nc = col - dc;
		while (inBounds(nr, nc) && board[nr][nc]?.faction === 'omok' && board[nr][nc]?.side === side) {
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

	for (let row = 0; row < ROWS; row += 1) {
		for (let col = 0; col < COLS; col += 1) {
			if (board[row][col]) continue;

			const boardWithStone = board.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
			boardWithStone[row][col] = createPiece('omok', 'stone', side, true);
			const wonByConnect5 = hasOmokConnectTarget(boardWithStone, side, row, col, OMOK_CONNECT_TARGET);
			const lineScore = getOmokLineLength(boardWithStone, side, row, col);
			const centerScore = getCenterBonus(row, col);
			const score = (wonByConnect5 ? 200000 : 0) + lineScore * 40 + centerScore;

			if (!best || score > best.score || (score === best.score && Math.random() > 0.5)) {
				best = { row, col, score };
			}
		}
	}

	return best;
};

const pickRandomOmokMove = (board) => {
	const emptyCells = [];
	for (let row = 0; row < ROWS; row += 1) {
		for (let col = 0; col < COLS; col += 1) {
			if (!board[row][col]) {
				emptyCells.push({ row, col });
			}
		}
	}

	if (emptyCells.length === 0) return null;
	const randomIndex = Math.floor(Math.random() * emptyCells.length);
	return emptyCells[randomIndex] || null;
};

const isSquareThreatenedByOpponent = (board, side, row, col) => {
	const opponentSide = side === 'top' ? 'bottom' : 'top';

	for (let r = 0; r < ROWS; r += 1) {
		for (let c = 0; c < COLS; c += 1) {
			const piece = board[r][c];
			if (!piece || piece.side !== opponentSide) continue;
			const moves = getLegalMoves(board, r, c);
			if (moves.some((move) => move.row === row && move.col === col)) {
				return true;
			}
		}
	}

	return false;
};

const pickHeuristicPieceMove = (board, side) => {
	let best = null;

	for (let fromRow = 0; fromRow < ROWS; fromRow += 1) {
		for (let fromCol = 0; fromCol < COLS; fromCol += 1) {
			const moving = board[fromRow][fromCol];
			if (!moving || moving.side !== side) continue;

			const candidateMoves = getLegalMoves(board, fromRow, fromCol);
			for (const move of candidateMoves) {
				const nextBoard = board.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
				const captured = nextBoard[move.row][move.col];
				nextBoard[fromRow][fromCol] = null;
				nextBoard[move.row][move.col] = { ...moving, moved: true };

				let score = 0;
				score += getCenterBonus(move.row, move.col) * 2;
				score += (captured ? getPieceEvaluationValue(captured, { row: move.row, boardRows: ROWS }) * 14 + 50 : 0);
				score += (captured?.type === 'king' ? 180000 : 0);

				if (isSquareThreatenedByOpponent(nextBoard, side, move.row, move.col)) {
					score -= getPieceEvaluationValue(moving, { row: move.row, boardRows: ROWS }) * 7;
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

const pickRandomPieceMove = (board, side) => {
	const allMoves = [];

	for (let row = 0; row < ROWS; row += 1) {
		for (let col = 0; col < COLS; col += 1) {
			const piece = board[row][col];
			if (!piece || piece.side !== side) continue;
			const legal = getLegalMoves(board, row, col);
			legal.forEach((to) => {
				allMoves.push({ from: { row, col }, to });
			});
		}
	}

	if (allMoves.length === 0) return null;
	const randomIndex = Math.floor(Math.random() * allMoves.length);
	return allMoves[randomIndex] || null;
};

const Janggi = ({ room, user, onUpdateRoomSettings }) => {
	const isHost = user?.id === room?.p1;
	const myKey = isHost ? 'p1' : 'p2';
	const opponentKey = myKey === 'p1' ? 'p2' : 'p1';
	const mySide = myKey === 'p1' ? 'top' : 'bottom';

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
	const [warningSoundEnabled, setWarningSoundEnabled] = useState(true);
	const [invalidPlacementNoticeVisible, setInvalidPlacementNoticeVisible] = useState(false);
	const botTurnTimerRef = useRef(null);
	const botWorkerRef = useRef(null);
	const botWorkerRequestSeqRef = useRef(0);
	const botWorkerPendingRef = useRef(new Map());

	const myCustomLayout = Array.isArray(gameSetup[`${myKey}CustomLayout`]) ? gameSetup[`${myKey}CustomLayout`] : [];
	const opponentCustomLayout = Array.isArray(gameSetup[`${opponentKey}CustomLayout`]) ? gameSetup[`${opponentKey}CustomLayout`] : [];

	const playEventSound = (soundKey) => {
		playGameSound(soundKey, { enabled: warningSoundEnabled });
	};

	const emitPatch = (patch) => {
		const nextSetup = { ...gameSetup, ...patch };
		if (room?.isBotRoom) {
			nextSetup.p2Ready = true;
		}
		onUpdateRoomSettings?.({ gameSetup: nextSetup });
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

	const {
		opponentMode,
		setupBoard,
		battleBoard,
		canReady,
		remainingPool,
		legalSet,
	} = useJanggiComputedState({
		gameSetup,
		myKey,
		opponentKey,
		mySide,
		myFaction,
		opponentFaction,
		myMode,
		myRecommendedSide,
		opponentRecommendedSide,
		myCustomLayout,
		opponentCustomLayout,
		isMyChess,
		legalMoves,
		rows: ROWS,
		chessPool: CHESS_POOL,
		getJanggiFixedPlacements,
		getChessRecommendedPlacements,
		buildBoardFromPlacements,
	});

	const readyState = resolveRoomReadyState(room, gameSetup);
	const canHostStart = isHost && readyState.p1Ready && readyState.p2Ready;
	const currentTurn = gameSetup.turnSide || 'top';
	const winnerId = gameSetup.winner === 'top' ? room?.p1 : gameSetup.winner === 'bottom' ? room?.p2 : null;
	const loserId = gameSetup.winner === 'top' ? room?.p2 : gameSetup.winner === 'bottom' ? room?.p1 : null;
	const turnLimitSeconds = Number(room?.turnSeconds) > 0 ? Number(room.turnSeconds) : 60;

	// 타임아웃 시 턴 전환은 호스트만 반영합니다.
	const handleTurnTimeout = () => {
		const nextTurn = currentTurn === 'top' ? 'bottom' : 'top';
		setSelectedCell(null);
		setLegalMoves([]);

		emitPatch({
			started: true,
			turnSide: nextTurn,
			winner: null,
			winnerReason: null,
		});
	};

	// 턴 제한/경고/시작 안내/승패 사운드를 단일 훅으로 처리합니다.
	const { remainingSeconds, turnStartNotice } = useTurnFeedback({
		started: !!gameSetup.started,
		winner: gameSetup.winner,
		turnToken: currentTurn,
		firstTurnSide: gameSetup.firstTurn,
		currentTurnSide: currentTurn,
		mySide,
		limitSeconds: turnLimitSeconds,
		isHost,
		warningEnabled: warningSoundEnabled,
		onWarning: () => playEventSound('warning'),
		onTimeout: handleTurnTimeout,
		playEventSound,
	});

	// 잘못된 배치 안내 문구를 잠시 보여준 뒤 자동으로 닫습니다.
	useEffect(() => {
		if (!invalidPlacementNoticeVisible) return;
		const timeout = window.setTimeout(() => setInvalidPlacementNoticeVisible(false), 1200);
		return () => window.clearTimeout(timeout);
	}, [invalidPlacementNoticeVisible]);

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
		const first = resolveFixedFirstTurnSide(room?.p1Faction, room?.p2Faction);
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

		const applyOmokPlacementMove = (targetRow, targetCol) => {
			if (battleBoard[targetRow][targetCol]) return false;
			const nextBoard = battleBoard.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
			nextBoard[targetRow][targetCol] = createPiece('omok', 'stone', currentTurn, true);
			playEventSound('move');

			const nextTurn = currentTurn === 'top' ? 'bottom' : 'top';
			const wonByConnect5 = hasOmokConnectTarget(nextBoard, currentTurn, targetRow, targetCol, OMOK_CONNECT_TARGET);
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
				lastMove: { from: null, to: { row: targetRow, col: targetCol }, piece: nextBoard[targetRow][targetCol] },
			});

			setSelectedCell(null);
			setLegalMoves([]);
			return true;
		};

		const applyPieceBattleMove = (fromCell, move) => {
			const moving = battleBoard[fromCell.row][fromCell.col];
			if (!moving) return false;

			const nextBoard = battleBoard.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
			const captured = nextBoard[move.row][move.col];
			nextBoard[fromCell.row][fromCell.col] = null;
			nextBoard[move.row][move.col] = { ...moving, moved: true };

			const nextCaptured = {
				top: [...(gameSetup.capturedBySide?.top || [])],
				bottom: [...(gameSetup.capturedBySide?.bottom || [])],
			};
			if (captured) nextCaptured[currentTurn].push(captured);
			playEventSound(captured ? 'capture' : 'move');

			const winner = captured?.type === 'king' ? currentTurn : null;
			const nextTurn = currentTurn === 'top' ? 'bottom' : 'top';

			emitPatch({
				started: true,
				battleBoard: nextBoard,
				turnSide: nextTurn,
				winner,
				winnerReason: winner ? 'capture' : null,
				capturedBySide: nextCaptured,
				lastMove: { from: fromCell, to: { row: move.row, col: move.col }, piece: nextBoard[move.row][move.col] },
			});

			setSelectedCell(null);
			setLegalMoves([]);
			return true;
		};

		if (currentTurnFaction === 'omok') {
			applyOmokPlacementMove(row, col);
			return;
		}

		const clicked = battleBoard[row][col];
		if (selectedCell) {
			const move = legalMoves.find((m) => m.row === row && m.col === col);
			if (move) {
				applyPieceBattleMove(selectedCell, move);
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

	useEffect(() => {
		if (!gameSetup.started || gameSetup.winner) return;

		const turnUserId = currentTurn === 'top' ? room?.p1 : room?.p2;
		if (!isBotUserId(turnUserId)) return;
		const botLevel = normalizeBotLevel(room?.botLevel);

		if (botTurnTimerRef.current) {
			window.clearTimeout(botTurnTimerRef.current);
		}

		const delay = BOT_LEVEL2_MIN_DELAY + Math.floor(Math.random() * (BOT_LEVEL2_MAX_DELAY - BOT_LEVEL2_MIN_DELAY + 1));
		botTurnTimerRef.current = window.setTimeout(async () => {
			botTurnTimerRef.current = null;

			const sideFactionForTurn = mySide === 'top'
				? { top: myFaction, bottom: opponentFaction }
				: { top: opponentFaction, bottom: myFaction };
			const turnFaction = sideFactionForTurn[currentTurn] || 'janggi';

			if (turnFaction === 'omok') {
				const omokMove = botLevel === 3
					? await requestBotWorkerMove({
						variant: 'janggi',
						mode: 'omok',
						level: botLevel,
						board: battleBoard,
						side: currentTurn,
						turnFaction,
						sideFactions: sideFactionForTurn,
					})
					: botLevel === 1
						? pickRandomOmokMove(battleBoard)
						: pickHeuristicOmokMove(battleBoard, currentTurn);
				if (!omokMove) return;

				const nextBoard = battleBoard.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
				nextBoard[omokMove.row][omokMove.col] = createPiece('omok', 'stone', currentTurn, true);
				playEventSound('move');

				const nextTurn = currentTurn === 'top' ? 'bottom' : 'top';
				const wonByConnect5 = hasOmokConnectTarget(nextBoard, currentTurn, omokMove.row, omokMove.col, OMOK_CONNECT_TARGET);
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
					lastMove: { from: null, to: { row: omokMove.row, col: omokMove.col }, piece: nextBoard[omokMove.row][omokMove.col] },
				});
				setSelectedCell(null);
				setLegalMoves([]);
				return;
			}

			let pieceMove = null;
			if (botLevel === 3) {
				pieceMove = await requestBotWorkerMove({
					variant: 'janggi',
					mode: 'piece',
					level: botLevel,
					board: battleBoard,
					side: currentTurn,
					turnFaction,
					sideFactions: sideFactionForTurn,
				});
			} else if (botLevel === 2) {
				pieceMove = pickHeuristicPieceMove(battleBoard, currentTurn);
			} else {
				pieceMove = pickRandomPieceMove(battleBoard, currentTurn);
			}
			if (!pieceMove) {
				const nextTurn = currentTurn === 'top' ? 'bottom' : 'top';
				emitPatch({
					started: true,
					turnSide: nextTurn,
					winner: null,
					winnerReason: null,
				});
				setSelectedCell(null);
				setLegalMoves([]);
				return;
			}

			const moving = battleBoard[pieceMove.from.row][pieceMove.from.col];
			if (!moving) return;

			const nextBoard = battleBoard.map((line) => line.map((cell) => (cell ? { ...cell } : null)));
			const captured = nextBoard[pieceMove.to.row][pieceMove.to.col];
			nextBoard[pieceMove.from.row][pieceMove.from.col] = null;
			nextBoard[pieceMove.to.row][pieceMove.to.col] = { ...moving, moved: true };

			const nextCaptured = {
				top: [...(gameSetup.capturedBySide?.top || [])],
				bottom: [...(gameSetup.capturedBySide?.bottom || [])],
			};
			if (captured) nextCaptured[currentTurn].push(captured);
			playEventSound(captured ? 'capture' : 'move');

			const winner = captured?.type === 'king' ? currentTurn : null;
			const nextTurn = currentTurn === 'top' ? 'bottom' : 'top';

			emitPatch({
				started: true,
				battleBoard: nextBoard,
				turnSide: nextTurn,
				winner,
				winnerReason: winner ? 'capture' : null,
				capturedBySide: nextCaptured,
				lastMove: { from: pieceMove.from, to: { row: pieceMove.to.row, col: pieceMove.to.col }, piece: nextBoard[pieceMove.to.row][pieceMove.to.col] },
			});
			setSelectedCell(null);
			setLegalMoves([]);
		}, delay);

		return () => {
			if (botTurnTimerRef.current) {
				window.clearTimeout(botTurnTimerRef.current);
				botTurnTimerRef.current = null;
			}
		};
	}, [
		gameSetup.started,
		gameSetup.winner,
		currentTurn,
		room?.p1,
		room?.p2,
		room?.botLevel,
		mySide,
		myFaction,
		opponentFaction,
		battleBoard,
		gameSetup.capturedBySide,
	]);

	const isFlipped = mySide === 'top';
	const topUserId = room?.p1 || 'TOP';
	const bottomUserId = room?.p2 || 'BOTTOM';
	const fixedFirstTurnSide = gameSetup.firstTurn || resolveFixedFirstTurnSide(room?.p1Faction, room?.p2Faction);
	const fixedColors = resolveFixedPieceColorsByFirstTurn(room?.p1Faction, room?.p2Faction, fixedFirstTurnSide);
	const myDefaultColor = myKey === 'p1' ? fixedColors.p1Color : fixedColors.p2Color;
	const opponentDefaultColor = opponentKey === 'p1' ? fixedColors.p1Color : fixedColors.p2Color;
	const myColorCode = room?.[`${myKey}Color`] || myDefaultColor;
	const opponentColorCode = room?.[`${opponentKey}Color`] || opponentDefaultColor;
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
	const uiOpponentReady = opponentReady || !!room?.isBotRoom;
	const opponentStatusText = uiOpponentReady ? '준비 완료' : '준비 중';
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
				{/* 좌측 패널: 턴/타이머/경고음 토글 상태를 표시합니다. */}
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

				{/* 우측 패널: 준비/시작/룰/포획 정보 및 배치 UI를 담당합니다. */}
				<GameRightStatusPanel
					myReady={myReady}
					opponentReady={uiOpponentReady}
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
