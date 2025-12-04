/**
 * Coordinate scaling utilities for mapping coordinates between
 * scaled screenshot space and actual viewport space.
 */

/**
 * Scales coordinates from model/screenshot space to actual viewport space.
 * When screenshots are scaled down for LLM processing, the model returns
 * coordinates in the scaled space. This function converts them back to
 * actual viewport coordinates.
 *
 * @param x - X coordinate in scaled (screenshot) space
 * @param y - Y coordinate in scaled (screenshot) space
 * @param scaleFactor - The scale factor used to shrink the screenshot (< 1 means screenshot was shrunk)
 * @returns Coordinates in actual viewport space
 *
 * @example
 * // Screenshot was scaled to 50% (scaleFactor = 0.5)
 * // Model clicked at (100, 100) in screenshot space
 * // Actual viewport coordinate is (200, 200)
 * scaleCoordinates(100, 100, 0.5) // returns { x: 200, y: 200 }
 */
export function scaleCoordinates(
  x: number,
  y: number,
  scaleFactor: number | undefined
): { x: number; y: number } {
  // If no scaling, scale factor is 1, or scale factor is 0 (invalid), return original coordinates
  if (!scaleFactor || scaleFactor === 1 || scaleFactor <= 0) {
    return { x, y };
  }

  // Inverse scaling: divide by scaleFactor to get actual viewport coordinates
  // If screenshot was shrunk by 0.5, multiply coordinates by 2 (divide by 0.5)
  const inverseScale = 1 / scaleFactor;

  return {
    x: Math.round(x * inverseScale),
    y: Math.round(y * inverseScale),
  };
}

/**
 * Scales a single coordinate value from screenshot to viewport space.
 * Useful for single-axis operations.
 *
 * @param coord - Coordinate value in scaled space
 * @param scaleFactor - The scale factor used
 * @returns Coordinate in actual viewport space
 */
export function scaleCoordinate(
  coord: number,
  scaleFactor: number | undefined
): number {
  if (!scaleFactor || scaleFactor === 1 || scaleFactor <= 0) {
    return coord;
  }
  return Math.round(coord / scaleFactor);
}
