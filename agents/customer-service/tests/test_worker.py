import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

import agent
from assistant import SessionMetadata


def context(metadata):
    return SimpleNamespace(
        job=SimpleNamespace(metadata=metadata),
        connect=AsyncMock(),
        wait_for_participant=AsyncMock(),
        room=SimpleNamespace(
            name="tradepilot-test",
            local_participant=SimpleNamespace(publish_data=AsyncMock()),
        ),
        api=SimpleNamespace(room=SimpleNamespace(delete_room=AsyncMock())),
        shutdown=Mock(),
        add_shutdown_callback=Mock(),
    )


async def test_bad_dispatch_never_connects_or_starts_model():
    ctx = context('{"invalid": "metadata"}')
    await agent.customer_service(ctx)
    ctx.connect.assert_not_awaited()
    ctx.shutdown.assert_called_once()


async def test_worker_binds_operator_and_disables_recording(monkeypatch):
    metadata = SessionMetadata(
        version=1,
        mode="support",
        language="zh",
        brief="Known public facts",
        participant_identity="operator-02ee21a3-114d-4eb6-894d-5a0a7a7752e7",
        max_session_seconds=900,
    )
    ctx = context(metadata.model_dump_json())
    session = SimpleNamespace(
        start=AsyncMock(),
        generate_reply=AsyncMock(),
        aclose=AsyncMock(),
        on=lambda _event: lambda fn: fn,
    )
    model = Mock()
    monkeypatch.setattr(agent, "AgentSession", lambda **_kwargs: session)
    monkeypatch.setattr(agent.openai.realtime, "RealtimeModel", model)
    await agent.customer_service(ctx)
    ctx.wait_for_participant.assert_awaited_once_with(
        identity=metadata.participant_identity
    )
    assert model.call_args.kwargs["input_audio_transcription"].language == "zh"
    options = session.start.call_args.kwargs
    assert options["record"] is False
    assert options["room_options"].participant_identity == metadata.participant_identity
    assert options["room_options"].delete_room_on_close is True
    assert options["room_options"].text_input is False
    assistant = options["agent"]
    await assistant.request_human_followup(None, "Verify policy")
    publish = ctx.room.local_participant.publish_data
    assert publish.call_args.kwargs["reliable"] is True
    assert publish.call_args.kwargs["destination_identities"] == [
        metadata.participant_identity
    ]
    assert publish.call_args.kwargs["topic"] == "tradepilot.agent.events"
    await ctx.add_shutdown_callback.call_args.args[0]()
    session.aclose.assert_awaited_once()


async def test_deadline_deletes_room_and_shuts_down_even_if_delete_fails(monkeypatch):
    sleep = AsyncMock()
    monkeypatch.setattr(asyncio, "sleep", sleep)
    ctx = context("")
    await agent.enforce_session_deadline(ctx, 900)
    sleep.assert_awaited_once_with(900)
    assert ctx.api.room.delete_room.call_args.args[0].room == ctx.room.name
    ctx.shutdown.assert_called_once()
    ctx.shutdown.reset_mock()
    ctx.api.room.delete_room.side_effect = RuntimeError("room already gone")
    with pytest.raises(RuntimeError):
        await agent.enforce_session_deadline(ctx, 900)
    ctx.shutdown.assert_called_once()


async def test_real_sdk_accepts_transcription_configuration_without_network():
    from openai.types.realtime import AudioTranscription

    model = agent.openai.realtime.RealtimeModel(
        api_key="test-only-not-a-real-key",
        model="gpt-realtime",
        voice="marin",
        input_audio_transcription=AudioTranscription(
            model="gpt-4o-mini-transcribe", language="zh"
        ),
    )
    assert model.capabilities.user_transcription is True
    await model.aclose()
