"""Container entrypoint: apply migrations, then serve the API."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    try:
        upgrade = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=BACKEND_ROOT,
            check=False,
            timeout=10,
        )
        if upgrade.returncode != 0:
            print(
                f"[entrypoint] Alembic upgrade returned {upgrade.returncode}, proceeding with app startup",
                flush=True,
            )
    except Exception as exc:
        print(f"[entrypoint] Alembic upgrade failed: {exc}, proceeding with app startup", flush=True)

    return subprocess.call(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
        ],
        cwd=BACKEND_ROOT,
    )


if __name__ == "__main__":
    raise SystemExit(main())
