import React from 'react';
import ChatWindow from './chat-window';
import RoomCreateModal from './room-create-modal';
import { useState } from 'react';
import socket from '../../socket';
import './side-panel.css';

const SidePanel = ({ user }) => {
    // 방만들기 버튼 클릭 핸들러
    // 클릭시 방만들기 모달창 띄우기
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleCreateRoom = () => {
        if (!user) return alert('로그인이 필요합니다.');
        setIsModalOpen(true); // 모달 열기
    };

    const handleRoomSubmit = (data) => {
        // 실제 서버에 소켓으로 방 생성 이벤트 전송
        socket.emit('create_room', {
            ...data,
            creator_id: user.id
        });
        setIsModalOpen(false); // 생성 후 모달 닫기
    };
    return (
        <aside className="side-panel">
            {/* 방 만들기 모달 */}
            <RoomCreateModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleRoomSubmit}
            />
            {/* 1. 내 프로필 영역 */}
            <div className="panel-section profile-section">
                <h3>내 프로필</h3>
                <div className="profile-card">
                    {user ? (
                        <div className="profile-stats">
                            <p>ID: <strong>{user.id}</strong></p>
                            <p>승률: {user.winRate}% (Rank {user.rank})</p>
                            <button className="btn-detail">전적 표시</button>
                        </div>
                    ) : (
                        <div className="profile-placeholder">
                            로그인이 필요합니다.
                        </div>
                    )}
                </div>
            </div>

            {/* 2. 액션 버튼 영역 */}
            <div className="panel-section action-buttons">
                <button className="btn-action create-room" onClick={handleCreateRoom}>
                    📺 방 만들기
                </button>
                <button className="btn-action quick-start">
                    🚀 빠른 시작
                </button>
            </div>

            {/* 3. 채팅 영역 (남은 공간 채움) */}
            <ChatWindow userName={user?.id} />
        </aside>
    );
};

export default SidePanel;