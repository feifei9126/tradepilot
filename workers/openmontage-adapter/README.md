# TradePilot OpenMontage Adapter

This small worker gives TradePilot a stable HTTP target for product video jobs.

OpenMontage is an agent-driven video production workspace, so this adapter does not vendor OpenMontage into TradePilot. It receives product briefs from TradePilot and exposes a stable job API. By default it uses the bundled FFmpeg renderer to produce a real MP4; a configured command can replace that renderer with the full OpenMontage pipeline.

## Start

```bash
cd workers/openmontage-adapter
OPENMONTAGE_WORKSPACE="$HOME/OpenMontage" npm start
```

Then set TradePilot:

```bash
OPENMONTAGE_WORKER_URL=http://localhost:8787
```

For a separate host, set `OPENMONTAGE_PUBLIC_URL` on the worker and use the same public/private-network base URL as `OPENMONTAGE_WORKER_URL` in TradePilot. The adapter has no built-in authentication, so keep it on a private network or protect it with an HTTPS reverse proxy and an IP allowlist.

## Optional Command Mode

If you later create an OpenMontage script that can consume a JSON brief, wire it like this:

```bash
OPENMONTAGE_COMMAND=python3 \
OPENMONTAGE_COMMAND_ARGS_JSON='["scripts/tradepilot_job.py","--job-file","{jobFile}","--output-dir","{outputDir}"]' \
OPENMONTAGE_REPO="$HOME/OpenMontage" \
OPENMONTAGE_WORKSPACE="$HOME/OpenMontage" \
npm start
```

The script should write `result.json` into `{outputDir}`:

```json
{
  "status": "completed",
  "progress": 100,
  "script": "Final approved script...",
  "videoUrl": "/assets/<jobId>/final.mp4",
  "thumbnailUrl": "/assets/<jobId>/thumbnail.jpg"
}
```

Without `OPENMONTAGE_COMMAND`, the adapter uses the bundled local renderer. It creates a real MP4 and thumbnail from the first source image (when provided) plus the product title and brief. This verifies the complete production, preview, download, and deletion flow; configure `OPENMONTAGE_COMMAND` for richer OpenMontage editing, voice-over, music, and multi-scene output.

## Management API

```http
DELETE /jobs/:id
GET    /assets/:jobId/final.mp4
GET    /assets/:jobId/thumbnail.jpg
```

Deleting a job stops its active child process and removes its inbox, status, output, video, and thumbnail files.
