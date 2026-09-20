import base64
import hashlib
import json

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from config_loader import decrypt_config, load_environment, worker_environment


def example():
    return {
        "text": {
            "provider": "openai",
            "baseUrl": "https://api.openai.com/v1",
            "apiKey": "text-secret",
        },
        "livekit": {
            "url": "wss://example.livekit.cloud",
            "apiKey": "lk-key",
            "apiSecret": "lk-secret",
            "agentName": "tradepilot",
        },
        "voice": {
            "apiKey": "voice-secret",
            "useTextKey": False,
            "model": "gpt-realtime",
            "voice": "marin",
            "transcriptionModel": "gpt-4o-mini-transcribe",
        },
    }


def test_reuse_only_official_openai():
    config = example()
    assert worker_environment(config)["OPENAI_API_KEY"] == "voice-secret"
    config["voice"]["useTextKey"] = True
    assert worker_environment(config)["OPENAI_API_KEY"] == "text-secret"
    config["text"]["baseUrl"] = "https://untrusted.example/v1"
    assert worker_environment(config)["OPENAI_API_KEY"] == ""


def test_envelope_and_fail_closed(tmp_path):
    secret = "test-only-key-that-is-at-least-32-characters"
    key = hashlib.sha256(f"tradepilot-api-config-v1:{secret}".encode()).digest()
    iv = b"012345678901"
    encrypted = AESGCM(key).encrypt(
        iv, json.dumps({"revision": 1, "config": example()}).encode(), None
    )

    def b64(v):
        return base64.b64encode(v).decode()

    path = tmp_path / "ai-config.enc.json"
    path.write_text(
        json.dumps(
            {
                "version": 1,
                "iv": b64(iv),
                "data": b64(encrypted[:-16]),
                "tag": b64(encrypted[-16:]),
            }
        )
    )
    assert decrypt_config(path, secret) == example()
    env = {
        "TRADEPILOT_DATA_DIR": str(tmp_path),
        "TRADEPILOT_CONFIG_KEY": secret,
        "OPENAI_API_KEY": "old-env-key",
    }
    assert load_environment(env)["OPENAI_API_KEY"] == "voice-secret"
    path.write_text("corrupt")
    with pytest.raises(json.JSONDecodeError):
        load_environment(env)


def test_missing_file_uses_env(tmp_path):
    assert (
        load_environment(
            {"TRADEPILOT_DATA_DIR": str(tmp_path), "OPENAI_API_KEY": "initial"}
        )["OPENAI_API_KEY"]
        == "initial"
    )


def test_node_encryption_is_compatible(tmp_path):
    import shutil
    import subprocess

    if not shutil.which("node"):
        pytest.skip("Node is only needed for this cross-language compatibility test")
    secret = "cross-language-fixture-key-at-least-32-characters"
    script = """
const c = require('node:crypto');
const key = c.createHash('sha256').update('tradepilot-api-config-v1:' + process.argv[1]).digest();
const iv = c.randomBytes(12), cipher = c.createCipheriv('aes-256-gcm', key, iv);
const data = Buffer.concat([cipher.update(JSON.stringify({revision:1,config:JSON.parse(process.argv[2])})),cipher.final()]);
console.log(JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}));
"""
    result = subprocess.run(
        ["node", "-e", script, secret, json.dumps(example())],
        check=True,
        capture_output=True,
        text=True,
    )
    path = tmp_path / "ai-config.enc.json"
    path.write_text(result.stdout)
    assert decrypt_config(path, secret) == example()
