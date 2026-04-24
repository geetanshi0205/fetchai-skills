# Fetch Skills

CLI installer for Fetch.ai developer skills across Cursor, Claude Code, Google Antigravity, and generic agent coding tools.

## What it does

`fetch-skills` installs curated Fetch.ai developer skills (protocol knowledge, agent patterns, best practices) into your project in the format expected by your AI coding tool. It detects available skills from the package, asks where to install, and writes files into the correct target locations with overwrite safety.

## Included skills

- `chat-protocol` — Protocol knowledge for building Fetch.ai uAgents that speak the official Chat Protocol (ChatMessage / ChatAcknowledgement / TextContent, session lifecycle, Agentverse manifest registration).

More skills will be added over time.

## Supported tools

- Cursor
- Claude Code
- Google Antigravity
- AGENTS.md / generic agent coding tools

## Quick start

From the root of any project you want to install skills into:

```bash
npx fetch-skills
```

The installer starts immediately. Pick the skills you want, pick your tool, and it writes the files.

## Global install

```bash
npm install -g fetch-skills
fetch-skills
```

## Install targets

| Tool | Path |
|------|------|
| Cursor | `.cursor/rules/<skill-name>.mdc` |
| Claude Code | `.claude/skills/<skill-name>/SKILL.md` |
| Google Antigravity | `.agent/skills/<skill-name>/SKILL.md` |
| Generic agents | `AGENTS.md` (appended section per skill) |

For Cursor, the installer converts `SKILL.md` into an `.mdc` rule with this frontmatter:

```
---
description: <skill-name> development skill
alwaysApply: false
---
```

followed by the full skill body.

## Adding more skills

1. Create a new folder at:

   ```
   skills/<skill-name>/SKILL.md
   ```

2. Write the skill content (the CLI preserves content as-is; for Cursor, it wraps it with `.mdc` frontmatter automatically).
3. Publish a new package version.

The CLI auto-discovers every folder under `skills/*/SKILL.md` — no code changes required when adding new skills.

## Local development

```bash
npm install
npm start
```

`npm start` runs the installer against the current directory (`process.cwd()`), just like `npx fetch-skills` would.

## Test package contents

```bash
npm run test:pack
```

This runs `npm pack --dry-run` and should show at least:

- `bin/install.js`
- `skills/chat-protocol/SKILL.md`
- `README.md`
- `LICENSE`

## Publishing

```bash
npm login
npm pack --dry-run
npm publish --access public
```

## Updating

```bash
npm version patch
npm publish
```

## Author

[Geetanshi Goel](https://github.com/geetanshi0205)

## License

MIT &copy; [Geetanshi Goel](https://github.com/geetanshi0205)
