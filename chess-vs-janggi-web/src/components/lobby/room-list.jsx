import React, { useState, useEffect } from 'react';
import socket from '../../socket';
import RoomListItem from './room-list-item';
import './room-list.css';

const RoomList = () => {
    const [rooms, setRooms] = useState([]);

    useEffect(() => {
        // 1. 처음 마운트 시 현재 서버의 방 목록 요청
        socket.emit('request_room_list');

        // 2. 서버에서 갱신된 방 목록 수신
        socket.on('room_list', (updatedRooms) => {
            setRooms(updatedRooms);
        });


        return () => {
            socket.off('room_list');
        };
    }, []);

    const handleJoinRoom = (roomId) => {
        socket.emit('join_room', { room_id: roomId });
    };

    return (
        <div className="room-list-container">
            <div className="room-list-grid">
                {rooms.length > 0 ? (
                    rooms.map(room => (
                        <RoomListItem
                            key={room.id}
                            room={room}
                            onJoin={handleJoinRoom}
                        />
                    ))
                ) : (
                    <div className="empty-rooms">현재 개설된 방이 없습니다.</div>
                )}
            </div>
        </div>
    );
};

export default RoomList;