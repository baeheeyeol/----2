
import React, { useState, useEffect } from 'react'; // ✅ 정답
import './lobby-header.css';
import socket from '../../socket'; // 경로 확인 필요

const LobbyHeader = ({ user, onLogin, onLogout }) => {
    // 로컬 상태: 입력 필드 관리
    const [inputId, setInputId] = useState('');
    const [inputPw, setInputPw] = useState('');
    const [userCount, setUserCount] = useState(0); // 접속자 수 (임시)
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputId.trim() || !inputPw.trim()) return;
        onLogin(inputId, inputPw); // 부모(App)에게 로그인 요청
    };

    // 소켓 접속자수 가져오기
    useEffect(() => {
        socket.on('user_count', (count) => {
            setUserCount(count);
        });
        return () => {
            socket.off('user_count');
        };
    }, []);

    return (
        <header className="lobby-header">
            {/* 1. 좌측: 로고 및 접속자 정보 */}
            <div className="header-left">
                <h1 className="logo">♟️ Chess vs Janggi 鿢</h1>
                <span className="user-count">접속자: <span className="highlight">{userCount}</span>명</span>
            </div>

            {/* 2. 우측: 로그인 상태에 따른 분기 처리 */}
            <div className="header-right">
                {user ? (
                    // 로그인 성공 시
                    <div className="user-profile">
                        <span className="user-name">{user.id}</span>
                        <span className="user-stat">(승률 {user.winRate}%)</span>
                        <button className="btn-logout" onClick={onLogout}>로그아웃</button>
                    </div>
                ) : (
                    // 로그인 전 (입력 폼)
                    <form className="login-form" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            placeholder="ID"
                            value={inputId}
                            onChange={(e) => setInputId(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="PW"
                            value={inputPw}
                            onChange={(e) => setInputPw(e.target.value)}
                        />
                        <button type="submit" className="btn-login">접속</button>
                    </form>
                )}
            </div>
        </header>
    );
};

export default LobbyHeader;