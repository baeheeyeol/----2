import React from 'react';

const RoomListItem = ({ room, onJoin }) => {
    // 상태에 따른 색상 클래스 결정
    const statusClass = room.status === 'WAITING' ? 'waiting' : 'playing';
    const statusText = room.status === 'WAITING' ? '대기중' : '게임중';

    return (
        <div className={`room-item-card ${statusClass}`}>
            <div className="room-info-header">
                <span className="room-number">No.{room.id}</span>
                <h3 className="room-title">{room.title}</h3>
                <span className={`status-tag ${statusClass}`}>{statusText}</span>
            </div>

            <div className="room-info-body">
                <div className="info-row">
                    <span className="label">방장:</span>
                    <span className="value">{room.p1}</span>
                </div>
                <div className="info-row">
                    <span className="label">규칙:</span>
                    <span className="value">{room.roomRule === 'auto' ? '자율 선택' : room.roomRule}</span>
                </div>
            </div>

            <div className="room-info-footer">
                <div className="player-display">
                    <span>♟️ {room.p1}</span>
                    <span className="vs-split">vs</span>
                    <span> {room.p2 || '빈자리'}</span>
                </div>

                {/* 대기중이고 빈자리가 있을 때만 입장 버튼 활성화 */}
                {room.status === 'WAITING' && !room.p2 && (
                    <button className="btn-join" onClick={() => onJoin(room.id)}>입장하기</button>
                )}
            </div>
        </div>
    );
};

export default RoomListItem;