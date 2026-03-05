import React, { useState } from 'react';
import ChatWindow from './chat-window';
import RoomCreateModal from './room-create-modal';
import socket from '../../socket';
import { showAppAlert, showAppChoice, showAppConfirm } from '../../utils/app-alert';
import { emitSocketEvent } from '@/socket/socket-emit';
import { SOCKET_EVENTS } from '@/socket/socket-contract';
import { useRoomList } from '@/hooks/lobby/useRoomList';
import { getRandomQuickStartTitle } from './quick-start-titles';
import './mobile-lobby-drawer.css';

const MobileLobbyDrawer = ({ user, currentRoomId, onLogout }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [roomUnreadCount, setRoomUnreadCount] = useState(0);
    const { rooms, requestLatestRoomList } = useRoomList();

    const handleCreateRoom = () => {
        if (!user) return showAppAlert('로그인이 필요합니다.');
        setIsModalOpen(true);
    };

    const handleRoomSubmit = (data) => {
        if (!user) return;

        emitSocketEvent(socket, SOCKET_EVENTS.CREATE_ROOM, {
            ...data,
            creator_id: user.id,
        });
        setIsModalOpen(false);
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
        <>
            <RoomCreateModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleRoomSubmit}
            />

            <div className={`mobile-lobby-dock ${user ? 'with-logout' : ''}`} role="toolbar" aria-label="모바일 로비 메뉴">
                <button type="button" className="mobile-dock-btn" onClick={handleCreateRoom} disabled={isInRoom}>
                    방 만들기
                </button>
                <button type="button" className="mobile-dock-btn" onClick={handleQuickStart} disabled={isInRoom}>
                    빠른 시작
                </button>
                <button
                    type="button"
                    className={`mobile-dock-btn mobile-chat-toggle ${isChatOpen ? 'active' : ''}`}
                    onClick={() => setIsChatOpen((prev) => !prev)}
                >
                    {isChatOpen ? '채팅 닫기' : '채팅'}
                    {roomUnreadCount > 0 && <span className="mobile-chat-unread-dot" aria-label={`읽지 않은 메시지 ${roomUnreadCount}개`} />}
                </button>
                {user && (
                    <button type="button" className="mobile-dock-btn" onClick={onLogout}>
                        로그아웃
                    </button>
                )}
            </div>

            <div className={`mobile-chat-drawer ${isChatOpen ? 'open' : ''}`} aria-hidden={!isChatOpen}>
                <div className="mobile-chat-drawer-header">
                    <strong>채팅</strong>
                    <button type="button" className="mobile-chat-close" onClick={() => setIsChatOpen(false)}>닫기</button>
                </div>
                <ChatWindow
                    userName={user?.id}
                    currentRoomId={currentRoomId}
                    isVisible={isChatOpen}
                    onRoomUnreadChange={setRoomUnreadCount}
                />
            </div>
        </>
    );
};

export default MobileLobbyDrawer;