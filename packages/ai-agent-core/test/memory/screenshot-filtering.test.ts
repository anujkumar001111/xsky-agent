/**
 * Tests for screenshot recency filtering in EkoMemory
 * Verifies that old screenshots are replaced with placeholders while keeping recent ones
 */

import { EkoMemory, MemoryConfig } from "../../src/memory/memory";
import { EkoMessage } from "../../src/types";

describe("Screenshot Filtering", () => {
  // Helper to create a user message with an image
  function createImageMessage(id: string, mimeType: string = "image/jpeg"): EkoMessage {
    return {
      id,
      role: "user",
      timestamp: Date.now(),
      content: [
        {
          type: "image",
          data: "base64data",
          mimeType,
        },
        {
          type: "text",
          text: "Screenshot attached",
        },
      ],
    };
  }

  // Helper to create a text-only message
  function createTextMessage(id: string, role: "user" | "assistant" = "user"): EkoMessage {
    if (role === "user") {
      return {
        id,
        role: "user",
        timestamp: Date.now(),
        content: "Just text",
      };
    }
    return {
      id,
      role: "assistant",
      timestamp: Date.now(),
      content: [{ type: "text", text: "Response" }],
    };
  }

  describe("filterOldScreenshots", () => {
    it("should keep N most recent screenshots and replace older ones", () => {
      const memory = new EkoMemory("system prompt", [
        createTextMessage("1"),
        createImageMessage("2"),
        createTextMessage("3", "assistant"),
        createTextMessage("4"),
        createImageMessage("5"),
        createTextMessage("6", "assistant"),
        createTextMessage("7"),
        createImageMessage("8"),
      ], { maxRecentScreenshots: 0 }); // Disabled by default

      // Manually call filterOldScreenshots
      memory.filterOldScreenshots(2);

      const messages = memory.getMessages();

      // First image (id=2) should be replaced
      const msg2 = messages.find(m => m.id === "2");
      expect(msg2).toBeDefined();
      expect((msg2?.content as any[])[0].type).toBe("text");
      expect((msg2?.content as any[])[0].text).toBe("[screenshot]");

      // Second image (id=5) should be kept (2nd to last)
      const msg5 = messages.find(m => m.id === "5");
      expect(msg5).toBeDefined();
      expect((msg5?.content as any[])[0].type).toBe("image");

      // Third image (id=8) should be kept (last)
      const msg8 = messages.find(m => m.id === "8");
      expect(msg8).toBeDefined();
      expect((msg8?.content as any[])[0].type).toBe("image");
    });

    it("should not modify anything when keepCount is 0", () => {
      const memory = new EkoMemory("system prompt", [
        createTextMessage("1"),
        createImageMessage("2"),
        createImageMessage("3"),
      ]);

      memory.filterOldScreenshots(0);

      const messages = memory.getMessages();
      const msg2 = messages.find(m => m.id === "2");
      const msg3 = messages.find(m => m.id === "3");

      expect((msg2?.content as any[])[0].type).toBe("image");
      expect((msg3?.content as any[])[0].type).toBe("image");
    });

    it("should not modify anything when screenshot count is within limit", () => {
      const memory = new EkoMemory("system prompt", [
        createTextMessage("1"),
        createImageMessage("2"),
        createImageMessage("3"),
      ]);

      memory.filterOldScreenshots(5); // Limit is higher than screenshot count

      const messages = memory.getMessages();
      const msg2 = messages.find(m => m.id === "2");
      const msg3 = messages.find(m => m.id === "3");

      expect((msg2?.content as any[])[0].type).toBe("image");
      expect((msg3?.content as any[])[0].type).toBe("image");
    });

    it("should preserve text content alongside replaced screenshots", () => {
      const memory = new EkoMemory("system prompt", [
        createTextMessage("1"),
        createImageMessage("2"),
        createImageMessage("3"),
      ]);

      memory.filterOldScreenshots(1);

      const messages = memory.getMessages();
      const msg2 = messages.find(m => m.id === "2");

      // Image replaced with placeholder
      expect((msg2?.content as any[])[0].type).toBe("text");
      expect((msg2?.content as any[])[0].text).toBe("[screenshot]");

      // Original text preserved
      expect((msg2?.content as any[])[1].type).toBe("text");
      expect((msg2?.content as any[])[1].text).toBe("Screenshot attached");
    });

    it("should handle multiple images in single message", () => {
      const multiImageMessage: EkoMessage = {
        id: "multi",
        role: "user",
        timestamp: Date.now(),
        content: [
          { type: "image", data: "img1", mimeType: "image/png" },
          { type: "image", data: "img2", mimeType: "image/jpeg" },
          { type: "text", text: "Two images" },
        ],
      };

      const memory = new EkoMemory("system prompt", [
        createTextMessage("1"),
        multiImageMessage,
        createImageMessage("3"),
      ]);

      // Keep only 1 screenshot
      memory.filterOldScreenshots(1);

      const messages = memory.getMessages();
      const multiMsg = messages.find(m => m.id === "multi");

      // Both images in multi-image message should be replaced (they're older)
      expect((multiMsg?.content as any[])[0].text).toBe("[screenshot]");
      expect((multiMsg?.content as any[])[1].text).toBe("[screenshot]");

      // Last image should be kept
      const msg3 = messages.find(m => m.id === "3");
      expect((msg3?.content as any[])[0].type).toBe("image");
    });

    it("should ignore non-image content types", () => {
      const memory = new EkoMemory("system prompt", [
        createTextMessage("1"),
        {
          id: "2",
          role: "user",
          timestamp: Date.now(),
          content: [
            { type: "text", text: "Just text" },
          ],
        },
        createImageMessage("3"),
      ]);

      memory.filterOldScreenshots(1);

      const messages = memory.getMessages();
      const msg2 = messages.find(m => m.id === "2");

      // Text message should be unchanged
      expect((msg2?.content as any[])[0].type).toBe("text");
      expect((msg2?.content as any[])[0].text).toBe("Just text");
    });

    it("should handle string content messages gracefully", () => {
      const memory = new EkoMemory("system prompt", [
        { id: "1", role: "user", timestamp: Date.now(), content: "String content" },
        createImageMessage("2"),
        createImageMessage("3"),
      ]);

      // Should not throw
      expect(() => memory.filterOldScreenshots(1)).not.toThrow();

      const messages = memory.getMessages();
      const msg1 = messages.find(m => m.id === "1");
      expect(msg1?.content).toBe("String content");
    });
  });

  describe("Integration with manageCapacity", () => {
    it("should filter screenshots when maxRecentScreenshots is configured", async () => {
      const config: MemoryConfig = {
        maxRecentScreenshots: 2,
      };

      const memory = new EkoMemory("system prompt", [], config);

      // Add messages
      await memory.addMessages([
        createTextMessage("1"),
        createImageMessage("2"),
        createImageMessage("3"),
        createImageMessage("4"),
      ]);

      const messages = memory.getMessages();

      // First image should be replaced
      const msg2 = messages.find(m => m.id === "2");
      expect((msg2?.content as any[])[0].type).toBe("text");
      expect((msg2?.content as any[])[0].text).toBe("[screenshot]");

      // Last two images should be kept
      const msg3 = messages.find(m => m.id === "3");
      const msg4 = messages.find(m => m.id === "4");
      expect((msg3?.content as any[])[0].type).toBe("image");
      expect((msg4?.content as any[])[0].type).toBe("image");
    });

    it("should not filter when maxRecentScreenshots is 0 (disabled)", async () => {
      const config: MemoryConfig = {
        maxRecentScreenshots: 0,
      };

      const memory = new EkoMemory("system prompt", [], config);

      await memory.addMessages([
        createTextMessage("1"),
        createImageMessage("2"),
        createImageMessage("3"),
      ]);

      const messages = memory.getMessages();

      // All images should be kept
      const msg2 = messages.find(m => m.id === "2");
      const msg3 = messages.find(m => m.id === "3");
      expect((msg2?.content as any[])[0].type).toBe("image");
      expect((msg3?.content as any[])[0].type).toBe("image");
    });
  });
});
