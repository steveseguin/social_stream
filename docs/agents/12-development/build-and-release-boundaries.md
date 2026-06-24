# Build And Release Boundaries

Status: heavy extraction pass started on 2026-06-24.

## Purpose

Document build, packaging, release, and repo-boundary rules that matter when answering SSN/SSApp development or release questions.

## Source Anchors

- `ssapp/AGENTS.md`
- `ssapp/RELEASE.md`
- `ssapp/package.json`
- `ssapp/scripts/*`
- `ssapp/resources/README.md`
- `social_stream/AGENTS.md`
- `social_stream/package.json`

## Critical Release Boundary

Desktop app binaries are built from `ssapp`, but app release tags and artifacts belong in:

```text
steveseguin/social_stream
```

Do not create app release tags or GitHub releases in:

```text
steveseguin/ssn_app
```

The app release guide says to create GitHub releases as pre-releases; Steve promotes them when ready.

If Steve says "ship a release", confirm target and scope before creating tags, releases, or uploading artifacts.

## ssapp Build Commands

From `ssapp/package.json` and app instructions:

- `npm run start`: start Electron app.
- `npm run start2`: start development mode with `--running-from-source`.
- `npm run start3`: start from `C:/Users/steve/Code/social_stream/`.
- `npm run start4`: macOS source path variant.
- `npm run update:fallback`: regenerate Social Stream fallback bundle.
- `npm run clean`: remove `dist`.
- `npm run build:win32`: Windows NSIS + portable.
- `npm run build:darwin`: macOS x64 + arm64.
- `npm run build:linux`: Linux AppImage.
- `npm run build:rpi`: Raspberry Pi Linux deb path.
- `npm run release`: electron-builder publish flow.
- `npm run submit:virustotal`: submit Windows exe files to VirusTotal.

Prebuild scripts run submodule checks and fallback update. This does not make the fallback folder a normal edit target.

## Expected Windows Artifacts

The release guide expects Windows artifacts under `ssapp/dist/`, including:

- `socialstreamninja-setup-<version>.exe`
- `socialstreamninja-portable.exe`
- `socialstreamninja_win_v<version>_installer.zip`
- `socialstreamninja_win_v<version>_portable.zip`

Artifact names are controlled in `ssapp/package.json` electron-builder config.

## Platform Build Order

The release guide's current order:

1. Build Windows in `ssapp`.
2. Submit Windows installer and portable exe to VirusTotal.
3. Upload Windows artifacts to the `steveseguin/social_stream` GitHub release.
4. Build Linux AppImage via WSL2 after Windows build is finished.
5. Upload Linux AppImage to the same `steveseguin/social_stream` GitHub release.
6. Steve handles macOS builds for now.

## VirusTotal Rules

VirusTotal key:

- local `.secret` at repo root with `VT_API_KEY=...`
- or `VT_API_KEY` environment variable

Only submit the two Windows exe files:

- `dist/socialstreamninja-setup-<version>.exe`
- `dist/socialstreamninja-portable.exe`

Do not submit Linux AppImage builds to VirusTotal.

`.secret` must stay gitignored and must not be committed.

## Fallback Bundle Rule

`ssapp/resources/social_stream_fallback` is generated.

Rules:

- Do not modify it manually.
- Do not treat it as source.
- Do not use it for normal code reading or docs extraction.
- It is rebuilt by `npm run update:fallback` and prebuild scripts.

Source changes belong in:

```text
C:\Users\steve\Code\social_stream
```

## Release Notes Style

GitHub release notes for app releases should follow the Social Stream style.

Required start:

```md
:point_right::point_right: EXPORT AND SAVE YOUR SETTINGS BEFORE UPDATING :warning::warning:
```

Required heading:

```md
### What's new in this version:
```

Rules:

- Write for normal users, not developers.
- Include every important user-facing change included since the prior release package, not only the final version bump.
- Check recent `steveseguin/social_stream` releases before writing notes.
- Do not include redundant platform intro text such as "Windows, macOS, and Linux pre-release"; the Downloads table already shows platforms.
- Include the screenshot image specified in `ssapp/RELEASE.md` when preparing actual release notes.
- Include a downloads table with uploaded files.

## Git Push Contract

The `social_stream/AGENTS.md` push contract says:

- When Steve says `push`, push to `beta`.
- Push all current changes unless Steve explicitly excludes something.
- Use this serial order only:
  1. `git add -A`
  2. `git commit` (use `--allow-empty` if needed)
  3. `git pull --rebase origin beta`
  4. `git push origin beta`
- Do not parallelize that git flow.
- Do not add extra git inspection commands unless Steve asks.

Global/current instructions also say never create a branch unless Steve explicitly asks.

## Do Not

- Do not create git tags in `ssapp` for app releases.
- Do not create or upload GitHub releases against `steveseguin/ssn_app`.
- Do not assume `ssapp/package.json` publish config means `ssn_app` is the public release target.
- Do not touch generated fallback files manually.
- Do not commit secrets, certs, `.env`, `.secret`, or signing material.
- Do not call release validation "tested" unless the appropriate real workflow was run.

## If Something Goes Wrong

If a wrong `ssapp` tag or release is created, stop and report it to Steve before cleanup.

Do not delete tags/releases without explicit approval.

## Remaining Extraction Targets

- Inspect current GitHub workflow files for exact release artifact automation.
- Cross-check public download docs once release/upload docs are needed.
- Add a step-by-step release runbook only when Steve asks for release work.
