import React from 'react';
import './game-view.css';
import Chess from '../components/game/chess';
import Omok from '../components/game/omok';

const GameView = ({ room, user, onLeave, onUpdateRoomSettings }) => {
    if (!room) return null;

    const mapValue = (room.roomMap || '').toLowerCase();
    const isChessMap = room.roomMap === '체스판' || mapValue === 'chess';
    const isOmokMap = room.roomMap === '바둑판' || mapValue === 'omok' || mapValue === 'baduk';

    return (
        <div className="game-view-container">
            <div className="game-view-header">
                <h2 className="game-view-title">{room.title}</h2>
                <button className="game-view-leave" onClick={onLeave}>나가기</button>
            </div>

            <div className="game-view-body">
                {isChessMap ? (
                    <Chess room={room} user={user} onUpdateRoomSettings={onUpdateRoomSettings} />
                ) : isOmokMap ? (
                    <Omok room={room} user={user} onUpdateRoomSettings={onUpdateRoomSettings} />
                ) : (
                    <div className="game-view-notice">현재 맵은 준비 중입니다.</div>
                )}
            </div>

        </div>
    );
};

export default GameView;
