import React, { useState, useEffect, useRef } from 'react';
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

const PIECE_COLORS = [
    { code: 'white', label: 'WHITE' },
    { code: 'black', label: 'BLACK' },
    { code: 'red', label: 'RED' },
    { code: 'blue', label: 'BLUE' },
    { code: 'green', label: 'GREEN' },
    { code: 'gold', label: 'GOLD' },
    { code: 'purple', label: 'PURPLE' },
];

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
    if (!room || !user) {
        return (
            <div className="room-page-container">
                <div className="game-setup-card">
                    <div className="card-header">
                        <h2 className="room-title">방 정보를 불러오는 중...</h2>
                        <button className="btn-secondary btn-leave" onClick={onLeave}>나가기</button>
                    </div>
                </div>
            </div>
        );
    }

    const isHost = user.id === room.p1;
    const isP2Joined = !!room.p2;
    const isP1Ready = !!room.p1Ready;
    const isP2Ready = !!room.p2Ready;
    const isCurrentUserReady = isHost ? isP1Ready : isP2Ready;
    const isHostSettingsDisabled = !isHost || isP1Ready || room.status === 'PLAYING';
    const selectedRule = normalizeRule(room.roomRule);
    const selectedMap = room.roomMap || MAP_TYPES.CHESS;
    const p1Faction = getFactionByCode(room.p1Faction, FACTIONS.CHESS);
    const p2Faction = getFactionByCode(room.p2Faction, FACTIONS.JANGGI);
    const p1Color = room.p1Color || 'white';
    const p2Color = room.p2Color || 'black';
    const roomTurnSeconds = Number.isFinite(Number(room.turnSeconds)) ? Number(room.turnSeconds) : 60;
    const [countdown, setCountdown] = useState(5);
    const [ruleChanged, setRuleChanged] = useState(false);
    const [mapChanged, setMapChanged] = useState(false);
    const [turnSecondsInput, setTurnSecondsInput] = useState(String(roomTurnSeconds));
    const [isDiceRolling, setIsDiceRolling] = useState(false);
    const isFirstSyncRef = useRef(true);
    const prevRuleRef = useRef(selectedRule);
    const prevMapRef = useRef(selectedMap);
    const prevRandomTickRef = useRef(room.randomTick || 0);
    const diceRollTimerRef = useRef(null);

    const triggerDiceRollEffect = () => {
        if (diceRollTimerRef.current) {
            clearTimeout(diceRollTimerRef.current);
        }

        setIsDiceRolling(true);
        diceRollTimerRef.current = setTimeout(() => {
            setIsDiceRolling(false);
            diceRollTimerRef.current = null;
        }, 800);
    };

    // 양쪽 준비완료시 5초 타이머 표기 이후 게임시작화면 전환
    useEffect(() => {
        let timerId;
        if (isP1Ready && isP2Ready) {
            setCountdown(5);
            timerId = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timerId);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            setCountdown(5);
        }
        return () => {
            clearInterval(timerId);

        };
    }, [isP1Ready, isP2Ready]);
    // 룰이나 맵이 변경됐을 때 잠깐 배너 띄우기 (변경 감지)
    useEffect(() => {
        if (isFirstSyncRef.current) {
            isFirstSyncRef.current = false;
            prevRuleRef.current = selectedRule;
            prevMapRef.current = selectedMap;
            prevRandomTickRef.current = room.randomTick || 0;
            return;
        }

        if (prevRuleRef.current !== selectedRule) {
            setRuleChanged(true);
            const timerId = setTimeout(() => setRuleChanged(false), 700);
            prevRuleRef.current = selectedRule;
            return () => clearTimeout(timerId);
        }

        prevRuleRef.current = selectedRule;
    }, [selectedRule]);
    // 룰이 랜덤일 때, 플레이어 진영이 변경되면 랜덤 배정 효과 실행
    useEffect(() => {
        if (isFirstSyncRef.current) return;

        if (prevMapRef.current !== selectedMap) {
            setMapChanged(true);
            const timerId = setTimeout(() => setMapChanged(false), 700);
            prevMapRef.current = selectedMap;
            return () => clearTimeout(timerId);
        }

        prevMapRef.current = selectedMap;
    }, [selectedMap]);
    // 서버 randomTick 기반 랜덤 배정 효과 실행 (결과값 동일해도 표시)
    useEffect(() => {
        if (isFirstSyncRef.current) return;

        const currentRandomTick = room.randomTick || 0;
        if (currentRandomTick !== prevRandomTickRef.current) {
            triggerDiceRollEffect();
            prevRandomTickRef.current = currentRandomTick;
        }
    }, [room.randomTick]);

    useEffect(() => {
        return () => {
            if (diceRollTimerRef.current) {
                clearTimeout(diceRollTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setTurnSecondsInput(String(roomTurnSeconds));
    }, [roomTurnSeconds]);
    // --- Handlers ---

    /**
     * 룰 변경 핸들러 (방장만 가능)
     */
    const handleRuleChange = (e) => {
        if (isHostSettingsDisabled) return;

        const newRule = normalizeRule(e.target.value);
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
        if (isHostSettingsDisabled) return;

        const newMap = e.target.value;
        onUpdateRoomSettings?.({ roomMap: newMap });
    };

    const handleTurnSecondsChange = (e) => {
        const inputValue = e.target.value;
        setTurnSecondsInput(inputValue);
        if (isHostSettingsDisabled) return;
        if (inputValue === '') return;

        const parsed = Number(inputValue);
        if (!Number.isFinite(parsed)) return;
        const normalized = Math.min(600, Math.max(1, Math.floor(parsed)));
        onUpdateRoomSettings?.({ turnSeconds: normalized });
    };

    const handleTurnSecondsBlur = () => {
        if (turnSecondsInput === '' || !Number.isFinite(Number(turnSecondsInput))) {
            setTurnSecondsInput(String(roomTurnSeconds));
            return;
        }

        const normalized = Math.min(600, Math.max(1, Math.floor(Number(turnSecondsInput))));
        setTurnSecondsInput(String(normalized));
        if (!isHostSettingsDisabled) {
            onUpdateRoomSettings?.({ turnSeconds: normalized });
        }
    };

    /**
     * 특정 플레이어의 진영 변경 핸들러
     * @param {string} playerKey 'p1' or 'p2'
     * @param {string} factionCode 'chess', 'janggi', 'omok'
     */
    const handleFactionChange = (playerKey, factionCode) => {
        const isTargetReady = playerKey === 'p1' ? isP1Ready : isP2Ready;
        if (room.status === 'PLAYING' || isTargetReady) return;

        const newFaction = Object.values(FACTIONS).find(f => f.code === factionCode);
        if (!newFaction) return;

        onUpdateRoomSettings?.({ [playerKey === 'p1' ? 'p1Faction' : 'p2Faction']: factionCode });
    };

    const handleColorChange = (playerKey, colorCode) => {
        const isTargetReady = playerKey === 'p1' ? isP1Ready : isP2Ready;
        if (room.status === 'PLAYING' || isTargetReady) return;

        const exists = PIECE_COLORS.some((color) => color.code === colorCode);
        if (!exists) return;

        onUpdateRoomSettings?.({ [playerKey === 'p1' ? 'p1Color' : 'p2Color']: colorCode });
    };

    /**
     * 진영 랜덤 배정 핸들러 (방장 전용 버튼)
     */
    const handleRandomizeFactions = () => {
        if (isHostSettingsDisabled || !isP2Joined) return;

        triggerDiceRollEffect();

        const factionList = Object.values(FACTIONS);
        const nextP1 = factionList[Math.floor(Math.random() * factionList.length)];
        const nextP2 = factionList[Math.floor(Math.random() * factionList.length)];
        onUpdateRoomSettings?.({ p1Faction: nextP1.code, p2Faction: nextP2.code });
        // 맵도 랜덤으로 설정
        const mapList = Object.values(MAP_TYPES);
        const nextMap = mapList[Math.floor(Math.random() * mapList.length)];
        onUpdateRoomSettings?.({ roomMap: nextMap });
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
        const isTargetReady = playerKey === 'p1' ? isP1Ready : isP2Ready;
        const isFactionSelectionLocked = room.status === 'PLAYING' || isTargetReady;

        if (!isEnabled || selectedRule === GAME_RULES.RANDOM) return null;

        return (
            <select
                className="faction-select"
                value={currentFaction.code}
                onChange={(e) => handleFactionChange(playerKey, e.target.value)}
                disabled={isFactionSelectionLocked}
            >
                {Object.values(FACTIONS).map(f => (
                    <option key={f.code} value={f.code}>{f.label}</option>
                ))}
            </select>
        );
    };

    const renderColorSelector = (playerKey, currentColor) => {
        const isEnabled =
            (selectedRule === GAME_RULES.HOST && isHost) ||
            (selectedRule !== GAME_RULES.HOST && user.id === room[playerKey]);
        const isTargetReady = playerKey === 'p1' ? isP1Ready : isP2Ready;
        const isColorSelectionLocked = room.status === 'PLAYING' || isTargetReady;

        if (!isEnabled) return null;

        return (
            <select
                className="faction-select color-select"
                value={currentColor}
                onChange={(e) => handleColorChange(playerKey, e.target.value)}
                disabled={isColorSelectionLocked}
            >
                {PIECE_COLORS.map((color) => (
                    <option key={color.code} value={color.code}>{color.label}</option>
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
                        <div className="piece-color-label">말 색상: {p1Color.toUpperCase()}</div>
                        <div className="faction-label">{p1Faction.label}</div>
                        {/* 진영 선택 셀렉터 */}
                        {renderFactionSelector('p1', p1Faction)}
                        {renderColorSelector('p1', p1Color)}
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
                        <div className="piece-color-label">말 색상: {(isP2Joined ? p2Color : 'black').toUpperCase()}</div>
                        <div className="faction-label">{isP2Joined ? p2Faction.label : 'WAITING'}</div>
                        {/* 진영 선택 셀렉터 (상대가 접속했을 때만 표시) */}
                        {isP2Joined && renderFactionSelector('p2', p2Faction)}
                        {isP2Joined && renderColorSelector('p2', p2Color)}
                    </div>
                </div>

                {/* 3. 게임 옵션 설정 영역 (룰, 맵) */}
                <div className="game-options-section">
                    <div className={`option-group ${ruleChanged ? 'option-changed' : ''}`}>
                        <label htmlFor="rule-select">게임 규칙</label>
                        <select
                            id="rule-select"
                            className="common-select"
                            value={selectedRule}
                            onChange={handleRuleChange}
                            disabled={isHostSettingsDisabled} /* 방장만 변경 가능 + 방장 준비 시 변경 불가 */
                        >
                            {Object.values(GAME_RULES).map(rule => (
                                <option key={rule} value={rule}>{rule}</option>
                            ))}
                        </select>
                    </div>

                    <div className={`option-group ${mapChanged ? 'option-changed' : ''}`}>
                        <label htmlFor="map-select">사용 맵</label>
                        <select
                            id="map-select"
                            className="common-select"
                            value={selectedMap}
                            onChange={handleMapChange}
                            disabled={isHostSettingsDisabled} /* 방장만 변경 가능 + 방장 준비 시 변경 불가 */
                        >
                            {Object.values(MAP_TYPES).map(map => (
                                <option key={map} value={map}>{map}</option>
                            ))}
                        </select>
                    </div>

                    <div className="option-group">
                        <label htmlFor="turn-seconds-input">턴당 시간(초)</label>
                        <input
                            id="turn-seconds-input"
                            className="common-select"
                            type="number"
                            min={1}
                            max={600}
                            step={1}
                            value={turnSecondsInput}
                            onChange={handleTurnSecondsChange}
                            onBlur={handleTurnSecondsBlur}
                            disabled={isHostSettingsDisabled}
                        />
                    </div>
                </div>

                {/* 4. 액션 버튼 영역 (푸터) */}
                <div className="card-footer">
                    {isDiceRolling && (
                        <div className="random-sync-banner">
                            <span className="dice-icon rolling">🎲</span>
                            랜덤 배정 중...
                        </div>
                    )}

                    {room.status === 'PLAYING' && (
                        <div className="game-entered-banner">양측 준비 완료  {countdown}초 후 게임 진입</div>
                    )}

                    {isHost && selectedRule === GAME_RULES.RANDOM && (
                        <button
                            className="btn-secondary btn-random"
                            onClick={handleRandomizeFactions}
                            disabled={!isP2Joined || isHostSettingsDisabled}
                        >
                            <span className={`dice-icon ${isDiceRolling ? 'rolling' : ''}`}>🎲</span> 진영 랜덤 셔플
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