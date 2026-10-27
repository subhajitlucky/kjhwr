.PHONY: help install api web ingest test build serve docker-up docker-down

help:
	@echo "Windcast"
	@echo "  make install   install backend + frontend dependencies"
	@echo "  make api       run FastAPI on :8000 (reload)"
	@echo "  make web       run Vite on :5173 (proxies /api to :8000)"
	@echo "  make ingest    rebuild the January 2026 SQLite snapshot"
	@echo "  make test      run the backend test suite"
	@echo "  make build     build the React frontend"
	@echo "  make serve     build the frontend and run FastAPI on :8000"
	@echo "  make docker-up build and run the production container"

install:
	cd backend && uv venv .venv --python 3.12 && . .venv/bin/activate && uv pip install -r requirements-dev.txt
	cd frontend && pnpm install

api:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --port 8000

web:
	cd frontend && pnpm dev

ingest:
	cd backend && . .venv/bin/activate && python -m app.services.ingest

test:
	cd backend && . .venv/bin/activate && python -m pytest

build:
	cd frontend && pnpm build

serve: build
	cd backend && . .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000

docker-up:
	docker compose up --build

docker-down:
	docker compose down
