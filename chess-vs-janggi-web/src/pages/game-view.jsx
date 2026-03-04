import React from 'react';
import './game-view.css';
import Chess from '../components/game/chess';
import Janggi from '../components/game/janggi';

// 선택된 맵 타입에 맞는 게임 컴포넌트를 라우팅합니다.
const GameView = ({ room, user, onLeave, onUpdateRoomSettings }) => {
    if (!room) return null;

    // 서버/화면 표기 차이를 흡수하기 위해 맵 이름을 정규화합니다.
    const mapValue = (room.roomMap || '').toLowerCase();
    const isChessMap = room.roomMap === '체스판' || mapValue === 'chess';
    const isJanggiMap = room.roomMap === '장기판' || mapValue === 'janggi';

    return (
        <div className="game-view-container">
            <div className="game-view-header">
                <h2 className="game-view-title">{room.title}</h2>
                <button className="game-view-leave" onClick={onLeave}>나가기</button>
            </div>

            <div className="game-view-body">
                {isChessMap ? (
                    // room: 방 상태, user: 내 정보, onUpdateRoomSettings: 게임 설정 동기화 콜백
                    <Chess room={room} user={user} onUpdateRoomSettings={onUpdateRoomSettings} />
                ) : isJanggiMap ? (
                    // room: 방 상태, user: 내 정보, onUpdateRoomSettings: 게임 설정 동기화 콜백
                    <Janggi room={room} user={user} onUpdateRoomSettings={onUpdateRoomSettings} />
                ) : (
                    <div className="game-view-notice">현재 맵은 준비 중입니다.</div>
                )}
            </div>

        </div>
    );
};

export default GameView;
