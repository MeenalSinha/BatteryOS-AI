.PHONY: up down build test train-models lint frontend-dev backend-dev

## Start all services via Docker Compose
up:
	docker-compose up --build

## Stop all services
down:
	docker-compose down -v

## Build images only
build:
	docker-compose build

## Run backend tests
test:
	cd backend && python -m pytest tests/ -v --tb=short

## Train all ML models
train-models:
	cd ml && pip install -r requirements.txt && \
	python training/train_degradation_model.py && \
	python training/train_thermal_model.py && \
	python training/train_anomaly_model.py

## Start backend in dev mode
backend-dev:
	cd backend && \
	python -m venv venv && \
	. venv/bin/activate && \
	pip install -r requirements.txt && \
	uvicorn app.main:app --reload --port 8000

## Start frontend in dev mode
frontend-dev:
	cd frontend && npm install && npm run dev

## Run both dev servers (requires tmux or two terminals)
dev:
	@echo "Run 'make backend-dev' and 'make frontend-dev' in separate terminals"

## Run IoT telemetry generator
telemetry:
	cd iot/telemetry-gen && python generator.py --vehicles 10 --scenario mixed

## Lint Python backend
lint:
	cd backend && python -m flake8 app/ --max-line-length=120

## Type check frontend
type-check:
	cd frontend && npm run type-check

## Reset everything
clean:
	docker-compose down -v --remove-orphans
	cd frontend && rm -rf .next node_modules
	cd backend && rm -rf venv __pycache__
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null; true
