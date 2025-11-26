[← Back to README](https://github.com/humanlayer/12-factor-agents/blob/main/README.md)

### 5. Unify execution state and business state

Even outside the AI world, many infrastructure systems try to separate "execution state" from "business state". For AI apps, this might involve complex abstractions to track things like current step, next step, waiting status, retry counts, etc. This separation creates complexity that may be worthwhile, but may be overkill for your use case. 

As always, it's up to you to decide what's right for your application. But don't think you *have* to manage them separately.

More clearly:

- **Execution state**: current step, next step, waiting status, retry counts, etc. 
- **Business state**: What's happened in the agent workflow so far (e.g. list of OpenAI messages, list of tool calls and results, etc.)

If possible, SIMPLIFY - unify these as much as possible. 

[![155-unify-state](https://github.com/humanlayer/12-factor-agents/blob/main/img/155-unify-state-animation.gif)](https://github.com/user-attachments/assets/e5a851db-f58f-43d8-8b0c-1926c99fc68d)


<details>
<summary><a href="https://github.com/humanlayer/12-factor-agents/blob/main/img/155-unify-state-animation.gif">GIF Version</a></summary>

![155-unify-state](https://github.com/humanlayer/12-factor-agents/blob/main/img/155-unify-state-animation.gif)

</details>

In reality, you can engineer your application so that you can infer all execution state from the context window. In many cases, execution state (current step, waiting status, etc.) is just metadata about what has happened so far.

You may have things that can't go in the context window, like session ids, password contexts, etc, but your goal should be to minimize those things. By embracing [factor 3](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-03-own-your-context-window.md) you can control what actually goes into the LLM 

This approach has several benefits:

1. **Simplicity**: One source of truth for all state
2. **Serialization**: The thread is trivially serializable/deserializable
3. **Debugging**: The entire history is visible in one place
4. **Flexibility**: Easy to add new state by just adding new event types
5. **Recovery**: Can resume from any point by just loading the thread
6. **Forking**: Can fork the thread at any point by copying some subset of the thread into a new context / state ID
7. **Human Interfaces and Observability**: Trivial to convert a thread into a human-readable markdown or a rich Web app UI

[← Tools Are Structured Outputs](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-04-tools-are-structured-outputs.md) | [Launch/Pause/Resume →](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-06-launch-pause-resume.md)

[← Back to README](https://github.com/humanlayer/12-factor-agents/blob/main/README.md)

### 6. Launch/Pause/Resume with simple APIs

Agents are just programs, and we have things we expect from how to launch, query, resume, and stop them.

[![pause-resume animation](https://github.com/humanlayer/12-factor-agents/blob/main/img/165-pause-resume-animation.gif)](https://github.com/user-attachments/assets/feb1a425-cb96-4009-a133-8bd29480f21f)

<details>
<summary><a href="https://github.com/humanlayer/12-factor-agents/blob/main/img/165-pause-resume-animation.gif">GIF Version</a></summary>

![pause-resume animation](https://github.com/humanlayer/12-factor-agents/blob/main/img/165-pause-resume-animation.gif)

</details>


It should be easy for users, apps, pipelines, and other agents to launch an agent with a simple API.

Agents and their orchestrating deterministic code should be able to pause an agent when a long-running operation is needed.

External triggers like webhooks should enable agents to resume from where they left off without deep integration with the agent orchestrator.

Closely related to [factor 5 - unify execution state and business state](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-05-unify-execution-state.md) and [factor 8 - own your control flow](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-08-own-your-control-flow.md), but can be implemented independently.



**Note** - often AI orchestrators will allow for pause and resume, but not between the moment of tool selection and tool execution. See also [factor 7 - contact humans with tool calls](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-07-contact-humans-with-tools.md) and [factor 11 - trigger from anywhere, meet users where they are](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-11-trigger-from-anywhere.md).

[← Unify Execution State](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-05-unify-execution-state.md) | [Contact Humans With Tools →](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-07-contact-humans-with-tools.md)
