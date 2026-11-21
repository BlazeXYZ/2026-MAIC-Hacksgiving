"""Tests for Issue #137: Verify documented backend setup and imports on clean checkout."""

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SERVER_DIR = REPO_ROOT / "src" / "server"


def test_import_main_from_server_dir_subprocess() -> None:
    """Importing main from src/server directory without PYTHONPATH must succeed."""
    # Run in a clean subprocess with cwd set to src/server and empty PYTHONPATH
    env = dict(os.environ)
    env.pop("PYTHONPATH", None)

    cmd = [
        sys.executable,
        "-c",
        "import main; assert main.app is not None; print('OK')",
    ]
    proc = subprocess.run(
        cmd,
        cwd=str(SERVER_DIR),
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert proc.returncode == 0, f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    assert "OK" in proc.stdout


def test_pyproject_hatchling_wheel_config() -> None:
    """src/server/pyproject.toml must configure hatchling build wheel targets."""
    pyproject_path = SERVER_DIR / "pyproject.toml"
    assert pyproject_path.exists()
    content = pyproject_path.read_text(encoding="utf-8")
    assert "[tool.hatch.build.targets.wheel]" in content
    assert 'packages = ["."]' in content
    assert '[tool.hatch.build.targets.wheel.sources]' in content
    assert '"." = "src/server"' in content
