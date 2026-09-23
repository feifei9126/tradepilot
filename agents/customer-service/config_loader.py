"""Read the shared encrypted config, never exposing credentials to room metadata."""

import base64
import hashlib
import json
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def decrypt_config(path: Path, secret: str) -> dict:
    if len(secret) < 32:
        raise ValueError("API config encryption key is missing")
    envelope = json.loads(path.read_text())
    if envelope.get("version") != 1:
        raise ValueError("Unsupported config version")
    key = hashlib.sha256(f"tradepilot-api-config-v1:{secret}".encode()).digest()
    plaintext = AESGCM(key).decrypt(
        base64.b64decode(envelope["iv"]),
        base64.b64decode(envelope["data"]) + base64.b64decode(envelope["tag"]),
        None,
    )
    return json.loads(plaintext)["config"]


def worker_environment(config: dict) -> dict[str, str]:
    livekit, voice, text = config["livekit"], config["voice"], config["text"]
    api_key = voice["apiKey"]
    if voice["useTextKey"]:
        api_key = (
            text["apiKey"]
            if text["provider"] == "openai"
            and text["baseUrl"].rstrip("/") == "https://api.openai.com/v1"
            else ""
        )
    return {
        "LIVEKIT_URL": livekit["url"],
        "LIVEKIT_API_KEY": livekit["apiKey"],
        "LIVEKIT_API_SECRET": livekit["apiSecret"],
        "LIVEKIT_AGENT_NAME": livekit["agentName"],
        "OPENAI_API_KEY": api_key,
        "OPENAI_REALTIME_MODEL": voice["model"],
        "OPENAI_REALTIME_VOICE": voice["voice"],
        "OPENAI_TRANSCRIPTION_MODEL": voice["transcriptionModel"],
    }


def load_environment(env: dict[str, str]) -> dict[str, str]:
    path = Path(env.get("TRADEPILOT_DATA_DIR", "data")) / "ai-config.enc.json"
    if not path.exists():
        return {
            k: env.get(k, "")
            for k in (
                "LIVEKIT_URL",
                "LIVEKIT_API_KEY",
                "LIVEKIT_API_SECRET",
                "LIVEKIT_AGENT_NAME",
                "OPENAI_API_KEY",
                "OPENAI_REALTIME_MODEL",
                "OPENAI_REALTIME_VOICE",
                "OPENAI_TRANSCRIPTION_MODEL",
            )
        }
    # Fail closed on unreadable/corrupt data instead of reverting to old environment keys.
    return worker_environment(
        decrypt_config(
            path, env.get("TRADEPILOT_CONFIG_KEY") or env.get("AUTH_SECRET", "")
        )
    )
