# INSTRUCTIONS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript project using the Octarine public wrapper SDK. Uses Yarn as the package manager.

**IMPORTANT:** `github.com/octarine-public/wrapper/index` is a **local path on disk**, NOT a URL to fetch from the internet. The wrapper SDK source code is located at `C:\github.com\octarine-public\wrapper`. Do NOT attempt to fetch it from the web — read the files directly from disk at that path.

If the SDK is not found at `C:\github.com\octarine-public\wrapper`, clone it from the public repository:

```bash
mkdir -p /c/github.com/octarine-public
git clone https://github.com/octarine-public/wrapper.git /c/github.com/octarine-public/wrapper
cd /c/github.com/octarine-public/wrapper
yarn
```

## SDK Reference

The `AGENTS.md` file in the wrapper SDK (`C:\github.com\octarine-public\wrapper\AGENTS.md`) contains documentation and context for the API. When writing new scripts or features, read this file directly from disk for available APIs, types, and usage patterns.

## Reference Scripts

The `scripts_reference/` directory contains ready-made script examples that demonstrate proper architecture, code patterns, and best practices. When building new features or scripts, look at these references to understand the expected structure and style.

## Commands

- **Install dependencies:** `yarn install`
- **Run tests:** `yarn test`
- **Type check:** `yarn tsc --noEmit`

## Conventions

- **TypeScript:** Strict mode enabled, experimental decorators enabled, ESNext target.
- **Formatting:** 2 spaces for indentation, UTF-8, LF line endings, trailing newline (see `.editorconfig`).
- **Imports:** Modules use URL-style paths from the Octarine wrapper (e.g., `import { ... } from "github.com/octarine-public/wrapper/index"`).
