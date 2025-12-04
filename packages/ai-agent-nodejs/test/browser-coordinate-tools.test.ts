import { BrowserAgent } from "../src/browser";
import { config } from "@xsky/ai-agent-core";

describe("BrowserAgent Coordinate Tools", () => {
  beforeEach(() => {
    config.enableCoordinateTools = true;
  });

  afterEach(() => {
    config.enableCoordinateTools = true; // Reset to default
  });

  test("coordinate tools are registered when enabled", () => {
    const agent = new BrowserAgent();
    const toolNames = agent.Tools.map((t: any) => t.name);
    expect(toolNames).toContain("click_at_coordinates");
    expect(toolNames).toContain("hover_at_coordinates");
    expect(toolNames).toContain("drag_to_coordinates");
    expect(toolNames).toContain("scroll_at_coordinates");
    expect(toolNames).toContain("type_at_coordinates");
  });

  test("coordinate tools are NOT registered when disabled", () => {
    config.enableCoordinateTools = false;
    const agent = new BrowserAgent();
    const toolNames = agent.Tools.map((t: any) => t.name);
    expect(toolNames).not.toContain("click_at_coordinates");
  });
});
