#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import chalk from "chalk";
import { checkbox, select, confirm } from "@inquirer/prompts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(PACKAGE_ROOT, "skills");
const TARGET_ROOT = process.cwd();

const TARGETS = {
  cursor: "Cursor",
  claude: "Claude Code",
  antigravity: "Google Antigravity",
  agents: "AGENTS.md / generic agent tools",
  all: "All supported tools",
};

const summary = {
  installed: [],
  skipped: [],
  failed: [],
};

async function getAvailableSkills() {
  if (!(await fs.pathExists(SKILLS_DIR))) return [];
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(SKILLS_DIR, entry.name, "SKILL.md");
    if (await fs.pathExists(skillFile)) {
      skills.push({ name: entry.name, path: skillFile });
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function promptForSkills(available) {
  if (available.length === 1) {
    console.log(
      chalk.dim(`Only one skill available: ${chalk.cyan(available[0].name)} — selecting automatically.`)
    );
    return [available[0]];
  }
  const choices = available.map((s) => ({ name: s.name, value: s }));
  const selected = await checkbox({
    message: "Which skills do you want to install?",
    choices,
    required: true,
  });
  return selected;
}

async function promptForTargetTool() {
  const target = await select({
    message: "Where should the skills be installed?",
    choices: [
      { name: TARGETS.cursor, value: "cursor" },
      { name: TARGETS.claude, value: "claude" },
      { name: TARGETS.antigravity, value: "antigravity" },
      { name: TARGETS.agents, value: "agents" },
      { name: TARGETS.all, value: "all" },
    ],
  });
  return target;
}

async function writeFileWithConfirmation(destPath, contents, { label } = {}) {
  const displayPath = path.relative(TARGET_ROOT, destPath) || destPath;
  try {
    if (await fs.pathExists(destPath)) {
      const overwrite = await confirm({
        message: `${displayPath} already exists. Overwrite?`,
        default: false,
      });
      if (!overwrite) {
        console.log(chalk.yellow(`  ~ skipped  ${displayPath}`));
        summary.skipped.push(label || displayPath);
        return false;
      }
    }
    await fs.ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, contents, "utf8");
    console.log(chalk.green(`  + wrote    ${displayPath}`));
    summary.installed.push(label || displayPath);
    return true;
  } catch (err) {
    console.log(chalk.red(`  x failed   ${displayPath} — ${err.message}`));
    summary.failed.push(`${label || displayPath} (${err.message})`);
    return false;
  }
}

async function copySkillToFolder(skill, destFile, { label } = {}) {
  const displayPath = path.relative(TARGET_ROOT, destFile) || destFile;
  try {
    if (await fs.pathExists(destFile)) {
      const overwrite = await confirm({
        message: `${displayPath} already exists. Overwrite?`,
        default: false,
      });
      if (!overwrite) {
        console.log(chalk.yellow(`  ~ skipped  ${displayPath}`));
        summary.skipped.push(label || displayPath);
        return false;
      }
    }
    await fs.ensureDir(path.dirname(destFile));
    await fs.copy(skill.path, destFile, { overwrite: true });
    console.log(chalk.green(`  + wrote    ${displayPath}`));
    summary.installed.push(label || displayPath);
    return true;
  } catch (err) {
    console.log(chalk.red(`  x failed   ${displayPath} — ${err.message}`));
    summary.failed.push(`${label || displayPath} (${err.message})`);
    return false;
  }
}

async function installClaude(skill) {
  const dest = path.join(TARGET_ROOT, ".claude", "skills", skill.name, "SKILL.md");
  await copySkillToFolder(skill, dest, { label: `Claude Code: ${skill.name}` });
}

async function installAntigravity(skill) {
  const dest = path.join(TARGET_ROOT, ".agent", "skills", skill.name, "SKILL.md");
  await copySkillToFolder(skill, dest, { label: `Antigravity: ${skill.name}` });
}

async function installCursor(skill) {
  const dest = path.join(TARGET_ROOT, ".cursor", "skills", skill.name, "SKILL.md");
  await copySkillToFolder(skill, dest, { label: `Cursor: ${skill.name}` });
}

async function installAgentsMd(skills) {
  const dest = path.join(TARGET_ROOT, "AGENTS.md");
  const displayPath = path.relative(TARGET_ROOT, dest) || dest;
  try {
    const sections = [];
    for (const skill of skills) {
      const body = await fs.readFile(skill.path, "utf8");
      sections.push(`## ${skill.name}\n\n${body.trim()}\n`);
    }

    const header = `# Agent Development Skills\n\nUse these instructions when working with this repository.\n\n---\n\n`;
    const newContent = header + sections.join("\n---\n\n");

    if (await fs.pathExists(dest)) {
      const overwrite = await confirm({
        message: `${displayPath} already exists. Overwrite?`,
        default: false,
      });
      if (!overwrite) {
        console.log(chalk.yellow(`  ~ skipped  ${displayPath}`));
        for (const s of skills) summary.skipped.push(`AGENTS.md: ${s.name}`);
        return;
      }
    }

    await fs.writeFile(dest, newContent, "utf8");
    console.log(chalk.green(`  + wrote    ${displayPath}`));
    for (const s of skills) summary.installed.push(`AGENTS.md: ${s.name}`);
  } catch (err) {
    console.log(chalk.red(`  x failed   ${displayPath} — ${err.message}`));
    for (const s of skills) summary.failed.push(`AGENTS.md: ${s.name} (${err.message})`);
  }
}

function printSummary() {
  console.log("");
  console.log(chalk.bold("Installation summary"));
  console.log(chalk.dim("────────────────────"));

  if (summary.installed.length) {
    console.log(chalk.green(`Installed (${summary.installed.length}):`));
    for (const item of summary.installed) console.log(chalk.green(`  + ${item}`));
  }
  if (summary.skipped.length) {
    console.log(chalk.yellow(`Skipped (${summary.skipped.length}):`));
    for (const item of summary.skipped) console.log(chalk.yellow(`  ~ ${item}`));
  }
  if (summary.failed.length) {
    console.log(chalk.red(`Failed (${summary.failed.length}):`));
    for (const item of summary.failed) console.log(chalk.red(`  x ${item}`));
  }
  if (!summary.installed.length && !summary.skipped.length && !summary.failed.length) {
    console.log(chalk.dim("Nothing to report."));
  }
  console.log("");
}

async function runInstallForTarget(target, skills) {
  switch (target) {
    case "cursor":
      console.log(chalk.bold("\nInstalling Cursor skills..."));
      for (const s of skills) await installCursor(s);
      break;
    case "claude":
      console.log(chalk.bold("\nInstalling Claude Code skills..."));
      for (const s of skills) await installClaude(s);
      break;
    case "antigravity":
      console.log(chalk.bold("\nInstalling Google Antigravity skills..."));
      for (const s of skills) await installAntigravity(s);
      break;
    case "agents":
      console.log(chalk.bold("\nWriting AGENTS.md..."));
      await installAgentsMd(skills);
      break;
    case "all":
      await runInstallForTarget("cursor", skills);
      await runInstallForTarget("claude", skills);
      await runInstallForTarget("antigravity", skills);
      await runInstallForTarget("agents", skills);
      break;
    default:
      console.log(chalk.red(`Unknown target: ${target}`));
  }
}

async function main() {
  console.log(chalk.bold.cyan("\nfetch-skills"));
  console.log(chalk.dim("Install Fetch.ai developer skills into your project.\n"));

  const available = await getAvailableSkills();
  if (available.length === 0) {
    console.log(chalk.red("No skills found in package. Expected at least one skills/<name>/SKILL.md"));
    process.exit(1);
  }

  console.log(chalk.dim(`Target directory: ${TARGET_ROOT}`));
  console.log(chalk.dim(`Discovered ${available.length} skill${available.length === 1 ? "" : "s"}: ${available.map((s) => s.name).join(", ")}\n`));

  const selectedSkills = await promptForSkills(available);
  const target = await promptForTargetTool();

  await runInstallForTarget(target, selectedSkills);

  printSummary();
}

main().catch((err) => {
  if (err && err.name === "ExitPromptError") {
    console.log(chalk.yellow("\nAborted."));
    process.exit(130);
  }
  console.error(chalk.red("\nUnexpected error:"), err);
  process.exit(1);
});