const normalizeFaction = (value) => {
  if (value === 'janggi' || value === 'omok' || value === 'chess') {
    return value;
  }
  return 'chess';
};

const resolveStarterByMixedFactions = (p1Faction, p2Faction) => {
  if (p1Faction === p2Faction) return 'top';
  if (p1Faction === 'janggi' && p2Faction !== 'janggi') return 'top';
  if (p2Faction === 'janggi' && p1Faction !== 'janggi') return 'bottom';
  return 'top';
};

export const resolveFixedFirstTurnSide = (p1FactionInput, p2FactionInput) => {
  const p1Faction = normalizeFaction(p1FactionInput);
  const p2Faction = normalizeFaction(p2FactionInput);
  return resolveStarterByMixedFactions(p1Faction, p2Faction);
};

export const resolveFixedColorByFactionAndOrder = (factionInput, isFirst) => {
  const faction = normalizeFaction(factionInput);
  if (faction === 'janggi') {
    return isFirst ? 'green' : 'red';
  }
  return isFirst ? 'white' : 'black';
};

export const resolveFixedPieceColors = (p1FactionInput, p2FactionInput) => {
  const firstTurnSide = resolveFixedFirstTurnSide(p1FactionInput, p2FactionInput);
  return resolveFixedPieceColorsByFirstTurn(p1FactionInput, p2FactionInput, firstTurnSide);
};

export const resolveFixedPieceColorsByFirstTurn = (p1FactionInput, p2FactionInput, firstTurnSideInput) => {
  const firstTurnSide = firstTurnSideInput === 'bottom' ? 'bottom' : 'top';
  const isP1First = firstTurnSide === 'top';
  return {
    p1Color: resolveFixedColorByFactionAndOrder(p1FactionInput, isP1First),
    p2Color: resolveFixedColorByFactionAndOrder(p2FactionInput, !isP1First),
  };
};
