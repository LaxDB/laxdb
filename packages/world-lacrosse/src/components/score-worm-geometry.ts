export interface ScoreWormHitPoint {
  readonly sequence: number;
  readonly x: number;
  readonly y: number;
}

export const nearestScoreWormGoal = (
  points: readonly Readonly<ScoreWormHitPoint>[],
  pointerX: number,
  pointerY: number,
  scaleX: number,
  scaleY: number,
  maximumDistance = 18,
): number | null => {
  let nearestSequence: number | null = null;
  let nearestDistanceSquared = maximumDistance * maximumDistance;

  for (const point of points) {
    const distanceX = point.x * scaleX - pointerX;
    const distanceY = point.y * scaleY - pointerY;
    const distanceSquared = distanceX * distanceX + distanceY * distanceY;
    if (distanceSquared >= nearestDistanceSquared) continue;
    nearestDistanceSquared = distanceSquared;
    nearestSequence = point.sequence;
  }

  return nearestSequence;
};
