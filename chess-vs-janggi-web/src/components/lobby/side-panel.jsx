import React, { useState } from 'react';
import ChatWindow from './chat-window';
import RoomCreateModal from './room-create-modal';
import socket from '../../socket';
import { showAppAlert, showAppChoice, showAppConfirm } from '../../utils/app-alert';
import { emitSocketEvent } from '@/socket/socket-emit';
import { SOCKET_EVENTS } from '@/socket/socket-contract';
import { useRoomList } from '@/hooks/lobby/useRoomList';
import { getRandomQuickStartTitle } from './quick-start-titles';
import './side-panel.css';

const SidePanel = ({ user, currentRoomId }) => {
    // 방만들기 버튼 클릭 핸들러
    // 클릭시 방만들기 모달창 띄우기
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { rooms, requestLatestRoomList } = useRoomList();

    const handleCreateRoom = () => {
        if (!user) return showAppAlert('로그인이 필요합니다.');
        setIsModalOpen(true); // 모달 열기
    };

    const handleRoomSubmit = (data) => {
        // 실제 서버에 소켓으로 방 생성 이벤트 전송
        emitSocketEvent(socket, SOCKET_EVENTS.CREATE_ROOM, {
            ...data,
            creator_id: user.id
        });
        setIsModalOpen(false); // 생성 후 모달 닫기
    };

    const handleQuickStart = async () => {
        if (!user) return showAppAlert('로그인이 필요합니다.');

        const wantsBotQuickStart = await showAppConfirm('빠른 시작을 봇전으로 시작할까요?', {
            confirmText: '봇전',
            cancelText: '일반전',
        });
        if (wantsBotQuickStart) {
            const selectedLevel = await showAppChoice('봇 난이도를 선택해주세요.', {
                choices: [
                    { label: '난이도 1 (랜덤)', value: 1 },
                    { label: '난이도 2 (그리디)', value: 2 },
                    { label: '난이도 3 (미니맥스)', value: 3 },
                ],
                cancelText: '취소',
            });
            if (selectedLevel === null) return;

            emitSocketEvent(socket, SOCKET_EVENTS.CREATE_ROOM, {
                roomTitle: `${getRandomQuickStartTitle()} (BOT Lv.${selectedLevel})`,
                roomRule: '자율선택',
                creator_id: user.id,
                isBotRoom: true,
                botLevel: selectedLevel,
            });
            return;
        }

        const pickCandidateRooms = (roomList) => {
            return (Array.isArray(roomList) ? roomList : []).filter((room) => {
                if (!room || room.id === currentRoomId) return false;
                const status = String(room.status || '').toUpperCase();
                return status !== 'PLAYING' && !room.isPrivate && !room.p2;
            });
        };

        const tryQuickStart = (roomList) => {
            const candidateRooms = pickCandidateRooms(roomList);
            if (candidateRooms.length > 0) {
                const randomRoom = candidateRooms[Math.floor(Math.random() * candidateRooms.length)];
                emitSocketEvent(socket, SOCKET_EVENTS.JOIN_ROOM, { roomId: randomRoom.id });
                return;
            }

            emitSocketEvent(socket, SOCKET_EVENTS.CREATE_ROOM, {
                roomTitle: getRandomQuickStartTitle(),
                roomRule: '자율선택',
                creator_id: user.id,
                isBotRoom: false,
            });
        };

        const latestRooms = await requestLatestRoomList(300);
        tryQuickStart(latestRooms);
    };

    const isInRoom = Boolean(currentRoomId);

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
                <button className="btn-action create-room" onClick={handleCreateRoom} disabled={isInRoom}>
                    📺 방 만들기
                </button>
                <button className="btn-action quick-start" onClick={handleQuickStart} disabled={isInRoom}>
                    🚀 빠른 시작
                </button>
                {isInRoom && <div className="room-locked-hint">방 입장 중에는 로비 액션을 사용할 수 없습니다.</div>}
            </div>

            {/* 3. 채팅 영역 (남은 공간 채움) */}
            <ChatWindow userName={user?.id} currentRoomId={currentRoomId} />
        </aside>
    );
};

export default SidePanel;