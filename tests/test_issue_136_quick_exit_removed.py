"""Regression test for retiring Quick Exit from phone-shell handoff docs."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def test_phone_shell_handoff_has_no_quick_exit_requirements() -> None:
    """Active phone-shell sources must not request the retired Exit feature."""
    paths = (
        REPO_ROOT / "IDEAS.md",
        REPO_ROOT / "src/server/forums/seed.py",
        REPO_ROOT / "docs/design/src/v9/template.html",
        REPO_ROOT / "docs/design/src/common/hub.js",
        REPO_ROOT / "docs/design/hub-mockup-v9.html",
        REPO_ROOT / "docs/design/ComForce-MKE-Hub-PROD-mockup.html",
    )
    forbidden = (
        "quick exit",
        "try exit",
        "try it now",
        "data-exit",
        "shake to exit",
        "press esc",
        "bus schedule",
    )

    for path in paths:
        content = path.read_text(encoding="utf-8").lower()
        for phrase in forbidden:
            assert phrase not in content, f"{path} still contains retired requirement: {phrase}"
