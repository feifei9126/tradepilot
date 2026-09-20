FROM ghcr.io/astral-sh/uv:0.12.11 AS uv
FROM public.ecr.aws/docker/library/python:3.12-slim
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev \
    && useradd --create-home --uid 1000 agent
COPY agent.py assistant.py config_loader.py supervisor.py ./
USER agent
EXPOSE 8081
CMD ["/app/.venv/bin/python", "supervisor.py"]
