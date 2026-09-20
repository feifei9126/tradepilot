"""Docker entrypoint: wait for setup, reload voice-only changes, forward shutdown."""

import os
import signal
import subprocess
import sys
import time

from cryptography.exceptions import InvalidTag

from config_loader import load_environment


def main():
    stopping = False
    child = None
    previous = None
    last_state = None

    def stop_signal(_signum, _frame):
        nonlocal stopping
        stopping = True

    def stop_child():
        nonlocal child
        if child is None:
            return
        child.terminate()
        try:
            child.wait(timeout=45)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()
        child = None

    signal.signal(signal.SIGTERM, stop_signal)
    signal.signal(signal.SIGINT, stop_signal)
    try:
        while not stopping:
            try:
                selected = load_environment(dict(os.environ))
                ready = all(
                    selected.get(k, "").strip()
                    for k in (
                        "LIVEKIT_URL",
                        "LIVEKIT_API_KEY",
                        "LIVEKIT_API_SECRET",
                        "OPENAI_API_KEY",
                    )
                )
                state = "ready" if ready else "waiting for API configuration"
            except (OSError, ValueError, KeyError, TypeError, InvalidTag):
                selected, ready = {}, False
                state = "cannot decrypt/read API configuration; check key and volume permissions"
            if state != last_state:
                print(f"Voice worker: {state}", flush=True)
                last_state = state
            if not ready or selected != previous:
                stop_child()
            if ready and not stopping and (child is None or child.poll() is not None):
                child_env = dict(os.environ)
                child_env.update(selected)
                child = subprocess.Popen(
                    [sys.executable, "agent.py", "start"], env=child_env
                )
                previous = selected
            for _ in range(20):
                if stopping:
                    break
                time.sleep(0.5)
    finally:
        stop_child()


if __name__ == "__main__":
    main()
