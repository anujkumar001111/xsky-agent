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

  describe("Extended resolution test cases", () => {
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

    describe("Portrait orientation tests", () => {
      it("should handle 1080x1920 (Full HD Portrait)", () => {
        const result = calculateScaledDimensions(1080, 1920, 1024, 768);
        expect(result.scaleFactor).toBe(0.4); // 768/1920
        expect(result.width).toBe(432);
        expect(result.height).toBe(768);
      });

      it("should handle 1440x2560 (QHD Portrait)", () => {
        const result = calculateScaledDimensions(1440, 2560, 1024, 768);
        expect(result.scaleFactor).toBe(0.3); // 768/2560
        expect(result.width).toBe(432);
        expect(result.height).toBe(768);
      });

      it("should handle 2160x3840 (4K Portrait)", () => {
        const result = calculateScaledDimensions(2160, 3840, 1024, 768);
        expect(result.scaleFactor).toBe(0.2); // 768/3840
        expect(result.width).toBe(432);
        expect(result.height).toBe(768);
      });

      it("should handle mobile portrait 375x812 (iPhone X)", () => {
        const result = calculateScaledDimensions(375, 812, 1024, 768);
        // Height is the constraint: 768/812 ≈ 0.946
        expect(result.scaleFactor).toBeCloseTo(0.946, 2);
        expect(result.width).toBe(355);
        expect(result.height).toBe(768);
      });

      it("should handle mobile portrait 390x844 (iPhone 12/13)", () => {
        const result = calculateScaledDimensions(390, 844, 1024, 768);
        expect(result.scaleFactor).toBeCloseTo(0.91, 2);
        expect(result.height).toBe(768);
      });
    });

    describe("Exactly-at-boundary tests", () => {
      it("should handle width exactly at boundary (1024x600)", () => {
        const result = calculateScaledDimensions(1024, 600, 1024, 768);
        expect(result.scaleFactor).toBe(1);
        expect(result.width).toBe(1024);
        expect(result.height).toBe(600);
      });

      it("should handle height exactly at boundary (800x768)", () => {
        const result = calculateScaledDimensions(800, 768, 1024, 768);
        expect(result.scaleFactor).toBe(1);
        expect(result.width).toBe(800);
        expect(result.height).toBe(768);
      });

      it("should handle both dimensions exactly at boundary", () => {
        const result = calculateScaledDimensions(1024, 768, 1024, 768);
        expect(result.scaleFactor).toBe(1);
        expect(result.width).toBe(1024);
        expect(result.height).toBe(768);
      });

      it("should handle 1px over width boundary", () => {
        const result = calculateScaledDimensions(1025, 768, 1024, 768);
        expect(result.scaleFactor).toBeLessThan(1);
        expect(result.width).toBeLessThanOrEqual(1024);
      });

      it("should handle 1px over height boundary", () => {
        const result = calculateScaledDimensions(1024, 769, 1024, 768);
        expect(result.scaleFactor).toBeLessThan(1);
        expect(result.height).toBeLessThanOrEqual(768);
      });
    });

    describe("Additional common resolutions", () => {
      it("should scale 2560x1600 (WQXGA) correctly", () => {
        const result = calculateScaledDimensions(2560, 1600, 1024, 768);
        expect(result.scaleFactor).toBe(0.4); // 1024/2560
        expect(result.width).toBe(1024);
        expect(result.height).toBe(640);
      });

      it("should scale 2880x1800 (Retina 15\") correctly", () => {
        const result = calculateScaledDimensions(2880, 1800, 1024, 768);
        expect(result.scaleFactor).toBeCloseTo(0.356, 2); // 1024/2880
        expect(result.width).toBe(1024);
        expect(result.height).toBe(640);
      });

      it("should scale 5120x2880 (5K) correctly", () => {
        const result = calculateScaledDimensions(5120, 2880, 1024, 768);
        expect(result.scaleFactor).toBe(0.2); // 1024/5120
        expect(result.width).toBe(1024);
        expect(result.height).toBe(576);
      });

      it("should scale 7680x4320 (8K UHD) correctly", () => {
        const result = calculateScaledDimensions(7680, 4320, 1024, 768);
        expect(result.scaleFactor).toBeCloseTo(0.133, 2); // 1024/7680
        expect(result.width).toBe(1024);
        expect(result.height).toBe(576);
      });

      it("should scale ultrawide 3440x1440 correctly", () => {
        const result = calculateScaledDimensions(3440, 1440, 1024, 768);
        expect(result.scaleFactor).toBeCloseTo(0.298, 2); // 1024/3440
        expect(result.width).toBe(1024);
        expect(result.height).toBe(429);
      });

      it("should scale super ultrawide 5120x1440 correctly", () => {
        const result = calculateScaledDimensions(5120, 1440, 1024, 768);
        expect(result.scaleFactor).toBe(0.2); // 1024/5120
        expect(result.width).toBe(1024);
        expect(result.height).toBe(288);
      });
    });

    describe("Edge cases and limitations", () => {
      it("should handle square aspect ratio", () => {
        const result = calculateScaledDimensions(1500, 1500, 1024, 768);
        // Height is the constraint: 768/1500 = 0.512
        expect(result.scaleFactor).toBeCloseTo(0.512, 2);
        expect(result.width).toBe(768);
        expect(result.height).toBe(768);
      });

      it("should handle extreme aspect ratio (32:9)", () => {
        const result = calculateScaledDimensions(5120, 1440, 1024, 768);
        expect(result.width).toBe(1024);
        expect(result.height).toBeLessThan(768);
      });

      it("should handle extreme tall aspect ratio (9:32)", () => {
        const result = calculateScaledDimensions(1440, 5120, 1024, 768);
        expect(result.height).toBe(768);
        expect(result.width).toBeLessThan(1024);
      });
    });
  });

  describe("OUT OF SCOPE: Electron coordinate/keyboard tools", () => {
    /**
     * NOTE: The following features are NOT implemented in Electron BrowserAgent:
     * - buildCoordinateTools() - Electron package does not implement coordinate-based mouse tools
     * - buildKeyboardTools() - Electron package does not implement keyboard tools
     *
     * These tests document this limitation. If these features are added in the future,
     * corresponding tests should be implemented here.
     */
    it("should document that coordinate tools are not implemented in Electron", () => {
      // This test exists purely for documentation purposes
      // Electron BrowserAgent (packages/ai-agent-electron/src/browser.ts) does not
      // implement buildCoordinateTools() like the Node.js BrowserAgent does.
      expect(true).toBe(true);
    });

    it("should document that keyboard tools are not implemented in Electron", () => {
      // This test exists purely for documentation purposes
      // Electron BrowserAgent does not implement buildKeyboardTools()
      expect(true).toBe(true);
    });
  });
});
