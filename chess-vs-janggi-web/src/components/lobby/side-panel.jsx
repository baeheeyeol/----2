import React, { useEffect, useState } from 'react';
import ChatWindow from './chat-window';
import RoomCreateModal from './room-create-modal';
import socket from '../../socket';
import './side-panel.css';

const QUICK_START_TITLES = [
    '초보만 오세요',
    '체스 vs 장기 누가 더 쉬울까?',
    '한 수 배우러 왔습니다',
    '기본 룰만 알면 환영!',
    '부담 없이 한 판 하실 분',
    '동서양 보드게임 입문 방',
    '마우스 가는 대로 두는 판',
    '채팅하며 즐겁게 두실 분',
    '뉴비의 반란, 받아주실 분?',
    '천천히 생각하며 둡시다',
    '고수 한판 합시다',
    '장기로 체스 이겨봄',
    '궁(楚/漢) vs 킹(♔), 진정한 왕은?',
    '상(象) vs 비숍(♗) 기물 싸움 가즈아',
    '진정한 뇌섹남녀 모여라',
    '동양의 지혜 vs 서양의 논리',
    '실력자만 들어오세요 (매너 필수)',
    '레이팅 1500+ 고수 구함',
    '수 읽기의 끝판왕 대결',
    '절대 방심 금지, 한 판 승부',
    '포(包)로 퀸(♕) 잡는 날',
    '졸(卒)도 모이면 폰(♙)보다 무섭다',
    '마(馬) vs 나이트(♘) 달리기 경주',
    '차가 뚫느냐, 룩이 막느냐',
    '상다리 부러지는 대결',
    '체크메이트냐 외통수냐 그것이 문제로다',
    '장기판 위에서 체스 두기',
    '세계관 최강자들의 대결',
    '커피 한 잔 마시며 두는 수',
    '오늘의 운세는 승리입니다',
];

const SidePanel = ({ user, currentRoomId }) => {
    // 방만들기 버튼 클릭 핸들러
    // 클릭시 방만들기 모달창 띄우기
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [rooms, setRooms] = useState([]);

    useEffect(() => {
        socket.emit('request_room_list');

        const handleRoomList = (updatedRooms) => {
            setRooms(Array.isArray(updatedRooms) ? updatedRooms : []);
        };

        socket.on('room_list', handleRoomList);

        return () => {
            socket.off('room_list', handleRoomList);
        };
    }, []);

    const createQuickStartTitle = () => {
        const randomIndex = Math.floor(Math.random() * QUICK_START_TITLES.length);
        return QUICK_START_TITLES[randomIndex];
    };

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

    const handleQuickStart = () => {
        if (!user) return alert('로그인이 필요합니다.');

        const pickCandidateRooms = (roomList) => {
            return (Array.isArray(roomList) ? roomList : []).filter((room) => {
                if (!room || room.id === currentRoomId) return false;
                const status = String(room.status || '').toUpperCase();
                return status !== 'PLAYING' && !room.isPrivate;
            });
        };

        const tryQuickStart = (roomList) => {
            const candidateRooms = pickCandidateRooms(roomList);
            if (candidateRooms.length > 0) {
                const randomRoom = candidateRooms[Math.floor(Math.random() * candidateRooms.length)];
                socket.emit('join_room', { roomId: randomRoom.id });
                return;
            }

            socket.emit('create_room', {
                roomTitle: createQuickStartTitle(),
                roomRule: '자율선택',
                creator_id: user.id,
            });
        };

        let handled = false;
        const handleRoomListOnce = (updatedRooms) => {
            if (handled) return;
            handled = true;
            setRooms(Array.isArray(updatedRooms) ? updatedRooms : []);
            tryQuickStart(updatedRooms);
        };

        socket.once('room_list', handleRoomListOnce);
        socket.emit('request_room_list');

        window.setTimeout(() => {
            if (handled) return;
            handled = true;
            socket.off('room_list', handleRoomListOnce);
            tryQuickStart(rooms);
        }, 300);
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