import React from 'react';
import './room-page.css';
import { FACTIONS, GAME_RULES, MAP_TYPES, OMOK_STONE_TARGET_OPTIONS } from '@/game/constants';
import { resolveRoomReadyState } from '@/game/room-settings';
import { useRoomSetup } from '@/hooks/useRoomSetup';

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
    const readyState = resolveRoomReadyState(room);
    const isP1Ready = readyState.p1Ready;
    const isP2Ready = readyState.p2Ready;
    const isCurrentUserReady = isHost ? isP1Ready : isP2Ready;
    const isHostSettingsDisabled = !isHost || isP1Ready || room.status === 'PLAYING';
    const {
        selectedRule,
        selectedMap,
        p1Faction,
        p2Faction,
        omokStoneTarget,
        countdown,
        ruleChanged,
        mapChanged,
        turnSecondsInput,
        isDiceRolling,
        handleRuleChange,
        handleMapChange,
        handleTurnSecondsChange,
        handleTurnSecondsBlur,
        handleOmokStoneTargetChange,
        handleFactionChange,
        handleRandomizeFactions,
        handleReadyClick,
        getIsOmokTargetEditable,
    } = useRoomSetup({
        room,
        user,
        onUpdateRoomSettings,
        isHost,
        isP2Joined,
        isP1Ready,
        isP2Ready,
        isHostSettingsDisabled,
    });

    // --- UI Sub-components --- 

    /**
     * 진영 선택 셀렉트 박스 렌더링
     */
    const renderFactionSelector = (playerKey, currentFaction) => {
        const isBotSideControl = !!room?.isBotRoom && playerKey === 'p2' && isHost;
        const isEnabled =
            (selectedRule === GAME_RULES.FREE && user.id === room[playerKey]) ||
            (selectedRule === GAME_RULES.HOST && isHost) ||
            isBotSideControl;
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

    return (
        <div className="room-page-container">
            {/* 메인 게임 셋업 카드 */}
            <div className="game-setup-card">

                {/* 1. 헤더 영역 (방 제목, 나가기) */}
                <div className="card-header">
                    <h2 className="room-title">{room.title} {room.isPrivate ? '🔒' : ''}</h2>
                    <button className="btn-secondary btn-leave" onClick={onLeave}>나가기</button>
                </div>

                {room.isPrivate && <div className="game-entered-banner">이 방은 비공개 방입니다.</div>}

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

                    <div className="option-group">
                        <label htmlFor="omok-stone-target-select">오목 돌 제거 승리(N)</label>
                        <select
                            id="omok-stone-target-select"
                            className="common-select"
                            value={omokStoneTarget}
                            onChange={handleOmokStoneTargetChange}
                            disabled={!getIsOmokTargetEditable()}
                        >
                            {OMOK_STONE_TARGET_OPTIONS.map((value) => (
                                <option key={value} value={value}>{value}</option>
                            ))}
                        </select>
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