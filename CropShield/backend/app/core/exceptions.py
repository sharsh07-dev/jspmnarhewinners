from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status

logger = logging.getLogger(__name__)


class NotFoundError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class ConflictError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def _error_response(message: str, code: str, status_code: int, details: Any | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details,
            }
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotFoundError)
    async def handle_not_found(_: Request, exc: NotFoundError) -> JSONResponse:
        return _error_response(exc.message, "not_found", status.HTTP_404_NOT_FOUND)

    @app.exception_handler(ConflictError)
    async def handle_conflict(_: Request, exc: ConflictError) -> JSONResponse:
        return _error_response(exc.message, "conflict", status.HTTP_409_CONFLICT)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _error_response(
            "Request validation failed.",
            "validation_error",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=exc.errors(),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception in API", exc_info=exc)
        return _error_response(
            "Internal server error.",
            "internal_error",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
