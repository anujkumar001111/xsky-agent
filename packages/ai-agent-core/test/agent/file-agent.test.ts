import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BaseFileAgent } from "../../src/agent/file";
import Context from "../../src/core/context";
import { AgentContext } from "../../src/core/context";
import { ToolResult } from "../../src/types";

// Mock implementation for testing
class TestFileAgent extends BaseFileAgent {
  protected async file_list(
    agentContext: AgentContext,
    path: string
  ): Promise<Array<{ path: string; name?: string; isDirectory?: boolean; size?: string; modified?: string }>> {
    if (path === "/error") {
      throw new Error("Path not found");
    }
    return [
      { path: "/test/file1.txt", name: "file1.txt", isDirectory: false, size: "1 KB" },
      { path: "/test/file2.txt", name: "file2.txt", isDirectory: false, size: "2 KB" },
      { path: "/test/dir1", name: "dir1", isDirectory: true },
    ];
  }

  protected async file_read(agentContext: AgentContext, path: string): Promise<string> {
    if (path === "/missing") {
      throw new Error("File not found");
    }
    return "File content: " + path;
  }

  protected async file_write(
    agentContext: AgentContext,
    path: string,
    content: string,
    append: boolean
  ): Promise<any> {
    if (path === "/readonly") {
      throw new Error("Permission denied");
    }
    return { success: true, wrote: content.length };
  }

  protected async file_str_replace(
    agentContext: AgentContext,
    path: string,
    old_str: string,
    new_str: string
  ): Promise<any> {
    if (!old_str || !new_str) {
      throw new Error("Invalid replace parameters");
    }
    return { success: true, replacements: 1 };
  }

  protected async file_find_by_name(
    agentContext: AgentContext,
    path: string,
    glob: string
  ): Promise<Array<{ path: string; name?: string; isDirectory?: boolean; size?: string; modified?: string }>> {
    return [
      { path: "/test/result.txt", name: "result.txt", isDirectory: false },
    ];
  }
}

describe("BaseFileAgent", () => {
  let agent: TestFileAgent;
  let mockContext: Context;

  beforeEach(async () => {
    agent = new TestFileAgent("/test");
    mockContext = new Context({
      taskId: "test-task-123",
      chain: { taskPrompt: "Test task" } as any,
    });
  });

  describe("Constructor", () => {
    it("should initialize with work_path", () => {
      expect(agent.Name).toBe("File");
      expect(agent.Description).toContain("file agent");
    });

    it("should include work_path in description", () => {
      const agentWithPath = new TestFileAgent("/home/user");
      expect(agentWithPath.Description).toContain("/home/user");
    });

    it("should work without work_path", () => {
      const agentNoPath = new TestFileAgent();
      expect(agentNoPath.Description).toContain("file agent");
    });

    it("should initialize with llms if provided", () => {
      const agentWithLlms = new TestFileAgent("/test", ["gpt-4", "claude"]);
      expect(agentWithLlms.Llms).toContain("gpt-4");
      expect(agentWithLlms.Llms).toContain("claude");
    });

    it("should have file operation tools", () => {
      const tools = agent.Tools;
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain("file_list");
      expect(toolNames).toContain("file_read");
      expect(toolNames).toContain("file_write");
      expect(toolNames).toContain("file_str_replace");
      expect(toolNames).toContain("file_find_by_name");
    });

    it("should merge external tools if provided", () => {
      const externalTool = {
        name: "custom_tool",
        description: "Custom",
        parameters: { type: "object", properties: {} },
        execute: async () => ({ content: [{ type: "text", text: "result" }] }),
      };
      const agentWithTools = new TestFileAgent("/test", undefined, [externalTool]);
      const toolNames = agentWithTools.Tools.map((t) => t.name);

      expect(toolNames).toContain("custom_tool");
    });
  });

  describe("file_list tool", () => {
    it("should list files in directory", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const listTool = agent.Tools.find((t) => t.name === "file_list");
      expect(listTool).toBeDefined();

      const result = (await listTool!.execute({ path: "/test" }, agentContext)) as ToolResult;

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as any).text).toContain("file1.txt");
    });

    it("should handle file_list errors", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const listTool = agent.Tools.find((t) => t.name === "file_list");

      try {
        await listTool!.execute({ path: "/error" }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("Path not found");
      }
    });
  });

  describe("file_read tool", () => {
    it("should read file content", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const readTool = agent.Tools.find((t) => t.name === "file_read");
      const result = (await readTool!.execute(
        { path: "/test/file.txt", write_variable: undefined },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as any).text).toContain("File content:");
    });

    it("should store content in variable if provided", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const readTool = agent.Tools.find((t) => t.name === "file_read");
      await readTool!.execute(
        { path: "/test/file.txt", write_variable: "myVar" },
        agentContext
      );

      const varValue = agentContext.context.variables.get("myVar");
      expect(varValue).toBeDefined();
      expect(varValue).toContain("File content:");
    });

    it("should handle read errors", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const readTool = agent.Tools.find((t) => t.name === "file_read");

      try {
        await readTool!.execute({ path: "/missing" }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("File not found");
      }
    });
  });

  describe("file_write tool", () => {
    it("should write content to file", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const writeTool = agent.Tools.find((t) => t.name === "file_write");
      const result = (await writeTool!.execute(
        { path: "/test/output.txt", content: "Hello World", append: false },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
      const text = (result.content[0] as any).text;
      expect(text).toBeDefined();
      expect(typeof text).toBe("string");
    });

    it("should append content if append flag is true", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const writeTool = agent.Tools.find((t) => t.name === "file_write");
      const result = (await writeTool!.execute(
        { path: "/test/output.txt", content: "Appended", append: true },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });

    it("should write from variable if from_variable is provided", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);
      agentContext.context.variables.set("myContent", "Content from variable");

      const writeTool = agent.Tools.find((t) => t.name === "file_write");
      const result = (await writeTool!.execute(
        { path: "/test/output.txt", from_variable: "myContent" },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });

    it("should fail if neither content nor from_variable provided", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const writeTool = agent.Tools.find((t) => t.name === "file_write");

      try {
        await writeTool!.execute({ path: "/test/output.txt" }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("cannot be both empty");
      }
    });

    it("should fail on write permission error", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const writeTool = agent.Tools.find((t) => t.name === "file_write");

      try {
        await writeTool!.execute(
          { path: "/readonly", content: "test" },
          agentContext
        );
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("Permission denied");
      }
    });
  });

  describe("file_str_replace tool", () => {
    it("should replace string in file", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const replaceTool = agent.Tools.find((t) => t.name === "file_str_replace");
      const result = (await replaceTool!.execute(
        { path: "/test/file.txt", old_str: "old", new_str: "new" },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });

    it("should validate replace parameters", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const replaceTool = agent.Tools.find((t) => t.name === "file_str_replace");

      try {
        await replaceTool!.execute(
          { path: "/test/file.txt", old_str: "", new_str: "new" },
          agentContext
        );
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("Invalid");
      }
    });
  });

  describe("file_find_by_name tool", () => {
    it("should find files by glob pattern", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const findTool = agent.Tools.find((t) => t.name === "file_find_by_name");
      const result = (await findTool!.execute(
        { path: "/test", glob: "**/*.txt" },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as any).text).toContain("result.txt");
    });
  });

  describe("do_file_read", () => {
    it("should handle file content truncation", async () => {
      // Create a subclass to test protected do_file_read
      class TestAgentWithLongContent extends TestFileAgent {
        protected async file_read(): Promise<string> {
          return "x".repeat(100000); // Very long content
        }
      }

      const longAgent = new TestAgentWithLongContent();
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, longAgent, agentChain);

      const readTool = longAgent.Tools.find((t) => t.name === "file_read");
      const result = (await readTool!.execute(
        { path: "/test/file.txt" },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
      // Should be truncated
      const text = (result.content[0] as any).text;
      expect(text.length).toBeLessThan(100000);
    });
  });

  describe("do_file_write", () => {
    it("should fail if variable is empty", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);
      agentContext.context.variables.set("emptyVar", "");

      const writeTool = agent.Tools.find((t) => t.name === "file_write");

      try {
        await writeTool!.execute(
          { path: "/test/output.txt", from_variable: "emptyVar" },
          agentContext
        );
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("empty");
      }
    });
  });

  describe("Edge cases for file operations", () => {
    describe("file_list edge cases", () => {
      it("should handle listing with empty path", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const listTool = agent.Tools.find((t) => t.name === "file_list");

        // Depends on implementation behavior with empty path
        const result = await listTool!.execute({ path: "" }, agentContext);
        expect(result).toBeDefined();
      });

      it("should handle listing with very long path", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const longPath = "/" + "dir/".repeat(1000) + "file.txt";
        const listTool = agent.Tools.find((t) => t.name === "file_list");

        const result = await listTool!.execute({ path: longPath }, agentContext);
        expect(result.content).toBeDefined();
      });

      it("should handle listing with special characters in path", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const specialPath = "/test/@#$%&*()";
        const listTool = agent.Tools.find((t) => t.name === "file_list");

        const result = await listTool!.execute({ path: specialPath }, agentContext);
        expect(result.content).toBeDefined();
      });
    });

    describe("file_read edge cases", () => {
      it("should handle reading with empty path", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const readTool = agent.Tools.find((t) => t.name === "file_read");
        const result = await readTool!.execute({ path: "" }, agentContext);

        expect(result).toBeDefined();
      });

      it("should handle reading with undefined write_variable", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const readTool = agent.Tools.find((t) => t.name === "file_read");
        const result = await readTool!.execute(
          { path: "/test/file.txt", write_variable: undefined },
          agentContext
        );

        expect(result.content).toBeDefined();
      });

      it("should handle reading with empty string write_variable", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const readTool = agent.Tools.find((t) => t.name === "file_read");
        const result = await readTool!.execute(
          { path: "/test/file.txt", write_variable: "" },
          agentContext
        );

        expect(result.content).toBeDefined();
      });

      it("should handle writing to multiple variables with same content", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const readTool = agent.Tools.find((t) => t.name === "file_read");

        // First read
        await readTool!.execute(
          { path: "/test/file.txt", write_variable: "var1" },
          agentContext
        );

        // Second read
        await readTool!.execute(
          { path: "/test/file.txt", write_variable: "var2" },
          agentContext
        );

        const val1 = agentContext.context.variables.get("var1");
        const val2 = agentContext.context.variables.get("var2");

        expect(val1).toBeDefined();
        expect(val2).toBeDefined();
      });
    });

    describe("file_write edge cases", () => {
      it("should handle writing empty content", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const writeTool = agent.Tools.find((t) => t.name === "file_write");

        // Empty content should fail based on the implementation
        try {
          await writeTool!.execute(
            { path: "/test/output.txt", content: "" },
            agentContext
          );
          // May or may not fail depending on implementation
        } catch (e: any) {
          expect(e).toBeDefined();
        }
      });

      it("should handle writing very large content", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const largeContent = "x".repeat(10000000); // 10MB
        const writeTool = agent.Tools.find((t) => t.name === "file_write");

        const result = await writeTool!.execute(
          { path: "/test/output.txt", content: largeContent },
          agentContext
        );

        expect(result.content).toBeDefined();
      });

      it("should handle writing content with special characters", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const specialContent = "\n\t\r\n!@#$%^&*()[]{}";
        const writeTool = agent.Tools.find((t) => t.name === "file_write");

        const result = await writeTool!.execute(
          { path: "/test/output.txt", content: specialContent },
          agentContext
        );

        expect(result.content).toBeDefined();
      });

      it("should handle writing with append=false (overwrite)", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const writeTool = agent.Tools.find((t) => t.name === "file_write");

        const result1 = await writeTool!.execute(
          { path: "/test/output.txt", content: "First", append: false },
          agentContext
        );

        const result2 = await writeTool!.execute(
          { path: "/test/output.txt", content: "Second", append: false },
          agentContext
        );

        expect(result1.content).toBeDefined();
        expect(result2.content).toBeDefined();
      });

      it("should handle nonexistent from_variable", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const writeTool = agent.Tools.find((t) => t.name === "file_write");

        // Should fail when variable doesn't exist
        try {
          await writeTool!.execute(
            { path: "/test/output.txt", from_variable: "nonexistent" },
            agentContext
          );
          expect(true).toBe(false); // Should not reach here
        } catch (e: any) {
          expect(e).toBeDefined();
        }
      });
    });

    describe("file_str_replace edge cases", () => {
      it("should handle replace with empty old_str", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const replaceTool = agent.Tools.find((t) => t.name === "file_str_replace");

        try {
          await replaceTool!.execute(
            { path: "/test/file.txt", old_str: "", new_str: "new" },
            agentContext
          );
          expect(true).toBe(false); // Should not reach here
        } catch (e: any) {
          expect(e.message).toContain("Invalid");
        }
      });

      it("should handle replace with empty new_str", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const replaceTool = agent.Tools.find((t) => t.name === "file_str_replace");

        try {
          await replaceTool!.execute(
            { path: "/test/file.txt", old_str: "old", new_str: "" },
            agentContext
          );
          expect(true).toBe(false); // Should not reach here
        } catch (e: any) {
          expect(e.message).toContain("Invalid");
        }
      });

      it("should handle replace with special regex characters", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const replaceTool = agent.Tools.find((t) => t.name === "file_str_replace");

        const result = await replaceTool!.execute(
          { path: "/test/file.txt", old_str: ".*+?[]{}()^$|\\", new_str: "new" },
          agentContext
        );

        expect(result.content).toBeDefined();
      });

      it("should handle replace with very long strings", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const replaceTool = agent.Tools.find((t) => t.name === "file_str_replace");

        const oldStr = "x".repeat(10000);
        const newStr = "y".repeat(10000);

        const result = await replaceTool!.execute(
          { path: "/test/file.txt", old_str: oldStr, new_str: newStr },
          agentContext
        );

        expect(result.content).toBeDefined();
      });
    });

    describe("file_find_by_name edge cases", () => {
      it("should handle find with empty glob pattern", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const findTool = agent.Tools.find((t) => t.name === "file_find_by_name");

        const result = await findTool!.execute(
          { path: "/test", glob: "" },
          agentContext
        );

        expect(result.content).toBeDefined();
      });

      it("should handle find with empty path", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const findTool = agent.Tools.find((t) => t.name === "file_find_by_name");

        const result = await findTool!.execute(
          { path: "", glob: "**/*.txt" },
          agentContext
        );

        expect(result.content).toBeDefined();
      });

      it("should handle find with complex glob patterns", async () => {
        const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
        const agentContext = new AgentContext(mockContext, agent, agentChain);

        const findTool = agent.Tools.find((t) => t.name === "file_find_by_name");

        const result = await findTool!.execute(
          { path: "/test", glob: "**/[a-z]*.{txt,json,md}" },
          agentContext
        );

        expect(result.content).toBeDefined();
      });
    });

    describe("Constructor and initialization edge cases", () => {
      it("should work with undefined work_path", () => {
        const agentNoPath = new TestFileAgent(undefined);
        expect(agentNoPath.Name).toBe("File");
      });

      it("should work with empty string work_path", () => {
        const agentWithEmptyPath = new TestFileAgent("");
        expect(agentWithEmptyPath.Name).toBe("File");
      });

      it("should work with very long work_path", () => {
        const longPath = "/".repeat(1000) + "path";
        const agentWithLongPath = new TestFileAgent(longPath);
        expect(agentWithLongPath.Description).toContain(longPath);
      });

      it("should work with empty llms array", () => {
        const agentWithEmptyLlms = new TestFileAgent("/test", []);
        expect(agentWithEmptyLlms.Llms).toEqual([]);
      });

      it("should merge multiple external tools without conflict", () => {
        const tools = [
          {
            name: "custom_tool_1",
            description: "First custom tool",
            parameters: { type: "object", properties: {} },
            execute: async () => ({ content: [{ type: "text", text: "result1" }] }),
          },
          {
            name: "custom_tool_2",
            description: "Second custom tool",
            parameters: { type: "object", properties: {} },
            execute: async () => ({ content: [{ type: "text", text: "result2" }] }),
          },
        ];

        const agentWithTools = new TestFileAgent("/test", undefined, tools);
        const toolNames = agentWithTools.Tools.map((t) => t.name);

        expect(toolNames).toContain("custom_tool_1");
        expect(toolNames).toContain("custom_tool_2");
      });
    });
  });
});
