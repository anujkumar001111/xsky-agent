[← Back to README](https://github.com/humanlayer/12-factor-agents/blob/main/README.md)

### 7. Contact humans with tool calls

By default, LLM APIs rely on a fundamental HIGH-STAKES token choice: Are we returning plaintext content, or are we returning structured data?

![170-contact-humans-with-tools](https://github.com/humanlayer/12-factor-agents/blob/main/img/170-contact-humans-with-tools.png)

You're putting a lot of weight on that choice of first token, which, in the `the weather in tokyo` case, is

> "the"

but in the `fetch_weather` case, it's some special token to denote the start of a JSON object.

> |JSON>

You might get better results by having the LLM *always* output json, and then declare it's intent with some natural language tokens like `request_human_input` or `done_for_now` (as opposed to a "proper" tool like `check_weather_in_city`). 

Again, you might not get any performance boost from this, but you should experiment, and ensure you're free to try weird stuff to get the best results.

```python

class Options:
  urgency: Literal["low", "medium", "high"]
  format: Literal["free_text", "yes_no", "multiple_choice"]
  choices: List[str]

# Tool definition for human interaction
class RequestHumanInput:
  intent: "request_human_input"
  question: str
  context: str
  options: Options

# Example usage in the agent loop
if nextStep.intent == 'request_human_input':
  thread.events.append({
    type: 'human_input_requested',
    data: nextStep
  })
  thread_id = await save_state(thread)
  await notify_human(nextStep, thread_id)
  return # Break loop and wait for response to come back with thread ID
else:
  # ... other cases
```

Later, you might receive a webhook from a system that handles slack, email, sms, or other events.

```python

@app.post('/webhook')
def webhook(req: Request):
  thread_id = req.body.threadId
  thread = await load_state(thread_id)
  thread.events.push({
    type: 'response_from_human',
    data: req.body
  })
  # ... simplified for brevity, you likely don't want to block the web worker here
  next_step = await determine_next_step(thread_to_prompt(thread))
  thread.events.append(next_step)
  result = await handle_next_step(thread, next_step)
  # todo - loop or break or whatever you want

  return {"status": "ok"}
```

The above includes patterns from [factor 5 - unify execution state and business state](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-05-unify-execution-state.md), [factor 8 - own your control flow](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-08-own-your-control-flow.md), [factor 3 - own your context window](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-03-own-your-context-window.md), and [factor 4 - tools are just structured outputs](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-04-tools-are-structured-outputs.md), and several others.

If we were using the XML-y formatted from [factor 3 - own your context window](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-03-own-your-context-window.md), our context window after a few turns might look like this:

```xml

(snipped for brevity)

<slack_message>
    From: @alex
    Channel: #deployments
    Text: Can you deploy backend v1.2.3 to production?
    Thread: []
</slack_message>

<request_human_input>
    intent: "request_human_input"
    question: "Would you like to proceed with deploying v1.2.3 to production?"
    context: "This is a production deployment that will affect live users."
    options: {
        urgency: "high"
        format: "yes_no"
    }
</request_human_input>

<human_response>
    response: "yes please proceed"
    approved: true
    timestamp: "2024-03-15T10:30:00Z"
    user: "alex@company.com"
</human_response>

<deploy_backend>
    intent: "deploy_backend"
    tag: "v1.2.3"
    environment: "production"
</deploy_backend>

<deploy_backend_result>
    status: "success"
    message: "Deployment v1.2.3 to production completed successfully."
    timestamp: "2024-03-15T10:30:00Z"
</deploy_backend_result>
```


Benefits:

1. **Clear Instructions**: Tools for different types of human contact allow for more specificity from the LLM
2. **Inner vs Outer Loop**: Enables agents workflows **outside** of the traditional chatGPT-style interface, where the control flow and context initialization may be `Agent->Human` rather than `Human->Agent` (think, agents kicked off by a cron or an event)
3. **Multiple Human Access**: Can easily track and coordinate input from different humans through structured events
4. **Multi-Agent**: Simple abstraction can be easily extended to support `Agent->Agent` requests and responses
5. **Durable**: Combined with [factor 6 - launch/pause/resume with simple APIs](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-06-launch-pause-resume.md), this makes for durable, reliable, and introspectable multiplayer workflows

[More on Outer Loop Agents over here](https://theouterloop.substack.com/p/openais-realtime-api-is-a-step-towards)

![175-outer-loop-agents](https://github.com/humanlayer/12-factor-agents/blob/main/img/175-outer-loop-agents.png)

Works great with [factor 11 - trigger from anywhere, meet users where they are](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-11-trigger-from-anywhere.md)

[← Launch/Pause/Resume](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-06-launch-pause-resume.md) | [Own Your Control Flow →](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-08-own-your-control-flow.md)

[← Back to README](https://github.com/humanlayer/12-factor-agents/blob/main/README.md)

### 8. Own your control flow

If you own your control flow, you can do lots of fun things.

![180-control-flow](https://github.com/humanlayer/12-factor-agents/blob/main/img/180-control-flow.png)


Build your own control structures that make sense for your specific use case. Specifically, certain types of tool calls may be reason to break out of the loop and wait for a response from a human or another long-running task like a training pipeline. You may also want to incorporate custom implementation of:

- summarization or caching of tool call results
- LLM-as-judge on structured output
- context window compaction or other [memory management](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-03-own-your-context-window.md)
- logging, tracing, and metrics
- client-side rate limiting
- durable sleep / pause / "wait for event"


The below example shows three possible control flow patterns:


- request_clarification: model asked for more info, break the loop and wait for a response from a human
- fetch_git_tags: model asked for a list of git tags, fetch the tags, append to context window, and pass straight back to the model
- deploy_backend: model asked to deploy a backend, this is a high-stakes thing, so break the loop and wait for human approval

```python
def handle_next_step(thread: Thread):

  while True:
    next_step = await determine_next_step(thread_to_prompt(thread))
    
    # inlined for clarity - in reality you could put 
    # this in a method, use exceptions for control flow, or whatever you want
    if next_step.intent == 'request_clarification':
      thread.events.append({
        type: 'request_clarification',
          data: nextStep,
        })

      await send_message_to_human(next_step)
      await db.save_thread(thread)
      # async step - break the loop, we'll get a webhook later
      break
    elif next_step.intent == 'fetch_open_issues':
      thread.events.append({
        type: 'fetch_open_issues',
        data: next_step,
      })

      issues = await linear_client.issues()

      thread.events.append({
        type: 'fetch_open_issues_result',
        data: issues,
      })
      # sync step - pass the new context to the LLM to determine the NEXT next step
      continue
    elif next_step.intent == 'create_issue':
      thread.events.append({
        type: 'create_issue',
        data: next_step,
      })

      await request_human_approval(next_step)
      await db.save_thread(thread)
      # async step - break the loop, we'll get a webhook later
      break
```

This pattern allows you to interrupt and resume your agent's flow as needed, creating more natural conversations and workflows.

**Example** - the number one feature request I have for every AI framework out there is we need to be able to interrupt 
a working agent and resume later, ESPECIALLY between the moment of tool **selection** and the moment of tool **invocation**.

Without this level of resumability/granularity, there's no way to review/approve the tool call before it runs, which means
you're forced to either:

1. Pause the task in memory while waiting for the long-running thing to complete (think `while...sleep`) and restart it from the beginning if the process is interrupted
2. Restrict the agent to only low-stakes, low-risk calls like research and summarization
3. Give the agent access to do bigger, more useful things, and just yolo hope it doesn't screw up


You may notice this is closely related to [factor 5 - unify execution state and business state](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-05-unify-execution-state.md) and [factor 6 - launch/pause/resume with simple APIs](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-06-launch-pause-resume.md), but can be implemented independently.

[← Contact Humans With Tools](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-07-contact-humans-with-tools.md) | [Compact Errors →](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-09-compact-errors.md)

