export const CHESS_BOARD_SIZE = 8;
export const JANGGI_ROWS = 10;
export const JANGGI_COLS = 9;

export const OMOK_CONNECT_TARGET = 5;
export const DEFAULT_STONE_CAPTURE_WIN_TARGET = 8;
export const OMOK_STONE_TARGET_MIN = 6;
export const OMOK_STONE_TARGET_MAX = 12;
export const OMOK_STONE_TARGET_DEFAULT = 8;
export const OMOK_STONE_TARGET_OPTIONS = [6, 7, 8, 9, 10, 11, 12];

export const TURN_SECONDS_DEFAULT = 60;
export const TURN_SECONDS_MIN = 1;
export const TURN_SECONDS_MAX = 600;

export const GAME_RULES = {
  FREE: '자율선택',
  RANDOM: '랜덤배정',
  HOST: '방장선택',
};

export const MAP_TYPES = {
  CHESS: '체스판',
  JANGGI: '장기판',
};

export const FACTIONS = {
  CHESS: { code: 'chess', icon: '♔', label: 'CHESS' },
  JANGGI: { code: 'janggi', icon: '鿢', label: 'JANGGI' },
  OMOK: { code: 'omok', icon: '⚪⚫', label: 'OMOK' },
};

export const CHESS_LABELS = {
  top: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
  bottom: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
};

export const JANGGI_LABELS = {
  king: '帥',
  guard: '士',
  elephant: '象',
  horse: '馬',
  rook: '車',
  cannon: '包',
  soldier: '卒',
};

export const JANGGI_FORMATIONS = {
  an_sang: { label: '안상차림', order: ['horse', 'elephant', 'elephant', 'horse'], preview: '마-상-상-마' },
  an_ma: { label: '안마차림', order: ['elephant', 'horse', 'horse', 'elephant'], preview: '상-마-마-상' },
  left_sang: { label: '왼상차림', order: ['elephant', 'horse', 'elephant', 'horse'], preview: '상-마-상-마' },
  right_sang: { label: '오른상차림', order: ['horse', 'elephant', 'horse', 'elephant'], preview: '마-상-마-상' },
};

export const FORMATION_KEYS = Object.keys(JANGGI_FORMATIONS);

export const PIECE_COLORS = [
  { code: 'white', label: 'WHITE' },
  { code: 'black', label: 'BLACK' },
  { code: 'red', label: 'RED' },
  { code: 'blue', label: 'BLUE' },
  { code: 'green', label: 'GREEN' },
  { code: 'gold', label: 'GOLD' },
  { code: 'purple', label: 'PURPLE' },
];

export const PIECE_COLOR_HEX = {
  white: '#f7fafc',
  black: '#111827',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  gold: '#eab308',
  purple: '#a855f7',
};

export const CHESS_POOL = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'];