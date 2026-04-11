from __future__ import annotations

import json
import logging
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class AutomationResult:
    extent: list[float]
    polygon: list[list[float]]
    owners: list[str]
    surveys: list[str]
    areas: list[str]
    screenshot_path: str | None
    selection: dict[str, Any]
    status_message: str | None
    source: str
    raw_plot_text: str | None
    raw_payload: dict[str, Any] | None = None


class MahabhunakashaService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _script_path(self) -> Path:
        return self.settings.project_root.parent / "mahabhunakasha_automation.py"

    def lookup_plot(
        self,
        *,
        state_index: int,
        category_index: int,
        district_index: int,
        taluka_index: int,
        village_index: int,
        plot_index: int,
        headless: bool = True,
    ) -> AutomationResult:
        script_path = self._script_path()
        out_dir = self.settings.artifacts_dir / "mahabhunakasha"
        out_dir.mkdir(parents=True, exist_ok=True)

        if not script_path.exists():
            logger.warning("Automation script not found at %s; using fallback farm extent.", script_path)
            return self._fallback_result(
                state_index=state_index,
                category_index=category_index,
                district_index=district_index,
                taluka_index=taluka_index,
                village_index=village_index,
                plot_index=plot_index,
                reason=f"Automation script missing at {script_path}",
            )

        command = [
            sys.executable,
            str(script_path),
            "--state",
            str(state_index),
            "--category",
            str(category_index),
            "--district",
            str(district_index),
            "--taluka",
            str(taluka_index),
            "--village",
            str(village_index),
            "--plot",
            str(plot_index),
            "--wait",
            "5",
            "--outdir",
            str(out_dir),
            "--no-interactive",
            "--json-output",
        ]
        if headless:
            command.append("--headless")

        try:
            completed = subprocess.run(
                command,
                cwd=str(self.settings.project_root.parent),
                check=False,
                capture_output=True,
                text=True,
                timeout=180,
            )
            if completed.returncode != 0:
                logger.warning(
                    "Automation execution failed (code=%s): %s",
                    completed.returncode,
                    completed.stderr.strip() or completed.stdout.strip(),
                )
                return self._fallback_result(
                    state_index=state_index,
                    category_index=category_index,
                    district_index=district_index,
                    taluka_index=taluka_index,
                    village_index=village_index,
                    plot_index=plot_index,
                    reason=(completed.stderr.strip() or completed.stdout.strip() or "Unknown automation failure"),
                )

            payload = self._parse_json_line(completed.stdout)
            if payload is None:
                logger.warning("Automation output had no parseable JSON; using fallback.")
                return self._fallback_result(
                    state_index=state_index,
                    category_index=category_index,
                    district_index=district_index,
                    taluka_index=taluka_index,
                    village_index=village_index,
                    plot_index=plot_index,
                    reason="Automation output not parseable as JSON.",
                )

            plot_info = payload.get("plot_info", {}) if isinstance(payload, dict) else {}
            selection = payload.get("selection", {}) if isinstance(payload, dict) else {}
            screenshot_path = payload.get("screenshot_path") if isinstance(payload, dict) else None

            extent = payload.get("extent", []) if isinstance(payload, dict) else []
            extent = [float(item) for item in extent[:4]] if isinstance(extent, list) else []
            polygon = payload.get("extent_polygon", []) if isinstance(payload, dict) else []
            polygon = polygon if isinstance(polygon, list) else []

            return AutomationResult(
                extent=extent,
                polygon=polygon,
                owners=list(plot_info.get("owners", []) or []),
                surveys=list(plot_info.get("survey_numbers", []) or []),
                areas=list(plot_info.get("areas", []) or []),
                screenshot_path=str(screenshot_path) if screenshot_path else None,
                selection=selection if isinstance(selection, dict) else {},
                status_message="Live Mahabhunakasha automation completed.",
                source="mahabhunakasha-live",
                raw_plot_text=plot_info.get("raw"),
                raw_payload=payload if isinstance(payload, dict) else None,
            )
        except Exception as exc:
            logger.warning("Automation crashed, switching to fallback: %s", exc)
            return self._fallback_result(
                state_index=state_index,
                category_index=category_index,
                district_index=district_index,
                taluka_index=taluka_index,
                village_index=village_index,
                plot_index=plot_index,
                reason=f"Automation unavailable: {exc}",
            )

    def _parse_json_line(self, output: str) -> dict[str, Any] | None:
        lines = [line.strip() for line in output.splitlines() if line.strip()]
        for line in reversed(lines):
            if not (line.startswith("{") and line.endswith("}")):
                continue
            try:
                parsed = json.loads(line)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                continue
        return None

    def _fallback_result(
        self,
        *,
        state_index: int,
        category_index: int,
        district_index: int,
        taluka_index: int,
        village_index: int,
        plot_index: int,
        reason: str,
    ) -> AutomationResult:
        # Default rectangle near Pune in lat/lon order used by frontend polygon renderer.
        polygon = [
            [18.520100, 73.855700],
            [18.520100, 73.857000],
            [18.521000, 73.857000],
            [18.521000, 73.855700],
            [18.520100, 73.855700],
        ]
        extent = [73.855700, 18.520100, 73.857000, 18.521000]
        return AutomationResult(
            extent=extent,
            polygon=polygon,
            owners=["Owner data unavailable (fallback mode)"],
            surveys=[f"Plot-{plot_index + 1}"],
            areas=["2.500"],
            screenshot_path=None,
            selection={
                "state_index": state_index,
                "category_index": category_index,
                "district_index": district_index,
                "taluka_index": taluka_index,
                "village_index": village_index,
                "plot_index": plot_index,
                "state_name": "Fallback",
                "category_name": "Fallback",
                "district_name": "Fallback",
                "taluka_name": "Fallback",
                "village_name": "Fallback",
                "plot_name": f"Plot-{plot_index + 1}",
            },
            status_message=(
                "Live land-record automation is currently unavailable. "
                f"Saved a fallback farm boundary for workflow continuity. Details: {reason}"
            ),
            source="mahabhunakasha-fallback",
            raw_plot_text=reason,
            raw_payload={"reason": reason},
        )

    def fetch_location_options(
        self,
        *,
        state_index: int | None = None,
        category_index: int | None = None,
        district_index: int | None = None,
        taluka_index: int | None = None,
        village_index: int | None = None,
        headless: bool = True,
    ) -> dict[str, Any]:
        script_path = self._script_path()
        if not script_path.exists():
            return {
                "state": [],
                "category": [],
                "district": [],
                "taluka": [],
                "village": [],
                "plot": [],
                "selected": {
                    "state_index": state_index or 0,
                    "category_index": category_index or 0,
                    "district_index": district_index or 0,
                    "taluka_index": taluka_index or 0,
                    "village_index": village_index or 0,
                    "plot_index": 0,
                },
            }

        command = [
            sys.executable,
            str(script_path),
            "--list-options",
            "--json-output",
        ]
        if state_index is not None:
            command.extend(["--state", str(state_index)])
        if category_index is not None:
            command.extend(["--category", str(category_index)])
        if district_index is not None:
            command.extend(["--district", str(district_index)])
        if taluka_index is not None:
            command.extend(["--taluka", str(taluka_index)])
        if village_index is not None:
            command.extend(["--village", str(village_index)])
        if headless:
            command.append("--headless")

        try:
            completed = subprocess.run(
                command,
                cwd=str(self.settings.project_root.parent),
                check=False,
                capture_output=True,
                text=True,
                timeout=120,
            )
            if completed.returncode != 0:
                logger.warning(
                    "Options lookup failed (code=%s): %s",
                    completed.returncode,
                    completed.stderr.strip() or completed.stdout.strip(),
                )
                return {
                    "state": [],
                    "category": [],
                    "district": [],
                    "taluka": [],
                    "village": [],
                    "plot": [],
                    "selected": {
                        "state_index": state_index or 0,
                        "category_index": category_index or 0,
                        "district_index": district_index or 0,
                        "taluka_index": taluka_index or 0,
                        "village_index": village_index or 0,
                        "plot_index": 0,
                    },
                }

            payload = self._parse_json_line(completed.stdout)
            if isinstance(payload, dict):
                return payload
        except Exception as exc:
            logger.warning("Options lookup crashed: %s", exc)

        return {
            "state": [],
            "category": [],
            "district": [],
            "taluka": [],
            "village": [],
            "plot": [],
            "selected": {
                "state_index": state_index or 0,
                "category_index": category_index or 0,
                "district_index": district_index or 0,
                "taluka_index": taluka_index or 0,
                "village_index": village_index or 0,
                "plot_index": 0,
            },
        }
