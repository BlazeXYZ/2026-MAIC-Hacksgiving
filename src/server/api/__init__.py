"""Versioned HTTP routers, one module per issue.

`mount_feature_routers` includes every module here that defines `router`.
Adding a module is enough to publish its routes once the app calls this.
"""

from __future__ import annotations

import importlib
import pkgutil

from fastapi import FastAPI


def mount_feature_routers(app: FastAPI) -> None:
    prefix = __name__
    for module_info in pkgutil.iter_modules(__path__):
        module = importlib.import_module(f"{prefix}.{module_info.name}")
        router = getattr(module, "router", None)
        if router is not None:
            app.include_router(router)
