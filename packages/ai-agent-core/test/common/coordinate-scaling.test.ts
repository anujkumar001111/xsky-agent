import { scaleCoordinates, scaleCoordinate } from '../../src/common/coordinate-scaling';

describe('common/coordinate-scaling', () => {
  describe('scaleCoordinates', () => {
    test('should return original coordinates when scaleFactor is undefined', () => {
      const result = scaleCoordinates(100, 200, undefined);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    test('should return original coordinates when scaleFactor is 1', () => {
      const result = scaleCoordinates(100, 200, 1);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    test('should return original coordinates when scaleFactor is 0', () => {
      const result = scaleCoordinates(100, 200, 0);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    test('should return original coordinates when scaleFactor is negative', () => {
      const result = scaleCoordinates(100, 200, -0.5);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    test('should scale up coordinates when scaleFactor < 1', () => {
      // Screenshot scaled to 50%, so coordinates should double
      const result = scaleCoordinates(100, 200, 0.5);
      expect(result).toEqual({ x: 200, y: 400 });
    });

    test('should scale up coordinates when scaleFactor = 0.25', () => {
      // Screenshot scaled to 25%, so coordinates should 4x
      const result = scaleCoordinates(100, 100, 0.25);
      expect(result).toEqual({ x: 400, y: 400 });
    });

    test('should scale down coordinates when scaleFactor > 1', () => {
      // Screenshot scaled to 200%, so coordinates should halve
      const result = scaleCoordinates(100, 200, 2);
      expect(result).toEqual({ x: 50, y: 100 });
    });

    test('should round coordinates correctly', () => {
      const result = scaleCoordinates(123, 456, 0.33);
      expect(result.x).toBe(Math.round(123 / 0.33));
      expect(result.y).toBe(Math.round(456 / 0.33));
    });

    test('should handle small scale factors', () => {
      const result = scaleCoordinates(10, 20, 0.1);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    test('should handle large scale factors', () => {
      const result = scaleCoordinates(100, 200, 10);
      expect(result).toEqual({ x: 10, y: 20 });
    });

    test('should handle zero coordinates', () => {
      const result = scaleCoordinates(0, 0, 0.5);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    test('should handle negative coordinates', () => {
      const result = scaleCoordinates(-100, -200, 0.5);
      expect(result).toEqual({ x: -200, y: -400 });
    });

    test('should handle mixed positive and negative coordinates', () => {
      const result = scaleCoordinates(100, -200, 0.5);
      expect(result).toEqual({ x: 200, y: -400 });
    });

    test('should handle fractional scale factors', () => {
      const result = scaleCoordinates(100, 100, 0.75);
      const expected = Math.round(100 / 0.75);
      expect(result.x).toBe(expected);
      expect(result.y).toBe(expected);
    });

    test('should return integers (rounded)', () => {
      const result = scaleCoordinates(100, 100, 0.33);
      expect(Number.isInteger(result.x)).toBe(true);
      expect(Number.isInteger(result.y)).toBe(true);
    });

    test('should handle very small coordinates', () => {
      const result = scaleCoordinates(1, 1, 0.5);
      expect(result).toEqual({ x: 2, y: 2 });
    });

    test('should handle very large coordinates', () => {
      const result = scaleCoordinates(10000, 20000, 0.5);
      expect(result).toEqual({ x: 20000, y: 40000 });
    });

    test('should be accurate for common screenshot scales', () => {
      // Common scenario: screenshot shrunk to 50%
      const result1 = scaleCoordinates(960, 540, 0.5);
      expect(result1).toEqual({ x: 1920, y: 1080 });

      // Common scenario: screenshot shrunk to 33%
      const result2 = scaleCoordinates(320, 180, 1 / 3);
      expect(result2.x).toBeCloseTo(960, 0);
      expect(result2.y).toBeCloseTo(540, 0);
    });
  });

  describe('scaleCoordinate', () => {
    test('should return original coordinate when scaleFactor is undefined', () => {
      const result = scaleCoordinate(100, undefined);
      expect(result).toBe(100);
    });

    test('should return original coordinate when scaleFactor is 1', () => {
      const result = scaleCoordinate(100, 1);
      expect(result).toBe(100);
    });

    test('should return original coordinate when scaleFactor is 0', () => {
      const result = scaleCoordinate(100, 0);
      expect(result).toBe(100);
    });

    test('should return original coordinate when scaleFactor is negative', () => {
      const result = scaleCoordinate(100, -0.5);
      expect(result).toBe(100);
    });

    test('should scale up coordinate when scaleFactor < 1', () => {
      const result = scaleCoordinate(100, 0.5);
      expect(result).toBe(200);
    });

    test('should scale up coordinate when scaleFactor = 0.25', () => {
      const result = scaleCoordinate(100, 0.25);
      expect(result).toBe(400);
    });

    test('should scale down coordinate when scaleFactor > 1', () => {
      const result = scaleCoordinate(100, 2);
      expect(result).toBe(50);
    });

    test('should round coordinate correctly', () => {
      const result = scaleCoordinate(123, 0.33);
      expect(result).toBe(Math.round(123 / 0.33));
    });

    test('should return integer (rounded)', () => {
      const result = scaleCoordinate(100, 0.33);
      expect(Number.isInteger(result)).toBe(true);
    });

    test('should handle zero coordinate', () => {
      const result = scaleCoordinate(0, 0.5);
      expect(result).toBe(0);
    });

    test('should handle negative coordinate', () => {
      const result = scaleCoordinate(-100, 0.5);
      expect(result).toBe(-200);
    });

    test('should handle small scale factors', () => {
      const result = scaleCoordinate(10, 0.1);
      expect(result).toBe(100);
    });

    test('should handle large scale factors', () => {
      const result = scaleCoordinate(100, 10);
      expect(result).toBe(10);
    });

    test('should handle very small coordinates', () => {
      const result = scaleCoordinate(1, 0.5);
      expect(result).toBe(2);
    });

    test('should handle very large coordinates', () => {
      const result = scaleCoordinate(10000, 0.5);
      expect(result).toBe(20000);
    });

    test('should handle fractional scale factors', () => {
      const result = scaleCoordinate(100, 0.75);
      expect(result).toBe(Math.round(100 / 0.75));
    });

    test('should be consistent with scaleCoordinates for x axis', () => {
      const scaleFactor = 0.5;
      const x = 100;
      const y = 200;

      const singleResult = scaleCoordinate(x, scaleFactor);
      const pairResult = scaleCoordinates(x, y, scaleFactor);

      expect(singleResult).toBe(pairResult.x);
    });

    test('should be consistent with scaleCoordinates for y axis', () => {
      const scaleFactor = 0.5;
      const x = 100;
      const y = 200;

      const singleResult = scaleCoordinate(y, scaleFactor);
      const pairResult = scaleCoordinates(x, y, scaleFactor);

      expect(singleResult).toBe(pairResult.y);
    });

    test('should handle edge case of very small non-zero scale factor', () => {
      const result = scaleCoordinate(10, 0.001);
      expect(result).toBe(10000);
    });

    test('should handle edge case of scale factor close to 1', () => {
      const result = scaleCoordinate(100, 0.99);
      expect(result).toBeCloseTo(101, 0);
    });
  });

  describe('Integration scenarios', () => {
    test('should accurately convert screenshot coordinates to viewport for common resolutions', () => {
      // Scenario: 1920x1080 viewport, screenshot scaled to 50%
      const screenshotX = 960;
      const screenshotY = 540;
      const scaleFactor = 0.5;

      const result = scaleCoordinates(screenshotX, screenshotY, scaleFactor);

      // Should map back to original viewport coordinates
      expect(result).toEqual({ x: 1920, y: 1080 });
    });

    test('should handle multiple scale transformations', () => {
      // First screenshot at 50%
      let result = scaleCoordinates(100, 100, 0.5);
      expect(result).toEqual({ x: 200, y: 200 });

      // This should now match the viewport, so scaling by 1 should return same
      const resultAgain = scaleCoordinates(result.x, result.y, 1);
      expect(resultAgain).toEqual(result);
    });

    test('should be reversible for common scale factors', () => {
      const viewportX = 1920;
      const viewportY = 1080;
      const scaleFactor = 0.5;

      // Scale down from viewport to screenshot space
      const screenshotCoords = {
        x: Math.round(viewportX * scaleFactor),
        y: Math.round(viewportY * scaleFactor),
      };
      expect(screenshotCoords).toEqual({ x: 960, y: 540 });

      // Scale back up to viewport space
      const result = scaleCoordinates(screenshotCoords.x, screenshotCoords.y, scaleFactor);
      expect(result).toEqual({ x: viewportX, y: viewportY });
    });
  });

  describe('Documentation examples', () => {
    test('should match documentation example', () => {
      // From the documentation: scaleCoordinates(100, 100, 0.5) // returns { x: 200, y: 200 }
      const result = scaleCoordinates(100, 100, 0.5);
      expect(result).toEqual({ x: 200, y: 200 });
    });
  });

  describe('Viewport scaling edge cases', () => {
    describe('Very small viewports', () => {
      test('should handle 320x240 (QVGA) viewport', () => {
        // Assume screenshot scaled to fit 320x240 at 50%
        const result = scaleCoordinates(160, 120, 0.5);
        expect(result).toEqual({ x: 320, y: 240 });
      });

      test('should handle 176x144 (QCIF) viewport', () => {
        const result = scaleCoordinates(88, 72, 0.5);
        expect(result).toEqual({ x: 176, y: 144 });
      });

      test('should handle 1x1 minimum viewport', () => {
        const result = scaleCoordinates(1, 1, 1);
        expect(result).toEqual({ x: 1, y: 1 });
      });
    });

    describe('Very large viewports (8K and beyond)', () => {
      test('should handle 7680x4320 (8K UHD) viewport', () => {
        // 8K scaled to 25%
        const result = scaleCoordinates(1920, 1080, 0.25);
        expect(result).toEqual({ x: 7680, y: 4320 });
      });

      test('should handle 10240x4320 (Ultra-wide 8K) viewport', () => {
        // Ultra-wide 8K scaled to 20%
        const result = scaleCoordinates(2048, 864, 0.2);
        expect(result).toEqual({ x: 10240, y: 4320 });
      });

      test('should handle 15360x8640 (16K) viewport', () => {
        // 16K scaled to 10%
        const result = scaleCoordinates(1536, 864, 0.1);
        expect(result).toEqual({ x: 15360, y: 8640 });
      });
    });

    describe('Rounding behavior for fractional coordinates', () => {
      test('should round 0.5 up (standard rounding)', () => {
        // 1.5 should round to 2
        const result = scaleCoordinate(3, 2);
        expect(result).toBe(2); // 3/2 = 1.5, rounds to 2
      });

      test('should round consistently for precision edge cases', () => {
        // Test scale factor that causes floating point issues
        const scaleFactor = 1 / 3;
        const result = scaleCoordinates(100, 100, scaleFactor);

        // Should be close to 300 (100 / (1/3) = 300)
        expect(result.x).toBe(300);
        expect(result.y).toBe(300);
      });

      test('should handle coordinates that result in x.49999... (floating point)', () => {
        // This tests floating point precision handling
        const result = scaleCoordinate(99, 0.33);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBe(Math.round(99 / 0.33));
      });

      test('should handle coordinates that result in x.50001... (floating point)', () => {
        const result = scaleCoordinate(101, 0.33);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBe(Math.round(101 / 0.33));
      });
    });

    describe('Common resolution scaling scenarios', () => {
      test('should correctly scale 1366x768 (HD) to 1024x768 bounds', () => {
        // 1366x768 scaled to fit within 1024x768
        // Width is the constraint: 1024/1366 ≈ 0.75
        const scaleFactor = 1024 / 1366;
        const screenshotX = Math.round(1366 * scaleFactor);
        const screenshotY = Math.round(768 * scaleFactor);

        const result = scaleCoordinates(screenshotX, screenshotY, scaleFactor);
        expect(result.x).toBeCloseTo(1366, 0);
        expect(result.y).toBeCloseTo(768, 0);
      });

      test('should correctly scale 2560x1440 (QHD) to 1024x768 bounds', () => {
        const scaleFactor = 1024 / 2560; // 0.4
        const screenshotX = Math.round(2560 * scaleFactor);
        const screenshotY = Math.round(1440 * scaleFactor);

        const result = scaleCoordinates(screenshotX, screenshotY, scaleFactor);
        expect(result.x).toBe(2560);
        expect(result.y).toBe(1440);
      });

      test('should correctly scale 3440x1440 (Ultrawide QHD)', () => {
        const scaleFactor = 1024 / 3440;
        const screenshotX = Math.round(3440 * scaleFactor);
        const screenshotY = Math.round(1440 * scaleFactor);

        const result = scaleCoordinates(screenshotX, screenshotY, scaleFactor);
        // Allow for rounding differences (±1 pixel)
        expect(Math.abs(result.x - 3440)).toBeLessThanOrEqual(1);
        expect(Math.abs(result.y - 1440)).toBeLessThanOrEqual(1);
      });
    });

    describe('Boundary dimension tests', () => {
      test('should handle exactly-at-boundary width', () => {
        // Original: 1024x600, max: 1024x768
        // Width is exactly at boundary, height is within
        const result = scaleCoordinates(1024, 600, 1);
        expect(result).toEqual({ x: 1024, y: 600 });
      });

      test('should handle exactly-at-boundary height', () => {
        // Original: 800x768, max: 1024x768
        // Height is exactly at boundary, width is within
        const result = scaleCoordinates(800, 768, 1);
        expect(result).toEqual({ x: 800, y: 768 });
      });

      test('should handle exactly-at-boundary both dimensions', () => {
        const result = scaleCoordinates(1024, 768, 1);
        expect(result).toEqual({ x: 1024, y: 768 });
      });
    });
  });
});
