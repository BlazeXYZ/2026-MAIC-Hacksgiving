"""ComforceMKE FastAPI backend package."""

import sys
from pathlib import Path

# Ensure repository root is on sys.path when imported from within src/server
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
