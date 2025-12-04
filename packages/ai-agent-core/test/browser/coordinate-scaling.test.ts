/**
 * Tests for coordinate scaling functionality
 * Verifies coordinate mapping from scaled screenshot space to actual viewport space
 */

import { scaleCoordinates, scaleCoordinate } from "../../src/common/coordinate-scaling";

describe("Coordinate Scaling", () => {
  describe("scaleCoordinates", () => {
    it("should return original coordinates when scaleFactor is 1", () => {
      const result = scaleCoordinates(100, 200, 1);
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it("should return original coordinates when scaleFactor is undefined", () => {
      const result = scaleCoordinates(100, 200, undefined);
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it("should scale up coordinates when screenshot was shrunk (scaleFactor < 1)", () => {
      // Screenshot scaled to 50%, so coordinates need to be doubled
      const result = scaleCoordinates(100, 200, 0.5);
      expect(result.x).toBe(200);
      expect(result.y).toBe(400);
    });

    it("should scale correctly for 1920x1080 -> 1024 scaling", () => {
      // Scale factor for 1920 -> 1024 is approximately 0.533
      const scaleFactor = 1024 / 1920;
      // If model clicks at (512, 288) in scaled space
      const result = scaleCoordinates(512, 288, scaleFactor);
      // Should map back to (960, 540) - center of 1920x1080
      expect(result.x).toBe(960);
      expect(result.y).toBe(540);
    });

    it("should scale correctly for 4K -> XGA scaling", () => {
      // 3840x2160 -> 1024x576 (maintaining 16:9 ratio)
      const scaleFactor = 1024 / 3840;
      // If model clicks at corner (1024, 576) in scaled space
      const result = scaleCoordinates(1024, 576, scaleFactor);
      // Should map back to (3840, 2160)
      expect(result.x).toBe(3840);
      expect(result.y).toBe(2160);
    });

    it("should handle fractional coordinates with rounding", () => {
      // Scale factor that results in fractional coordinates
      const scaleFactor = 0.7;
      const result = scaleCoordinates(100, 100, scaleFactor);
      // 100 / 0.7 = 142.857... -> should round to 143
      expect(result.x).toBe(143);
      expect(result.y).toBe(143);
    });

    it("should handle edge case with zero coordinates", () => {
      const result = scaleCoordinates(0, 0, 0.5);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it("should return original coordinates when scaleFactor is 0 (guard against division by zero)", () => {
      const result = scaleCoordinates(100, 200, 0);
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it("should return original coordinates when scaleFactor is negative", () => {
      const result = scaleCoordinates(100, 200, -0.5);
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });
  });

  describe("scaleCoordinate", () => {
    it("should return original coordinate when scaleFactor is 1", () => {
      expect(scaleCoordinate(100, 1)).toBe(100);
    });

    it("should return original coordinate when scaleFactor is undefined", () => {
      expect(scaleCoordinate(100, undefined)).toBe(100);
    });

    it("should scale up single coordinate", () => {
      expect(scaleCoordinate(100, 0.5)).toBe(200);
    });

    it("should return original coordinate when scaleFactor is 0", () => {
      expect(scaleCoordinate(100, 0)).toBe(100);
    });

    it("should return original coordinate when scaleFactor is negative", () => {
      expect(scaleCoordinate(100, -1)).toBe(100);
    });
  });

  describe("Integration scenarios", () => {
    it("should correctly reverse screenshot scaling for click operations", () => {
      // Simulate: Original viewport is 1920x1080
      // Screenshot scaled to XGA (1024x768 max, but maintains ratio)
      // Actual scaled size: 1024x576 (16:9 ratio maintained)
      const scaleFactor = 1024 / 1920; // 0.533...

      // User sees a button at (512, 288) in the scaled screenshot
      // This should map to (960, 540) in actual viewport
      const result = scaleCoordinates(512, 288, scaleFactor);
      expect(result.x).toBe(960);
      expect(result.y).toBe(540);
    });

    it("should be inverse of screenshot scaling", () => {
      // Original coordinates
      const originalX = 1000;
      const originalY = 500;

      // Screenshot scaling shrinks by 50%
      const scaleFactor = 0.5;
      const screenshotX = originalX * scaleFactor; // 500
      const screenshotY = originalY * scaleFactor; // 250

      // Coordinate scaling should reverse this
      const result = scaleCoordinates(screenshotX, screenshotY, scaleFactor);
      expect(result.x).toBe(originalX);
      expect(result.y).toBe(originalY);
    });
  });
});
