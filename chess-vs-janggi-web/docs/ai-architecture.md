# AI Architecture (통합 룰 엔진 / 평가 함수 / 탐색)

## 1) 통합 룰 엔진
- 공용 합법수 수집기: `src/ai/rule-engine/legal-moves.js`
- 입력: `board`, `side`, `getLegalMoves`, `context`
- 출력: `{ from, to, piece }[]`
- 핵심: 맵 규격(8x8, 9x10 등)은 `board` 크기와 각 게임의 `getLegalMoves` 구현에 위임

## 2) 평가 함수
- 공용 가중치: `src/ai/evaluation/weights.js`
- 명세 반영 값
  - 킹/궁: `100000`
  - 체스 폰: `100` (+전진 보너스)
  - 체스 퀸: `900`
  - 장기 차(rook, faction=janggi): `1300`
  - 장기 포(cannon): `700`
- 재료 점수 합산: `evaluateMaterial(board, side)`

## 3) 탐색 알고리즘
- 공용 미니맥스 + 알파베타: `src/ai/search/minimax.js`
- 엔트리: `minimaxAlphaBeta({ state, side, depth, alpha, beta, generateMoves, applyMove, evaluate, isTerminal })`

## 4) 단계별 개발 가이드
- Phase 1: 랜덤 선택 (`moves[Math.floor(Math.random()*moves.length)]`)
- Phase 2: 그리디 선택 (즉시 이득 최대)
- Phase 3: 미니맥스 + 알파베타 (깊이 3~4, 시간 제한)

## 5) 프론트엔드 연동
- 메인 스레드 프리징 방지를 위해 Web Worker 또는 백엔드 AI 서버 권장
- 현재 프로젝트는 공용 AI 코어를 분리했으므로 Worker 래핑이 용이

## 6) 현재 적용 상태
- 방 생성 모달에서 봇 난이도 1~3 설정 가능
- 난이도 1: 랜덤 수 선택
- 난이도 2: 그리디(즉시 이득 최대) 선택
- 난이도 3: Web Worker(`src/workers/bot-worker.js`)에서 미니맥스 + 알파베타(기본 깊이 3)
