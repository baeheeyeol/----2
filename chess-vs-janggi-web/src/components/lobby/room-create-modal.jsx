import React, { useState } from 'react';
import './room-create-modal.css';

const RoomCreateModal = ({ isOpen, onClose, onCreate }) => {
    // 1. 폼 상태 관리: 모달은 오직 '입력값'만 관리합니다.
    const [roomData, setRoomData] = useState({
        roomTitle: '',
        roomRule: 'auto',
        isPrivate: false,
        roomPassword: ''
    });

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!roomData.roomTitle.trim()) return alert('방 제목을 입력해주세요.');

        // 부모가 전달해준 onCreate 함수에 현재 입력값만 넘깁니다.
        onCreate(roomData);

        // 초기화 (다음 번에 열릴 때를 대비)
        setRoomData({ roomTitle: '', roomRule: 'auto', isPrivate: false, roomPassword: '' });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>방 만들기</h2>
                <form onSubmit={handleSubmit}>
                    {/* 방 제목 */}
                    <div className="form-group">
                        <label>방 제목</label>
                        <input
                            type="text"
                            placeholder="방 제목을 입력하세요"
                            value={roomData.roomTitle}
                            onChange={(e) => setRoomData({ ...roomData, roomTitle: e.target.value })}
                            maxLength={20}
                        />
                    </div>

                    {/* 게임 규칙 */}
                    <div className="form-group">
                        <label>진영 규칙</label>
                        <select
                            value={roomData.roomRule}
                            onChange={(e) => setRoomData({ ...roomData, roomRule: e.target.value })}
                        >
                            <option value="auto">자율 선택</option>
                            <option value="random">랜덤 배정</option>
                            <option value="fixed">방장 선택</option>
                        </select>
                    </div>

                    {/* 공개 여부 */}
                    <div className="form-group check-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={roomData.isPrivate}
                                onChange={(e) => setRoomData({ ...roomData, isPrivate: e.target.checked })}
                            />
                            비공개 방 설정
                        </label>
                    </div>

                    {/* 비밀번호 입력 (비공개 시에만 표시) */}
                    {roomData.isPrivate && (
                        <div className="form-group">
                            <input
                                type="password"
                                placeholder="비밀번호"
                                value={roomData.roomPassword}
                                onChange={(e) => setRoomData({ ...roomData, roomPassword: e.target.value })}
                            />
                        </div>
                    )}

                    <div className="modal-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>취소</button>
                        <button type="submit" className="btn-create">방 생성</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoomCreateModal;