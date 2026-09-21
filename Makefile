.PHONY: setup test lint build run
setup:
	python3 -m venv .venv && . .venv/bin/activate && pip install -r backend/requirements-dev.txt
	cd web && npm ci
	cd extension && npm ci
test:
	cd backend && python3 -m pytest -q
	cd web && npm test
	cd extension && npm test
lint:
	cd backend && ruff check . && ruff format --check .
	cd web && npm run lint && npm run typecheck
	cd extension && npm run lint && npm run typecheck
build:
	cd web && npm run build
	cd extension && npm run build
run: build
	cd backend && WEB_DIST=../web/dist python3 -m uvicorn app.main:app --port 8000
