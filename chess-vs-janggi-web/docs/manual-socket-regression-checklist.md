# Manual Socket Regression Checklist

## 0) 실행 준비
- 터미널 A: `npm run server`
- 터미널 B: `npm run dev`
- 브라우저 2개(또는 시크릿 창 포함)로 접속
  - 클라이언트 A: 방장 역할
  - 클라이언트 B: 참가자 역할

## 1) 로그인
1. A에서 ID 입력 후 로그인
2. B에서 다른 ID로 로그인

기대 결과
- 양쪽 헤더에 로그인 사용자 정보 표시
- 접속자 수(`user_count`)가 2명으로 반영
- 로그인 실패 시 공용 알림 모달 표시

## 2) 방 생성/입장
1. A에서 방 생성(공개 방)
2. B에서 해당 방 입장

기대 결과
- A/B 모두 동일 방으로 진입
- `create_room_success` / `join_room_success` 수신
- `room_update`로 참가자 정보(p2) 동기화
- 로비 `room_list`에 상태/인원 반영

## 3) 채팅(로비 + 방)
1. 방 채팅 탭에서 A/B 각각 메시지 전송
2. 한쪽에서 채팅 드로어를 닫은 상태로 상대가 메시지 전송

기대 결과
- `send_room_message` -> `receive_room_message` 정상 왕복
- 시스템 메시지(`player_joined`, `player_left`) 노출
- 읽지 않은 방 메시지 dot/unread 카운트 반영

## 4) 설정 변경
1. A(방장)에서 룰/맵/턴 제한/진영/색상/오목 목표값 변경
2. B에서 준비 토글

기대 결과
- `update_room_settings` 반영 후 `room_update`, `room_list` 동기화
- 허용되지 않은 수정(권한/상태 위반)은 에러 이벤트와 알림 모달 표시
- 두 사용자 화면 값이 일치

## 5) 퇴장/강제종료
1. B가 `leave_room` 실행
2. B 재입장 후 브라우저 탭 강제 종료(또는 새로고침)
3. 필요 시 A가 로그아웃

기대 결과
- `leave_room_success`, `player_left`, `room_update`, `room_list` 흐름 정상
- 방장 퇴장 시 `room_closed` 수신 후 로비 복귀
- 연결 종료(`disconnect`) 시 세션 정리/알림 처리 정상

## 6) 계약/스키마 검증 포인트
다음 이벤트는 클라이언트에서 계약 검증 통과 시에만 상태 반영되어야 함:
- `room_update`: 룸 단일 객체 필수 필드/타입 검증
- `room_list`: 룸 객체 배열 전체 검증

확인 방법
- 브라우저 콘솔에 validation mismatch 경고/에러가 없는지 확인
- 유효하지 않은 payload가 들어와도 앱이 크래시하지 않고 기존 상태 유지되는지 확인

## 7) 종료 기준
아래가 모두 충족되면 회귀 테스트 통과:
- 로그인/방 생성·입장/채팅/설정 변경/퇴장·종료 플로우 모두 정상
- 에러/알림이 전역 모달로 일관 처리
- `room_update`, `room_list` 수신 시 계약 검증 실패로 인한 UI 오염 없음
