import React, { useState, useEffect, useRef, use } from 'react';
import './side-panel.css'; // 스타일은 한 곳에서 관리하거나 분리 가능
import socket from '../../socket';

const ChatWindow = ({ userName }) => {
    // 임시 더미 데이터
    const [messages, setMessages] = useState([
        { id: 1, user: 'User1', text: '님 ㅎㅇ' },
        { id: 2, user: 'User2', text: '한판 ㄱ?' },
    ]);
    const [inputText, setInputText] = useState('');

    // 스크롤 자동 이동을 위한 Ref
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        socket.on('receive_message', (newMessage) => {
            setMessages((prevMessages) => [...prevMessages, newMessage]);
        });
        return () => {
            socket.off('receive_message');
        };
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        // 실제로는 소켓 전송 로직이 들어갈 자리
        const newMessage = {
            id: Date.now(),
            user: userName || 'Guest',
            text: inputText
        };
        socket.emit('send_message', newMessage); // 서버로 메시지 전송
        setInputText('');
    };

    return (
        <div className="chat-container">
            <div className="chat-header">전체 채팅</div>

            {/* 메시지 출력 영역 */}
            <div className="chat-messages">
                {messages.map((msg) => (
                    <div key={msg.id} className="chat-line">
                        <span className="chat-user">{msg.user}:</span>
                        <span className="chat-text">{msg.text}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    placeholder="입력창......"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                />
            </form>
        </div>
    );
};

export default ChatWindow;