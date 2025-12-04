/**
 * Tests for structured browser agent prompts
 * Verifies that browser agent prompts contain required XML-like sections
 * following Anthropic's Computer Use Demo patterns
 */

describe("Browser Agent Structured Prompts", () => {
  describe("BaseBrowserLabelsAgent", () => {
    // We test the prompt structure by importing and checking the description
    // Since the class is abstract, we check the prompt content directly

    const labelsPromptSections = [
      "<SYSTEM_CAPABILITY>",
      "</SYSTEM_CAPABILITY>",
      "<INTERACTION_RULES>",
      "</INTERACTION_RULES>",
      "<SCREENSHOT_GUIDANCE>",
      "</SCREENSHOT_GUIDANCE>",
      "<CONSTRAINTS>",
      "</CONSTRAINTS>",
      "<ERROR_HANDLING>",
      "</ERROR_HANDLING>",
      "<IMPORTANT>",
      "</IMPORTANT>",
    ];

    it("should contain all required structured sections", async () => {
      // Dynamic import to get the module
      const { BaseBrowserLabelsAgent } = await import(
        "../../src/agent/browser/browser_labels"
      );

      // Create a concrete implementation to access the description
      class TestLabelsAgent extends BaseBrowserLabelsAgent {
        screenshot(): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
          return Promise.resolve({ imageBase64: "", imageType: "image/jpeg" });
        }
        execute_script(): Promise<any> {
          return Promise.resolve();
        }
        navigate_to(): Promise<any> {
          return Promise.resolve();
        }
        go_back(): Promise<void> {
          return Promise.resolve();
        }
        get_current_page(): Promise<any> {
          return Promise.resolve();
        }
        get_all_tabs(): Promise<any> {
          return Promise.resolve();
        }
        switch_tab(): Promise<void> {
          return Promise.resolve();
        }
        extract_page_content(): Promise<any> {
          return Promise.resolve();
        }
      }

      const agent = new TestLabelsAgent();
      const description = agent.description;

      // Verify all required sections are present
      for (const section of labelsPromptSections) {
        expect(description).toContain(section);
      }
    });

    it("should have SYSTEM_CAPABILITY section describing agent capabilities", async () => {
      const { BaseBrowserLabelsAgent } = await import(
        "../../src/agent/browser/browser_labels"
      );

      class TestLabelsAgent extends BaseBrowserLabelsAgent {
        screenshot(): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
          return Promise.resolve({ imageBase64: "", imageType: "image/jpeg" });
        }
        execute_script(): Promise<any> {
          return Promise.resolve();
        }
        navigate_to(): Promise<any> {
          return Promise.resolve();
        }
        go_back(): Promise<void> {
          return Promise.resolve();
        }
        get_current_page(): Promise<any> {
          return Promise.resolve();
        }
        get_all_tabs(): Promise<any> {
          return Promise.resolve();
        }
        switch_tab(): Promise<void> {
          return Promise.resolve();
        }
        extract_page_content(): Promise<any> {
          return Promise.resolve();
        }
      }

      const agent = new TestLabelsAgent();
      const description = agent.description;

      // Extract SYSTEM_CAPABILITY section
      const capabilityMatch = description.match(
        /<SYSTEM_CAPABILITY>([\s\S]*?)<\/SYSTEM_CAPABILITY>/
      );
      expect(capabilityMatch).not.toBeNull();

      const capabilityContent = capabilityMatch![1];
      expect(capabilityContent).toContain("browser automation agent");
      expect(capabilityContent).toContain("labeled elements");
    });

    it("should have CONSTRAINTS section with behavioral limits", async () => {
      const { BaseBrowserLabelsAgent } = await import(
        "../../src/agent/browser/browser_labels"
      );

      class TestLabelsAgent extends BaseBrowserLabelsAgent {
        screenshot(): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
          return Promise.resolve({ imageBase64: "", imageType: "image/jpeg" });
        }
        execute_script(): Promise<any> {
          return Promise.resolve();
        }
        navigate_to(): Promise<any> {
          return Promise.resolve();
        }
        go_back(): Promise<void> {
          return Promise.resolve();
        }
        get_current_page(): Promise<any> {
          return Promise.resolve();
        }
        get_all_tabs(): Promise<any> {
          return Promise.resolve();
        }
        switch_tab(): Promise<void> {
          return Promise.resolve();
        }
        extract_page_content(): Promise<any> {
          return Promise.resolve();
        }
      }

      const agent = new TestLabelsAgent();
      const description = agent.description;

      // Extract CONSTRAINTS section
      const constraintsMatch = description.match(
        /<CONSTRAINTS>([\s\S]*?)<\/CONSTRAINTS>/
      );
      expect(constraintsMatch).not.toBeNull();

      const constraintsContent = constraintsMatch![1];
      expect(constraintsContent).toContain("Never click");
      expect(constraintsContent).toContain("visible");
    });

    it("should have IMPORTANT section with critical reminders", async () => {
      const { BaseBrowserLabelsAgent } = await import(
        "../../src/agent/browser/browser_labels"
      );

      class TestLabelsAgent extends BaseBrowserLabelsAgent {
        screenshot(): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
          return Promise.resolve({ imageBase64: "", imageType: "image/jpeg" });
        }
        execute_script(): Promise<any> {
          return Promise.resolve();
        }
        navigate_to(): Promise<any> {
          return Promise.resolve();
        }
        go_back(): Promise<void> {
          return Promise.resolve();
        }
        get_current_page(): Promise<any> {
          return Promise.resolve();
        }
        get_all_tabs(): Promise<any> {
          return Promise.resolve();
        }
        switch_tab(): Promise<void> {
          return Promise.resolve();
        }
        extract_page_content(): Promise<any> {
          return Promise.resolve();
        }
      }

      const agent = new TestLabelsAgent();
      const description = agent.description;

      // Extract IMPORTANT section
      const importantMatch = description.match(
        /<IMPORTANT>([\s\S]*?)<\/IMPORTANT>/
      );
      expect(importantMatch).not.toBeNull();

      const importantContent = importantMatch![1];
      expect(importantContent).toContain("Element indices reset");
    });
  });

  describe("BaseBrowserScreenAgent", () => {
    const screenPromptSections = [
      "<SYSTEM_CAPABILITY>",
      "</SYSTEM_CAPABILITY>",
      "<INTERACTION_RULES>",
      "</INTERACTION_RULES>",
      "<BROWSER_OPERATIONS>",
      "</BROWSER_OPERATIONS>",
      "<CONSTRAINTS>",
      "</CONSTRAINTS>",
      "<IMPORTANT>",
      "</IMPORTANT>",
    ];

    it("should contain all required structured sections", async () => {
      const { BaseBrowserScreenAgent } = await import(
        "../../src/agent/browser/browser_screen"
      );

      class TestScreenAgent extends BaseBrowserScreenAgent {
        screenshot(): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
          return Promise.resolve({ imageBase64: "", imageType: "image/jpeg" });
        }
        execute_script(): Promise<any> {
          return Promise.resolve();
        }
        navigate_to(): Promise<any> {
          return Promise.resolve();
        }
        go_back(): Promise<void> {
          return Promise.resolve();
        }
        get_current_page(): Promise<any> {
          return Promise.resolve();
        }
        get_all_tabs(): Promise<any> {
          return Promise.resolve();
        }
        switch_tab(): Promise<void> {
          return Promise.resolve();
        }
        extract_page_content(): Promise<any> {
          return Promise.resolve();
        }
        typing(): Promise<void> {
          return Promise.resolve();
        }
        click(): Promise<void> {
          return Promise.resolve();
        }
        scroll(): Promise<void> {
          return Promise.resolve();
        }
        move_to(): Promise<void> {
          return Promise.resolve();
        }
        press(): Promise<void> {
          return Promise.resolve();
        }
        drag_and_drop(): Promise<void> {
          return Promise.resolve();
        }
      }

      const agent = new TestScreenAgent();
      const description = agent.description;

      // Verify all required sections are present
      for (const section of screenPromptSections) {
        expect(description).toContain(section);
      }
    });

    it("should have SYSTEM_CAPABILITY section describing coordinate-based interaction", async () => {
      const { BaseBrowserScreenAgent } = await import(
        "../../src/agent/browser/browser_screen"
      );

      class TestScreenAgent extends BaseBrowserScreenAgent {
        screenshot(): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
          return Promise.resolve({ imageBase64: "", imageType: "image/jpeg" });
        }
        execute_script(): Promise<any> {
          return Promise.resolve();
        }
        navigate_to(): Promise<any> {
          return Promise.resolve();
        }
        go_back(): Promise<void> {
          return Promise.resolve();
        }
        get_current_page(): Promise<any> {
          return Promise.resolve();
        }
        get_all_tabs(): Promise<any> {
          return Promise.resolve();
        }
        switch_tab(): Promise<void> {
          return Promise.resolve();
        }
        extract_page_content(): Promise<any> {
          return Promise.resolve();
        }
        typing(): Promise<void> {
          return Promise.resolve();
        }
        click(): Promise<void> {
          return Promise.resolve();
        }
        scroll(): Promise<void> {
          return Promise.resolve();
        }
        move_to(): Promise<void> {
          return Promise.resolve();
        }
        press(): Promise<void> {
          return Promise.resolve();
        }
        drag_and_drop(): Promise<void> {
          return Promise.resolve();
        }
      }

      const agent = new TestScreenAgent();
      const description = agent.description;

      // Extract SYSTEM_CAPABILITY section
      const capabilityMatch = description.match(
        /<SYSTEM_CAPABILITY>([\s\S]*?)<\/SYSTEM_CAPABILITY>/
      );
      expect(capabilityMatch).not.toBeNull();

      const capabilityContent = capabilityMatch![1];
      expect(capabilityContent).toContain("browser automation agent");
      expect(capabilityContent).toContain("mouse and keyboard");
    });

    it("should have BROWSER_OPERATIONS section listing capabilities", async () => {
      const { BaseBrowserScreenAgent } = await import(
        "../../src/agent/browser/browser_screen"
      );

      class TestScreenAgent extends BaseBrowserScreenAgent {
        screenshot(): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
          return Promise.resolve({ imageBase64: "", imageType: "image/jpeg" });
        }
        execute_script(): Promise<any> {
          return Promise.resolve();
        }
        navigate_to(): Promise<any> {
          return Promise.resolve();
        }
        go_back(): Promise<void> {
          return Promise.resolve();
        }
        get_current_page(): Promise<any> {
          return Promise.resolve();
        }
        get_all_tabs(): Promise<any> {
          return Promise.resolve();
        }
        switch_tab(): Promise<void> {
          return Promise.resolve();
        }
        extract_page_content(): Promise<any> {
          return Promise.resolve();
        }
        typing(): Promise<void> {
          return Promise.resolve();
        }
        click(): Promise<void> {
          return Promise.resolve();
        }
        scroll(): Promise<void> {
          return Promise.resolve();
        }
        move_to(): Promise<void> {
          return Promise.resolve();
        }
        press(): Promise<void> {
          return Promise.resolve();
        }
        drag_and_drop(): Promise<void> {
          return Promise.resolve();
        }
      }

      const agent = new TestScreenAgent();
      const description = agent.description;

      // Extract BROWSER_OPERATIONS section
      const operationsMatch = description.match(
        /<BROWSER_OPERATIONS>([\s\S]*?)<\/BROWSER_OPERATIONS>/
      );
      expect(operationsMatch).not.toBeNull();

      const operationsContent = operationsMatch![1];
      expect(operationsContent).toContain("Navigate");
      expect(operationsContent).toContain("forms");
      expect(operationsContent).toContain("Click");
    });
  });
});
