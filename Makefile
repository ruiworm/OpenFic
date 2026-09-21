.PHONY: help start dev stop restart status logs build test

help:
	@./start.sh help

start:
	@./start.sh start

dev:
	@./start.sh dev

stop:
	@./start.sh stop

restart:
	@./start.sh restart

status:
	@./start.sh status

logs:
	@./start.sh logs

build:
	@./start.sh build

test:
	@backend/.venv/bin/pytest backend/tests/
	@pnpm --dir frontend run type-check
