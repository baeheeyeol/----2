import React from 'react';

const RoomListItem = ({ room, onJoin }) => {
    // 상태에 따른 색상 클래스 결정
    const statusClass = room.status === 'WAITING' ? 'waiting' : 'playing';
    const statusText = room.status === 'WAITING' ? '대기중' : '게임중';

    const [showPasswordInput, setShowPasswordInput] = React.useState(false);
    const [passwordInput, setPasswordInput] = React.useState('');

    const handleJoinClick = () => {
        if (!room.isPrivate) {
            onJoin(room.id, '');
            return;
        }
        setShowPasswordInput((prev) => !prev);
    };

    const handleConfirmPrivateJoin = () => {
        onJoin(room.id, passwordInput);
    };

    return (
        <div className={`room-item-card ${statusClass}`}>
            <div className="room-info-header">
                <h3 className="room-title">{room.title}</h3>
                <span className={`status-tag ${statusClass}`}>{statusText}</span>
            </div>

            {room.isPrivate && (
                <div className="private-room-badge" title="비공개 방">
                    🔒 이 방은 비공개입니다.
                </div>
            )}

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
                    <span> {room.p1}</span>
                    <span className="vs-split">vs</span>
                    <span> {room.p2 || '빈자리'}</span>
                </div>

                {/* 대기중이고 빈자리가 있을 때만 입장 버튼 활성화 */}
                {room.status === 'WAITING' && !room.p2 && (
                    <>
                        <button className="btn-join" onClick={handleJoinClick}>입장하기</button>
                        {room.isPrivate && showPasswordInput && (
                            <div className="private-join-box">
                                <input
                                    type="password"
                                    className="private-join-input"
                                    placeholder="비밀번호 입력"
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    maxLength={30}
                                />
                                <button className="btn-private-confirm" onClick={handleConfirmPrivateJoin}>확인</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default RoomListItem;