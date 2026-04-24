---
name: uagent-chat-protocol
description: Protocol knowledge for building Fetch.ai uAgents that speak the official Chat Protocol. Use when wrapping existing agent code, adding chat capability to a function, or creating a new chat-capable agent from a prompt. Covers ChatMessage/ChatAcknowledgement handling, TextContent structure, session lifecycle, and Agentverse manifest registration.
---

# uAgent Chat Protocol (Fetch.ai)

## Purpose
Give the coding agent enough protocol knowledge to wrap **any** function, existing uAgent, or new flow with a compliant Chat Protocol layer.

## When to Use
- Wrapping an existing function/agent so it speaks Chat Protocol
- Adding chat handlers to an existing uAgent
- Creating a new chat-capable uAgent from a prompt
- Any task referencing `ChatMessage`, `ChatAcknowledgement`, `chat_protocol_spec`, or Agentverse chat

## When NOT to Use
- Mock/pseudo implementations
- Non-uAgents frameworks
- Tasks where protocol compliance is not required

---

## Required Imports

```python
import os
from datetime import datetime
from uuid import uuid4
from uagents import Agent, Protocol, Context
from uagents.setup import fund_agent_if_low
from uagents_core.contrib.protocols.chat import (
    ChatMessage, ChatAcknowledgement, TextContent,
    StartSessionContent, EndSessionContent, chat_protocol_spec,
)

# If the agent reads any env var (seed, API keys, etc.), also:
from dotenv import load_dotenv
load_dotenv()
```

> See **Environment Variables** below for the full pattern + `.env.example` generation.

---

## The 8 Mandatory Blocks

Any agent using Chat Protocol must contain these, in this order:

### 1. Agent init (mailbox + Agentverse + testnet)
```python
agent = Agent(
    name=..., port=..., seed=...,
    mailbox=True,
    agentverse="https://agentverse.ai",
    network="testnet",
)
```
Optional: `fund_agent_if_low(agent.wallet.address())` on testnet.

### 2. Protocol init
```python
chat_proto = Protocol(spec=chat_protocol_spec)
```

### 3. `create_text_chat` helper
Wraps plain text into a valid `ChatMessage`.
```python
def create_text_chat(text: str) -> ChatMessage:
    return ChatMessage(
        timestamp=datetime.utcnow(),
        msg_id=uuid4(),
        content=[TextContent(type="text", text=text)],
    )
```

### 4. `ChatMessage` handler (core logic)
Must log sender → **ACK first** → iterate `msg.content` → branch per content type.
```python
@chat_proto.on_message(ChatMessage)
async def handle_chat_message(ctx: Context, sender: str, msg: ChatMessage):
    ctx.logger.info(f"ChatMessage from {sender}")
    await ctx.send(sender, ChatAcknowledgement(
        timestamp=datetime.utcnow(),
        acknowledged_msg_id=msg.msg_id,
    ))
    for item in msg.content:
        if isinstance(item, StartSessionContent):
            ctx.logger.info("Session started")
        elif isinstance(item, TextContent):
            # ← plug existing logic here (function call, LLM, API, etc.)
            response = your_logic(item.text)
            await ctx.send(sender, create_text_chat(response))
        elif isinstance(item, EndSessionContent):
            ctx.logger.info("Session ended")
        else:
            ctx.logger.warning(f"Unknown content: {type(item).__name__}")
```

### 5. `ChatAcknowledgement` handler
```python
@chat_proto.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    ctx.logger.info(f"ACK from {sender} for {msg.acknowledged_msg_id}")
```

### 6. Protocol registration
```python
agent.include(chat_proto, publish_manifest=True)
```
`publish_manifest=True` is what makes the agent discoverable on Agentverse.

### 7. Entrypoint
```python
if __name__ == "__main__":
    agent.run()
```

---

## Wrapping Patterns

**Wrap an existing function** → call it inside the `TextContent` branch, wrap return value via `create_text_chat`.

**Wrap an existing uAgent** → add `chat_proto`, add both handlers, call `agent.include(chat_proto, publish_manifest=True)`. Leave existing protocols intact.

**Create from scratch** → emit all 8 blocks in order.

---

## Hard Rules

- ACK every `ChatMessage` **before** any processing
- `datetime.utcnow()` only — never `datetime.now()`
- Fresh `uuid4()` per message
- `msg.content` is a **list** — always iterate
- All response text goes through `TextContent` (via `create_text_chat`)
- `publish_manifest=True` is mandatory
- Unknown content types → log warning, continue (never crash)

## Forbidden

- Sending raw strings via `ctx.send`
- Skipping the acknowledgement
- Reusing `msg_id` values
- Indexing `msg.content[0]` instead of iterating
- Omitting `publish_manifest=True`
- Omitting the `ChatAcknowledgement` handler
- Mock/fake protocols — always use `chat_protocol_spec`

---

## Message Shapes (reference)

**ChatMessage**
```
timestamp: datetime (UTC)
msg_id: UUID4
content: list[TextContent | StartSessionContent | EndSessionContent]
```

**ChatAcknowledgement**
```
timestamp: datetime (UTC)
acknowledged_msg_id: UUID4
```

## Flow

1. Peer sends `ChatMessage` → agent
2. Agent sends `ChatAcknowledgement` back immediately
3. Agent processes each item in `msg.content`
4. Agent sends response `ChatMessage`
5. Peer sends `ChatAcknowledgement` back

---

## Environment Variables

Whenever the agent reads **any** value from `os.getenv(...)` (seed, API keys, ports, URLs, etc.), load a `.env` file at the top of `agent.py` so the user can just fill in `.env` and run.

### Import pattern (put at the top of `agent.py`, right after `os`)

```python
import os
from dotenv import load_dotenv

load_dotenv()  # reads .env into os.environ
```

### Dependency
- Add `python-dotenv` to the dependency file **only if** the agent reads env vars.
- If the agent has no env vars at all, skip `python-dotenv` entirely.

### Generate `.env.example`
Whenever `load_dotenv()` is used, also create a `.env.example` in the project root listing every env var the agent reads, with placeholder values and short comments:

```
# Agent identity (required)
AGENT_SEED=your_unique_seed_phrase_here

# API keys for handler logic (only include the ones the agent actually uses)
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# Optional overrides
# AGENT_PORT=8000
```

Rules:
- `.env.example` lists **only** the vars the agent actually reads — don't pad it.
- Never create a real `.env` file; only `.env.example`.
- If `.gitignore` exists, ensure `.env` is in it (append the line if missing). If `.gitignore` doesn't exist, skip it — don't create one.

### README install step update
When `.env.example` is generated, the README install section becomes:

```bash
pip install -r requirements.txt
cp .env.example .env          # then fill in your values
python agent.py
```

---

## File Output Conventions (lower priority, but do this)

After writing the agent code, also handle these — keep it minimal, no extra scaffolding.

### Agent file name
- Default to **`agent.py`**.
- If `agent.py` already exists and is a different agent, pick a non-colliding name (`chat_agent.py`, `<purpose>_agent.py`). Never overwrite an unrelated file.

### Dependency file (detect what's there, don't create a second one)
Look in the project root for an existing manifest, in this priority order:

1. `pyproject.toml` → add `uagents` under `[project].dependencies` (or `[tool.poetry.dependencies]` for Poetry projects)
2. `requirements.txt` → append `uagents` if missing
3. `Pipfile` → add `uagents` under `[packages]`
4. `setup.py` / `setup.cfg` → add to `install_requires`

If **none** exist, create a simple `requirements.txt`:
```
uagents
```

Add `python-dotenv` alongside `uagents` if the agent uses `load_dotenv()`. Add any other library only if the handler actually uses it (e.g. `openai` when the handler calls OpenAI). Do not pin versions unless the project already pins others.

### README
Create or append to `README.md` — keep it to three sections only:

```markdown
# <Agent Name>

<One-line description of what the agent does.>

## Installation

```bash
pip install -r requirements.txt   # or: poetry install / pipenv install
cp .env.example .env              # then fill in your values (only if .env.example exists)
python agent.py
```
```

If the agent doesn't use env vars, drop the `cp .env.example .env` line.

No badges, no architecture diagrams, no contribution guide, no license section unless asked.

### Rules
- Never overwrite an existing `README.md` — append a section for this agent instead.
- Never duplicate a dependency that's already declared.
- Never introduce new config files (Docker, CI, lint configs) unless the user asked.

---

## Summary

Use `chat_protocol_spec` + `Protocol` + two handlers + the helper. ACK first, iterate content, wrap text in `TextContent`, publish the manifest. Anything else — existing functions, LLMs, tool calls, custom flows — plugs into the `TextContent` branch. If the agent reads any env var, call `load_dotenv()` at the top and ship a `.env.example`. Then add `uagents` (plus `python-dotenv` if used) to whatever dependency file already exists (or create `requirements.txt`), and write a minimal README with title + description + install steps.