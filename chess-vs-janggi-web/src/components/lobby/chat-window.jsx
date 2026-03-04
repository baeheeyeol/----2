import React, { useState, useEffect, useRef } from 'react';
import './side-panel.css';
import socket from '../../socket';
import { emitSocketEvent } from '@/socket/socket-emit';
import { SOCKET_EVENTS } from '@/socket/socket-contract';

// Props로 currentRoomId를 받아야 방 채팅 여부를 판단 가능
const ChatWindow = ({ userName, currentRoomId, isVisible = true, onRoomUnreadChange }) => {
    // 탭 상태: 'GLOBAL' | 'ROOM'
    const [activeTab, setActiveTab] = useState('GLOBAL');

    // 메시지 상태 분리
    const [globalMessages, setGlobalMessages] = useState([]);
    const [roomMessages, setRoomMessages] = useState([]);
    const [roomUnreadCount, setRoomUnreadCount] = useState(0);

    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef(null);

    const createSystemMessage = (text) => ({
        id: `system_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        user: 'System',
        text,
        type: 'ROOM'
    });

    // 방에서 나가면 자동으로 탭을 'GLOBAL'로 전환 및 방 메시지 초기화
    useEffect(() => {
        if (!currentRoomId) {
            setActiveTab('GLOBAL');
            setRoomMessages([]); // 선택사항: 방 나가면 이전 대화 지우기
            setRoomUnreadCount(0);
        } else {
            // 방에 들어오면 자동으로 방 채팅 탭으로 전환 (UX 편의성)
            setActiveTab('ROOM');
        }
    }, [currentRoomId]);

    useEffect(() => {
        onRoomUnreadChange?.(roomUnreadCount);
    }, [roomUnreadCount, onRoomUnreadChange]);

    useEffect(() => {
        if (activeTab === 'ROOM' && isVisible) {
            setRoomUnreadCount(0);
        }
    }, [activeTab, isVisible]);

    // 소켓 이벤트 리스너 설정
    useEffect(() => {
        // 전체 채팅 수신
        const handleGlobalMessage = (newMessage) => {
            setGlobalMessages((prev) => [...prev, newMessage]);
        };

        // 방 채팅 수신
        const handleRoomMessage = (newMessage) => {
            setRoomMessages((prev) => [...prev, newMessage]);
            const isMyMessage = newMessage?.user && newMessage.user === userName;
            if (!(activeTab === 'ROOM' && isVisible) && !isMyMessage) {
                setRoomUnreadCount((prev) => prev + 1);
            }
        };

        const handlePlayerJoined = (payload) => {
            const joinedUser = payload?.p2;
            if (!joinedUser) return;
            setRoomMessages((prev) => [...prev, createSystemMessage(`${joinedUser}님이 입장했습니다.`)]);
        };

        const handlePlayerLeft = (payload) => {
            const leftUser = payload?.user;
            const message = leftUser ? `${leftUser}님이 퇴장했습니다.` : '상대가 퇴장했습니다.';
            setRoomMessages((prev) => [...prev, createSystemMessage(message)]);
        };

        socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, handleGlobalMessage);
        socket.on(SOCKET_EVENTS.RECEIVE_ROOM_MESSAGE, handleRoomMessage);
        socket.on(SOCKET_EVENTS.PLAYER_JOINED, handlePlayerJoined);
        socket.on(SOCKET_EVENTS.PLAYER_LEFT, handlePlayerLeft);

        return () => {
            socket.off(SOCKET_EVENTS.RECEIVE_MESSAGE, handleGlobalMessage);
            socket.off(SOCKET_EVENTS.RECEIVE_ROOM_MESSAGE, handleRoomMessage);
            socket.off(SOCKET_EVENTS.PLAYER_JOINED, handlePlayerJoined);
            socket.off(SOCKET_EVENTS.PLAYER_LEFT, handlePlayerLeft);
        };
    }, [activeTab, isVisible, userName]);

    // 스크롤 자동 이동 (메시지가 업데이트 될 때마다)
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [globalMessages, roomMessages, activeTab]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const messageData = {
            id: Date.now(),
            user: userName || 'Guest',
            text: inputText,
            // 메시지 타입 구분 (UI 스타일링 용도)
            type: activeTab
        };

        if (activeTab === 'GLOBAL') {
            emitSocketEvent(socket, SOCKET_EVENTS.SEND_MESSAGE, messageData, { silent: true });
        } else if (activeTab === 'ROOM' && currentRoomId) {
            // 방 ID를 함께 전송해야 함
            emitSocketEvent(socket, SOCKET_EVENTS.SEND_ROOM_MESSAGE, {
                roomId: currentRoomId,
                messageData
            }, { silent: true });
        }

        setInputText('');
    };

    // 현재 탭에 따라 보여줄 메시지 결정
    const currentMessages = activeTab === 'GLOBAL' ? globalMessages : roomMessages;

    return (
        <div className="chat-container">
            {/* 탭 헤더 영역 */}
            <div className="chat-tabs">
                <button
                    className={`chat-tab ${activeTab === 'GLOBAL' ? 'active' : ''}`}
                    onClick={() => setActiveTab('GLOBAL')}
                >
                    전체
                </button>
                <button
                    className={`chat-tab ${activeTab === 'ROOM' ? 'active' : ''}`}
                    onClick={() => currentRoomId && setActiveTab('ROOM')}
                    disabled={!currentRoomId} // 방에 없으면 비활성화
                    style={{ opacity: currentRoomId ? 1 : 0.5, cursor: currentRoomId ? 'pointer' : 'not-allowed' }}
                >
                    방 채팅
                    {roomUnreadCount > 0 && <span className="chat-tab-unread" aria-label={`읽지 않은 메시지 ${roomUnreadCount}개`} />}
                </button>
            </div>

            {/* 메시지 출력 영역 */}
            <div className="chat-messages">
                {/* 안내 메시지 (방 채팅 탭인데 비어있을 경우 등) */}
                {activeTab === 'ROOM' && roomMessages.length === 0 && (
                    <div className="system-message">방 채팅에 입장했습니다. 대화를 시작하세요.</div>
                )}

                {currentMessages.map((msg) => (
                    <div key={msg.id} className="chat-line">
                        {/* 내 메시지와 타인 메시지 구분 없이 단순 리스트 (요구사항) */}
                        <span className={`chat-user ${msg.user === userName ? 'my-user' : ''}`}>
                            {msg.user}:
                        </span>
                        <span className="chat-text">{msg.text}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    placeholder={activeTab === 'GLOBAL' ? "전체에게 메시지 보내기..." : "방 참여자에게 메시지 보내기..."}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                />
            </form>
        </div>
    );
};

export default ChatWindow;