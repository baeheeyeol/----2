export function computeRemainingPool(poolTypes, placedItems) {
  const placedCountByType = new Map();
  placedItems.forEach((item) => placedCountByType.set(item.type, (placedCountByType.get(item.type) || 0) + 1));

  const temp = new Map(placedCountByType);
  return poolTypes
    .map((type, index) => {
      const used = temp.get(type) || 0;
      if (used > 0) {
        temp.set(type, used - 1);
        return null;
      }
      return { id: `${type}-${index}`, type };
    })
    .filter(Boolean);
}

export function resolvePlacementsForSide({
  targetSide,
  mySide,
  myFaction,
  opponentSide,
  opponentFaction,
  myMode,
  opponentMode,
  myCustomLayout,
  opponentCustomLayout,
  myDefaultPlacements,
  opponentDefaultPlacements,
  canUseCustom,
}) {
  if (mySide === targetSide) {
    return canUseCustom(myFaction, myMode) ? myCustomLayout : myDefaultPlacements;
  }

  if (opponentSide === targetSide) {
    return canUseCustom(opponentFaction, opponentMode) ? opponentCustomLayout : opponentDefaultPlacements;
  }

  return [];
}