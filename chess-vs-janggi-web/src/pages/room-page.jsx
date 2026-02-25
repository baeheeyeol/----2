import React from 'react';
import './room-page.css';

const RoomPage = ({ room, user, onLeave }) => {
    return (
        <div className="room-page">
            <div className="room-header">
                <h2>{room.title}</h2>
                <button className="btn-leave" onClick={onLeave}>나가기</button>
            </div>

            <div className="game-setup-area">
                <div className="player-vs-container">
                    {/* 체스 진영 (P1) */}
                    <div className="player-box chess">
                        <div className="icon">♔</div>
                        <div className="name">{room.p1}</div>
                        <div className="side-label">CHESS</div>
                    </div>

                    <div className="vs-text">VS</div>

                    {/* 장기 진영 (P2) */}
                    <div className="player-box janggi">
                        <div className="icon">鿢</div>
                        <div className="name">{room.p2 || '상대 대기 중...'}</div>
                        <div className="side-label">JANGGI</div>
                    </div>
                </div>

                <div className="room-footer">
                    {user.id === room.p1 && (
                        <button className="btn-start" disabled={!room.p2}>
                            게임 시작
                        </button>
                    )}
                    <p className="rule-info">규칙: {room.roomRule}</p>
                </div>
            </div>
        </div>
    );
};

export default RoomPage;