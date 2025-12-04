/**
 * Tests for screenshot resolution normalization
 * Verifies scaling logic and aspect ratio preservation
 */

import config from "@xsky/ai-agent-core/config";

describe("Screenshot Scaling Configuration", () => {
  describe("Config defaults", () => {
    it("should have screenshotScaling disabled by default", () => {
      expect(config.screenshotScaling).toBeDefined();
      expect(config.screenshotScaling.enabled).toBe(false);
    });

    it("should have XGA default max dimensions", () => {
      expect(config.screenshotScaling.maxWidth).toBe(1024);
      expect(config.screenshotScaling.maxHeight).toBe(768);
    });
  });

  describe("Scale factor calculation", () => {
    // Helper function that mirrors the BrowserAgent scaling logic
    function calculateScaleFactor(
      originalWidth: number,
      originalHeight: number,
      maxWidth: number,
      maxHeight: number
    ): number {
      const widthRatio = maxWidth / originalWidth;
      const heightRatio = maxHeight / originalHeight;
      return Math.min(widthRatio, heightRatio, 1);
    }

    it("should return 1 when image fits within bounds", () => {
      // Image smaller than max dimensions
      const scaleFactor = calculateScaleFactor(800, 600, 1024, 768);
      expect(scaleFactor).toBe(1);
    });

    it("should return 1 when image exactly matches bounds", () => {
      const scaleFactor = calculateScaleFactor(1024, 768, 1024, 768);
      expect(scaleFactor).toBe(1);
    });

    it("should scale down width-constrained images", () => {
      // 2048x768 image - width is the constraint
      const scaleFactor = calculateScaleFactor(2048, 768, 1024, 768);
      expect(scaleFactor).toBe(0.5);
    });

    it("should scale down height-constrained images", () => {
      // 1024x1536 image - height is the constraint
      const scaleFactor = calculateScaleFactor(1024, 1536, 1024, 768);
      expect(scaleFactor).toBe(0.5);
    });

    it("should scale down both-constrained images correctly", () => {
      // 2048x1536 image - both need scaling, pick smaller factor
      const scaleFactor = calculateScaleFactor(2048, 1536, 1024, 768);
      expect(scaleFactor).toBe(0.5);
    });

    it("should preserve aspect ratio for common resolutions", () => {
      // 1920x1080 (16:9 Full HD)
      const scaleFactor1080p = calculateScaleFactor(1920, 1080, 1024, 768);
      expect(scaleFactor1080p).toBeCloseTo(0.533, 2); // 1024/1920

      // 2560x1440 (16:9 QHD)
      const scaleFactorQHD = calculateScaleFactor(2560, 1440, 1024, 768);
      expect(scaleFactorQHD).toBe(0.4); // 1024/2560

      // 3840x2160 (16:9 4K)
      const scaleFactor4K = calculateScaleFactor(3840, 2160, 1024, 768);
      expect(scaleFactor4K).toBeCloseTo(0.267, 2); // 1024/3840
    });

    it("should handle portrait orientation", () => {
      // 768x1024 portrait
      const scaleFactor = calculateScaleFactor(768, 1024, 1024, 768);
      expect(scaleFactor).toBe(0.75); // 768/1024
    });

    it("should never upscale", () => {
      // Tiny image
      const scaleFactor = calculateScaleFactor(100, 100, 1024, 768);
      expect(scaleFactor).toBe(1);
    });
  });

  describe("Scaled dimensions calculation", () => {
    function calculateScaledDimensions(
      originalWidth: number,
      originalHeight: number,
      maxWidth: number,
      maxHeight: number
    ): { width: number; height: number; scaleFactor: number } {
      const widthRatio = maxWidth / originalWidth;
      const heightRatio = maxHeight / originalHeight;
      const scaleFactor = Math.min(widthRatio, heightRatio, 1);

      if (scaleFactor < 1) {
        return {
          width: Math.round(originalWidth * scaleFactor),
          height: Math.round(originalHeight * scaleFactor),
          scaleFactor,
        };
      }

      return {
        width: originalWidth,
        height: originalHeight,
        scaleFactor: 1,
      };
    }

    it("should scale 1920x1080 correctly", () => {
      const result = calculateScaledDimensions(1920, 1080, 1024, 768);
      expect(result.width).toBe(1024);
      expect(result.height).toBe(576); // Maintains 16:9
      expect(result.scaleFactor).toBeCloseTo(0.533, 2);
    });

    it("should scale 3840x2160 (4K) correctly", () => {
      const result = calculateScaledDimensions(3840, 2160, 1024, 768);
      expect(result.width).toBe(1024);
      expect(result.height).toBe(576); // Maintains 16:9
      expect(result.scaleFactor).toBeCloseTo(0.267, 2);
    });

    it("should not change dimensions when within bounds", () => {
      const result = calculateScaledDimensions(800, 600, 1024, 768);
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.scaleFactor).toBe(1);
    });
  });
});
