import React, { useState, useEffect } from 'react';
import './room-page.css';

// --- 상수 정의 (유지보수를 위해 별도 파일로 분리하는 것이 좋으나, 현재는 여기에 둡니다) ---
const GAME_RULES = {
    FREE: '자율선택',
    RANDOM: '랜덤배정',
    HOST: '방장선택',
};

const MAP_TYPES = {
    CHESS: '체스판',
    JANGGI: '장기판',
    BADUK: '바둑판',
};

const FACTIONS = {
    CHESS: { code: 'chess', icon: '♔', label: 'CHESS' },
    JANGGI: { code: 'janggi', icon: '鿢', label: 'JANGGI' },
    OMOK: { code: 'omok', icon: '⚪⚫', label: 'OMOK' },
};

const normalizeRule = (rule) => {
    const ruleMap = {
        auto: GAME_RULES.FREE,
        AUTO: GAME_RULES.FREE,
        FREE: GAME_RULES.FREE,
        RANDOM: GAME_RULES.RANDOM,
        HOST: GAME_RULES.HOST,
        [GAME_RULES.FREE]: GAME_RULES.FREE,
        [GAME_RULES.RANDOM]: GAME_RULES.RANDOM,
        [GAME_RULES.HOST]: GAME_RULES.HOST,
    };

    return ruleMap[rule] || GAME_RULES.FREE;
};

const getFactionByCode = (factionCode, fallback = FACTIONS.CHESS) => {
    return Object.values(FACTIONS).find(f => f.code === factionCode) || fallback;
};

const RoomPage = ({ room, user, onLeave, onUpdateRoomSettings }) => {
    const isHost = user.id === room.p1;
    const isP2Joined = !!room.p2;
    const isP1Ready = !!room.p1Ready;
    const isP2Ready = !!room.p2Ready;
    const isCurrentUserReady = isHost ? isP1Ready : isP2Ready;
    // --- Local State for Selections ---
    // 실제로는 이 상태들이 변경될 때마다 서버로 전송하여 room 데이터를 업데이트해야 할 수 있습니다.
    // 여기서는 UI 동작을 위한 로컬 상태로 구현합니다.
    const [selectedRule, setSelectedRule] = useState(normalizeRule(room.roomRule));
    const [selectedMap, setSelectedMap] = useState(room.roomMap || MAP_TYPES.CHESS);
    const [p1Faction, setP1Faction] = useState(getFactionByCode(room.p1Faction, FACTIONS.CHESS));
    const [p2Faction, setP2Faction] = useState(getFactionByCode(room.p2Faction, FACTIONS.JANGGI));
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        setSelectedRule(normalizeRule(room.roomRule));
        setSelectedMap(room.roomMap || MAP_TYPES.CHESS);
        setP1Faction(getFactionByCode(room.p1Faction, FACTIONS.CHESS));
        setP2Faction(getFactionByCode(room.p2Faction, FACTIONS.JANGGI));
    }, [room]);

    // 양쪽 준비완료시 5초 타이머 표기 이후 게임시작화면 전환
    useEffect(() => {
        let timerId;
        if (isP1Ready && isP2Ready) {
            timerId = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timerId);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            clearInterval(timerId);
        };
    }, [isP1Ready, isP2Ready]);
    // --- Handlers ---

    /**
     * 룰 변경 핸들러 (방장만 가능)
     */
    const handleRuleChange = (e) => {
        const newRule = normalizeRule(e.target.value);
        setSelectedRule(newRule);
        onUpdateRoomSettings?.({ roomRule: newRule });

        // 룰이 변경되면 진영 선택 상태를 초기화하거나 재조정하는 로직이 필요할 수 있음
        if (newRule === GAME_RULES.RANDOM) {
            handleRandomizeFactions();
        }
    };

    /**
     * 맵 변경 핸들러 (방장만 가능)
     */
    const handleMapChange = (e) => {
        const newMap = e.target.value;
        setSelectedMap(newMap);
        onUpdateRoomSettings?.({ roomMap: newMap });
    };

    /**
     * 특정 플레이어의 진영 변경 핸들러
     * @param {string} playerKey 'p1' or 'p2'
     * @param {string} factionCode 'chess', 'janggi', 'omok'
     */
    const handleFactionChange = (playerKey, factionCode) => {
        const newFaction = Object.values(FACTIONS).find(f => f.code === factionCode);
        if (!newFaction) return;

        if (playerKey === 'p1') setP1Faction(newFaction);
        if (playerKey === 'p2') setP2Faction(newFaction);

        onUpdateRoomSettings?.({ [playerKey === 'p1' ? 'p1Faction' : 'p2Faction']: factionCode });
    };

    /**
     * 진영 랜덤 배정 핸들러 (방장 전용 버튼)
     */
    const handleRandomizeFactions = () => {
        const factionList = Object.values(FACTIONS);
        const nextP1 = factionList[Math.floor(Math.random() * factionList.length)];
        const nextP2 = factionList[Math.floor(Math.random() * factionList.length)];
        setP1Faction(nextP1);
        setP2Faction(nextP2);
        onUpdateRoomSettings?.({ p1Faction: nextP1.code, p2Faction: nextP2.code });
    };

    /* 게임 준비 핸들러 */
    const handleReadyClick = () => {
        if (!isP2Joined) return;

        onUpdateRoomSettings?.(isHost ? { p1Ready: !isP1Ready } : { p2Ready: !isP2Ready });
    }



    // --- UI Sub-components ---

    /**
     * 진영 선택 셀렉트 박스 렌더링
     */
    const renderFactionSelector = (playerKey, currentFaction) => {
        const isEnabled =
            (selectedRule === GAME_RULES.FREE && user.id === room[playerKey]) ||
            (selectedRule === GAME_RULES.HOST && isHost);

        if (!isEnabled || selectedRule === GAME_RULES.RANDOM) return null;

        return (
            <select
                className="faction-select"
                value={currentFaction.code}
                onChange={(e) => handleFactionChange(playerKey, e.target.value)}
            >
                {Object.values(FACTIONS).map(f => (
                    <option key={f.code} value={f.code}>{f.label}</option>
                ))}
            </select>
        );
    };


    return (
        <div className="room-page-container">
            {/* 메인 게임 셋업 카드 */}
            <div className="game-setup-card">

                {/* 1. 헤더 영역 (방 제목, 나가기) */}
                <div className="card-header">
                    <h2 className="room-title">{room.title}</h2>
                    <button className="btn-secondary btn-leave" onClick={onLeave}>나가기</button>
                </div>

                {/* 2. 플레이어 대결 영역 (VS) */}
                <div className="player-vs-section">
                    {/* Player 1 (Host) */}
                    <div className={`player-box ${p1Faction.code}`}>
                        <div className="faction-icon">{p1Faction.icon}</div>
                        <div className="player-name">{room.p1} {isHost && '(방장)'}</div>
                        <div className={`ready-status ${isP1Ready ? 'ready' : 'not-ready'}`}>
                            {isP1Ready ? '준비완료' : '준비중'}
                        </div>
                        <div className="faction-label">{p1Faction.label}</div>
                        {/* 진영 선택 셀렉터 */}
                        {renderFactionSelector('p1', p1Faction)}
                    </div>

                    <div className="vs-divider">
                        <span>VS</span>
                    </div>

                    {/* Player 2 (Guest) */}
                    <div className={`player-box ${p2Faction.code} ${!isP2Joined ? 'waiting' : ''}`}>
                        <div className="faction-icon">{isP2Joined ? p2Faction.icon : '?'}</div>
                        {/* 요구사항 1: 상대 접속 시 ID 표시, 아니면 대기중 */}
                        <div className="player-name">{room.p2 || '상대 대기 중...'}</div>
                        {isP2Joined && (
                            <div className={`ready-status ${isP2Ready ? 'ready' : 'not-ready'}`}>
                                {isP2Ready ? '준비완료' : '준비중'}
                            </div>
                        )}
                        <div className="faction-label">{isP2Joined ? p2Faction.label : 'WAITING'}</div>
                        {/* 진영 선택 셀렉터 (상대가 접속했을 때만 표시) */}
                        {isP2Joined && renderFactionSelector('p2', p2Faction)}
                    </div>
                </div>

                {/* 3. 게임 옵션 설정 영역 (룰, 맵) */}
                <div className="game-options-section">
                    <div className="option-group">
                        <label htmlFor="rule-select">게임 규칙</label>
                        <select
                            id="rule-select"
                            className="common-select"
                            value={selectedRule}
                            onChange={handleRuleChange}
                            disabled={!isHost} /* 방장만 변경 가능 */
                        >
                            {Object.values(GAME_RULES).map(rule => (
                                <option key={rule} value={rule}>{rule}</option>
                            ))}
                        </select>
                    </div>

                    <div className="option-group">
                        <label htmlFor="map-select">사용 맵</label>
                        <select
                            id="map-select"
                            className="common-select"
                            value={selectedMap}
                            onChange={handleMapChange}
                            disabled={!isHost} /* 방장만 변경 가능 */
                        >
                            {Object.values(MAP_TYPES).map(map => (
                                <option key={map} value={map}>{map}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {room.status === 'PLAYING' && (

                    <div className="game-entered-banner">양측 준비 완료  {countdown}초 후 게임 진입</div>
                )}

                {/* 4. 액션 버튼 영역 (푸터) */}
                <div className="card-footer">
                    {isHost && selectedRule === GAME_RULES.RANDOM && (
                        <button
                            className="btn-secondary btn-random"
                            onClick={handleRandomizeFactions}
                            disabled={!isP2Joined}
                        >
                            <span className="dice-icon">🎲</span> 진영 랜덤 셔플
                        </button>
                    )}

                    <button
                        className={`btn-primary btn-ready ${isCurrentUserReady ? 'is-ready' : ''}`}
                        onClick={handleReadyClick}
                        disabled={!isP2Joined}
                    >
                        {isCurrentUserReady ? '준비 취소' : '준비'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RoomPage;