from __future__ import annotations

import os
from typing import Tuple


def initialize_earth_engine() -> Tuple[bool, str]:
    try:
        import ee
    except ImportError:
        return False, "earthengine-api is not installed. Running in demo mode."

    project = (
        os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("EE_PROJECT")
        or os.environ.get("GEE_PROJECT")
    )

    try:
        if project:
            ee.Initialize(project=project)
            return True, f"Google Earth Engine initialized successfully with project '{project}'."
        ee.Initialize()
        return True, "Google Earth Engine initialized successfully using default credentials."
    except Exception as exc_init:
        try:
            ee.Authenticate()
            if project:
                ee.Initialize(project=project)
                return True, f"Google Earth Engine authenticated and initialized with project '{project}'."
            ee.Initialize()
            return True, "Google Earth Engine authenticated and initialized using default credentials."
        except Exception as exc_auth:
            if project:
                project_hint = f"Current project env value: '{project}'. "
            else:
                project_hint = (
                    "No project env variable set. Optionally set one: "
                    "$env:GOOGLE_CLOUD_PROJECT='your-gcp-project-id'. "
                )
            return (
                False,
                f"Earth Engine failed: {exc_auth}. {project_hint}Running in demo mode.",
            )
