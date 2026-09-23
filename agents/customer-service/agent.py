"""Run separately from Next.js: uv run python agent.py dev (or start)."""

import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from livekit import agents, api
from livekit.agents import AgentServer, AgentSession, room_io
from livekit.plugins import openai
from openai.types.realtime import AudioTranscription

from assistant import EVENT_TOPIC, CustomerAssistant, SessionMetadata

load_dotenv(Path(__file__).with_name(".env.local"))
server = AgentServer(num_idle_processes=1, log_level="INFO")


async def enforce_session_deadline(ctx: agents.JobContext, seconds: int):
    await asyncio.sleep(seconds)
    try:
        # Closing the room stops both media and inference, not just the browser UI.
        await ctx.api.room.delete_room(api.DeleteRoomRequest(room=ctx.room.name))
    finally:
        ctx.shutdown(reason="maximum session duration reached")


@server.rtc_session(
    agent_name=(
        os.getenv("LIVEKIT_AGENT_NAME", "").strip() or "tradepilot-customer-service"
    )
)
async def customer_service(ctx: agents.JobContext):
    # Signed dispatch metadata from the token endpoint, not mutable participant metadata.
    try:
        metadata = SessionMetadata.model_validate_json(ctx.job.metadata)
    except ValueError:
        ctx.shutdown(reason="invalid dispatch metadata")
        return

    await ctx.connect()
    try:
        await asyncio.wait_for(
            ctx.wait_for_participant(identity=metadata.participant_identity), timeout=30
        )
    except TimeoutError:
        ctx.shutdown(reason="operator did not join")
        return

    async def publish(event: dict) -> None:
        await ctx.room.local_participant.publish_data(
            json.dumps(event, ensure_ascii=False).encode("utf-8"),
            reliable=True,
            topic=EVENT_TOPIC,
            destination_identities=[metadata.participant_identity],
        )

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
            voice=os.getenv("OPENAI_REALTIME_VOICE", "marin"),
            input_audio_transcription=AudioTranscription(
                model=os.getenv("OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe"),
                language=metadata.language,
            ),
        )
    )

    @session.on("close")
    def on_close(_event):
        ctx.shutdown(reason="voice session closed")

    deadline = asyncio.create_task(
        enforce_session_deadline(ctx, metadata.max_session_seconds)
    )

    async def cleanup():
        deadline.cancel()
        await asyncio.gather(deadline, return_exceptions=True)
        await session.aclose()

    ctx.add_shutdown_callback(cleanup)
    await session.start(
        room=ctx.room,
        agent=CustomerAssistant(metadata, publish),
        record=False,  # No LiveKit session audio/transcript/trace recording.
        room_options=room_io.RoomOptions(
            participant_identity=metadata.participant_identity,
            text_input=False,
            video_input=False,
            close_on_disconnect=True,
            delete_room_on_close=True,
        ),
    )
    await session.generate_reply(
        instructions="Introduce yourself as an AI assistant in the selected language and ask how you can help."
    )


if __name__ == "__main__":
    required = (
        "LIVEKIT_URL",
        "LIVEKIT_API_KEY",
        "LIVEKIT_API_SECRET",
        "OPENAI_API_KEY",
    )
    missing = [key for key in required if not os.getenv(key, "").strip()]
    if missing:
        raise SystemExit(
            "Missing required environment variables: " + ", ".join(missing)
        )
    agents.cli.run_app(server)
