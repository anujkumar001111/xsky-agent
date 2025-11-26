[← Back to README](https://github.com/humanlayer/12-factor-agents/blob/main/README.md)

### 3. Own your context window

You don't necessarily need to use standard message-based formats for conveying context to an LLM.

> #### At any given point, your input to an LLM in an agent is "here's what's happened so far, what's the next step"

<!-- todo syntax highlighting -->
<!-- ![130-own-your-context-building](https://github.com/humanlayer/12-factor-agents/blob/main/img/130-own-your-context-building.png) -->

Everything is context engineering. [LLMs are stateless functions](https://thedataexchange.media/baml-revolution-in-ai-engineering/) that turn inputs into outputs. To get the best outputs, you need to give them the best inputs.

Creating great context means:

- The prompt and instructions you give to the model
- Any documents or external data you retrieve (e.g. RAG)
- Any past state, tool calls, results, or other history 
- Any past messages or events from related but separate histories/conversations (Memory)
- Instructions about what sorts of structured data to output

![image](https://github.com/user-attachments/assets/0f1f193f-8e94-4044-a276-576bd7764fd0)


### on context engineering

This guide is all about getting as much as possible out of today's models. Notably not mentioned are:

- Changes to models parameters like temperature, top_p, frequency_penalty, presence_penalty, etc.
- Training your own completion or embedding models
- Fine-tuning existing models

Again, I don't know what's the best way to hand context to an LLM, but I know you want the flexibility to be able to try EVERYTHING.

#### Standard vs Custom Context Formats

Most LLM clients use a standard message-based format like this:

```yaml
[
  {
    "role": "system",
    "content": "You are a helpful assistant..."
  },
  {
    "role": "user",
    "content": "Can you deploy the backend?"
  },
  {
    "role": "assistant",
    "content": null,
    "tool_calls": [
      {
        "id": "1",
        "name": "list_git_tags",
        "arguments": "{}"
      }
    ]
  },
  {
    "role": "tool",
    "name": "list_git_tags",
    "content": "{\"tags\": [{\"name\": \"v1.2.3\", \"commit\": \"abc123\", \"date\": \"2024-03-15T10:00:00Z\"}, {\"name\": \"v1.2.2\", \"commit\": \"def456\", \"date\": \"2024-03-14T15:30:00Z\"}, {\"name\": \"v1.2.1\", \"commit\": \"abe033d\", \"date\": \"2024-03-13T09:15:00Z\"}]}",
    "tool_call_id": "1"
  }
]
```

While this works great for most use cases, if you want to really get THE MOST out of today's LLMs, you need to get your context into the LLM in the most token- and attention-efficient way you can.

As an alternative to the standard message-based format, you can build your own context format that's optimized for your use case. For example, you can use custom objects and pack/spread them into one or more user, system, assistant, or tool messages as makes sense.

Here's an example of putting the whole context window into a single user message:
```yaml

[
  {
    "role": "system",
    "content": "You are a helpful assistant..."
  },
  {
    "role": "user",
    "content": |
            Here's everything that happened so far:
        
        <slack_message>
            From: @alex
            Channel: #deployments
            Text: Can you deploy the backend?
        </slack_message>
        
        <list_git_tags>
            intent: "list_git_tags"
        </list_git_tags>
        
        <list_git_tags_result>
            tags:
              - name: "v1.2.3"
                commit: "abc123"
                date: "2024-03-15T10:00:00Z"
              - name: "v1.2.2"
                commit: "def456"
                date: "2024-03-14T15:30:00Z"
              - name: "v1.2.1"
                commit: "ghi789"
                date: "2024-03-13T09:15:00Z"
        </list_git_tags_result>
        
        what's the next step?
    }
]
```

The model may infer that you're asking it `what's the next step` by the tool schemas you supply, but it never hurts to roll it into your prompt template.

### code example

We can build this with something like: 

```python

class Thread:
  events: List[Event]

class Event:
  # could just use string, or could be explicit - up to you
  type: Literal["list_git_tags", "deploy_backend", "deploy_frontend", "request_more_information", "done_for_now", "list_git_tags_result", "deploy_backend_result", "deploy_frontend_result", "request_more_information_result", "done_for_now_result", "error"]
  data: ListGitTags | DeployBackend | DeployFrontend | RequestMoreInformation |  
        ListGitTagsResult | DeployBackendResult | DeployFrontendResult | RequestMoreInformationResult | string

def event_to_prompt(event: Event) -> str:
    data = event.data if isinstance(event.data, str) \
           else stringifyToYaml(event.data)

    return f"<{event.type}>\n{data}\n</{event.type}>"


def thread_to_prompt(thread: Thread) -> str:
  return '\n\n'.join(event_to_prompt(event) for event in thread.events)
```

#### Example Context Windows

Here's how context windows might look with this approach:

**Initial Slack Request:**
```xml
<slack_message>
    From: @alex
    Channel: #deployments
    Text: Can you deploy the latest backend to production?
</slack_message>
```

**After Listing Git Tags:**
```xml
<slack_message>
    From: @alex
    Channel: #deployments
    Text: Can you deploy the latest backend to production?
    Thread: []
</slack_message>

<list_git_tags>
    intent: "list_git_tags"
</list_git_tags>

<list_git_tags_result>
    tags:
      - name: "v1.2.3"
        commit: "abc123"
        date: "2024-03-15T10:00:00Z"
      - name: "v1.2.2"
        commit: "def456"
        date: "2024-03-14T15:30:00Z"
      - name: "v1.2.1"
        commit: "ghi789"
        date: "2024-03-13T09:15:00Z"
</list_git_tags_result>
```

**After Error and Recovery:**
```xml
<slack_message>
    From: @alex
    Channel: #deployments
    Text: Can you deploy the latest backend to production?
    Thread: []
</slack_message>

<deploy_backend>
    intent: "deploy_backend"
    tag: "v1.2.3"
    environment: "production"
</deploy_backend>

<error>
    error running deploy_backend: Failed to connect to deployment service
</error>

<request_more_information>
    intent: "request_more_information_from_human"
    question: "I had trouble connecting to the deployment service, can you provide more details and/or check on the status of the service?"
</request_more_information>

<human_response>
    data:
      response: "I'm not sure what's going on, can you check on the status of the latest workflow?"
</human_response>
```

From here your next step might be: 

```python
nextStep = await determine_next_step(thread_to_prompt(thread))
```

```python
{
  "intent": "get_workflow_status",
  "workflow_name": "tag_push_prod.yaml",
}
```

The XML-style format is just one example - the point is you can build your own format that makes sense for your application. You'll get better quality if you have the flexibility to experiment with different context structures and what you store vs. what you pass to the LLM. 

Key benefits of owning your context window:

1. **Information Density**: Structure information in ways that maximize the LLM's understanding
2. **Error Handling**: Include error information in a format that helps the LLM recover. Consider hiding errors and failed calls from context window once they are resolved.
3. **Safety**: Control what information gets passed to the LLM, filtering out sensitive data
4. **Flexibility**: Adapt the format as you learn what works best for your use case
5. **Token Efficiency**: Optimize context format for token efficiency and LLM understanding

Context includes: prompts, instructions, RAG documents, history, tool calls, memory


Remember: The context window is your primary interface with the LLM. Taking control of how you structure and present information can dramatically improve your agent's performance.

Example - information density - same message, fewer tokens:

![Loom Screenshot 2025-04-22 at 09 00 56](https://github.com/user-attachments/assets/5cf041c6-72da-4943-be8a-99c73162b12a)


### Don't take it from me

About 2 months after 12-factor agents was published, context engineering started to become a pretty popular term.

<a href="https://x.com/karpathy/status/1937902205765607626"><img width="378" alt="Screenshot 2025-06-25 at 4 11 45 PM" src="https://github.com/user-attachments/assets/97e6e667-c35f-4855-8233-af40f05d6bce" /></a> <a href="https://x.com/tobi/status/1935533422589399127"><img width="378" alt="Screenshot 2025-06-25 at 4 12 59 PM" src="https://github.com/user-attachments/assets/7e6f5738-0d38-4910-82d1-7f5785b82b99" /></a>

There's also a quite good [Context Engineering Cheat Sheet](https://x.com/lenadroid/status/1943685060785524824) from [@lenadroid](https://x.com/lenadroid) from July 2025.

<a href="https://x.com/lenadroid/status/1943685060785524824"><img width="256" alt="image" src="https://github.com/user-attachments/assets/cac88aa3-8faf-440b-9736-cab95a9de477" /></a>



Recurring theme here: I don't know what's the best approach, but I know you want the flexibility to be able to try EVERYTHING.


[← Own Your Prompts](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-02-own-your-prompts.md) | [Tools Are Structured Outputs →](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-04-tools-are-structured-outputs.md)


[← Back to README](https://github.com/humanlayer/12-factor-agents/blob/main/README.md)

### 4. Tools are just structured outputs

Tools don't need to be complex. At their core, they're just structured output from your LLM that triggers deterministic code.

![140-tools-are-just-structured-outputs](https://github.com/humanlayer/12-factor-agents/blob/main/img/140-tools-are-just-structured-outputs.png)

For example, lets say you have two tools `CreateIssue` and `SearchIssues`. To ask an LLM to "use one of several tools" is just to ask it to output JSON we can parse into an object representing those tools.

```python

class Issue:
  title: str
  description: str
  team_id: str
  assignee_id: str

class CreateIssue:
  intent: "create_issue"
  issue: Issue

class SearchIssues:
  intent: "search_issues"
  query: str
  what_youre_looking_for: str
```

The pattern is simple:
1. LLM outputs structured JSON
3. Deterministic code executes the appropriate action (like calling an external API)
4. Results are captured and fed back into the context

This creates a clean separation between the LLM's decision-making and your application's actions. The LLM decides what to do, but your code controls how it's done. Just because an LLM "called a tool" doesn't mean you have to go execute a specific corresponding function in the same way every time.

If you recall our switch statement from above

```python
if nextStep.intent == 'create_payment_link':
    stripe.paymentlinks.create(nextStep.parameters)
    return # or whatever you want, see below
elif nextStep.intent == 'wait_for_a_while': 
    # do something monadic idk
else: #... the model didn't call a tool we know about
    # do something else
```

**Note**: there has been a lot said about the benefits of "plain prompting" vs. "tool calling" vs. "JSON mode" and the performance tradeoffs of each. We'll link some resources to that stuff soon, but not gonna get into it here. See [Prompting vs JSON Mode vs Function Calling vs Constrained Generation vs SAP](https://www.boundaryml.com/blog/schema-aligned-parsing), [When should I use function calling, structured outputs, or JSON mode?](https://www.vellum.ai/blog/when-should-i-use-function-calling-structured-outputs-or-json-mode#:~:text=We%20don%27t%20recommend%20using%20JSON,always%20use%20Structured%20Outputs%20instead) and [OpenAI JSON vs Function Calling](https://docs.llamaindex.ai/en/stable/examples/llm/openai_json_vs_function_calling/).

The "next step" might not be as atomic as just "run a pure function and return the result". You unlock a lot of flexibility when you think of "tool calls" as just a model outputting JSON describing what deterministic code should do. Put this together with [factor 8 own your control flow](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-08-own-your-control-flow.md).

[← Own Your Context Window](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-03-own-your-context-window.md) | [Unify Execution State →](https: //github.com/humanlayer/12-factor-agents/blob/main/content/factor-05-unify-execution-state.md)
