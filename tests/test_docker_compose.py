"""Unit tests verifying docker-compose.yml configuration and service definitions."""

import os
import shutil
import subprocess
from pathlib import Path

import yaml

COMPOSE_FILE = Path(__file__).resolve().parent.parent / "docker-compose.yml"
PRODUCTION_COMPOSE_FILE = Path(__file__).resolve().parent.parent / "docker-compose.prod.yml"


def test_compose_file_exists_and_is_valid_yaml() -> None:
    assert COMPOSE_FILE.is_file(), "docker-compose.yml must exist at repository root"
    with open(COMPOSE_FILE) as f:
        data = yaml.safe_load(f)
    assert isinstance(data, dict)
    assert "services" in data
    assert "volumes" in data


def test_services_and_ports_standardized() -> None:
    with open(COMPOSE_FILE) as f:
        data = yaml.safe_load(f)
    services = data["services"]

    assert "db" in services
    assert "api" in services
    assert "web" in services

    # Standardized ports: DB=5432, API=8000, Client/Web=3000
    assert any("5432:5432" in str(p) for p in services["db"]["ports"])
    assert any("8000:8000" in str(p) for p in services["api"]["ports"])
    assert any("3000:80" in str(p) or "3000:3000" in str(p) for p in services["web"]["ports"])


def test_api_volume_mount_for_live_reload() -> None:
    with open(COMPOSE_FILE) as f:
        data = yaml.safe_load(f)
    api = data["services"]["api"]
    volumes = api.get("volumes", [])
    assert any("./src/server:/app/src/server" in str(v) for v in volumes), (
        "API must mount ./src/server for development live reload"
    )


def test_dockerfiles_exist() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    assert (repo_root / "deploy/docker/Dockerfile.api").is_file()
    assert (repo_root / "deploy/docker/Dockerfile.web").is_file()
    assert (repo_root / "deploy/docker/nginx.conf").is_file()


def test_production_compose_override_resolves_secure_runtime() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    env = os.environ.copy()
    env["POSTGRES_PASSWORD"] = "test-only-production-password"

    if shutil.which("docker"):
        try:
            result = subprocess.run(
                [
                    "docker",
                    "compose",
                    "-f",
                    str(COMPOSE_FILE),
                    "-f",
                    str(PRODUCTION_COMPOSE_FILE),
                    "config",
                    "--format",
                    "json",
                ],
                cwd=repo_root,
                env=env,
                check=True,
                capture_output=True,
                text=True,
            )

            import json

            data = json.loads(result.stdout)
            db = data["services"]["db"]
            api = data["services"]["api"]

            assert not db.get("ports")
            assert db["environment"]["POSTGRES_PASSWORD"] == "test-only-production-password"
            assert api["environment"]["APP_ENV"] == "production"
            assert str(api["environment"]["DEBUG"]).lower() == "false"
            assert "@db:5432/comforce" in api["environment"]["DATABASE_URL"]
            assert not api.get("volumes")
            assert "--reload" not in api["command"]
            return
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

    class ResetSafeLoader(yaml.SafeLoader):
        pass

    ResetSafeLoader.add_constructor("!reset", lambda loader, node: loader.construct_sequence(node))
    with open(PRODUCTION_COMPOSE_FILE) as f:
        prod_data = yaml.load(f, Loader=ResetSafeLoader)

    db = prod_data["services"]["db"]
    api = prod_data["services"]["api"]

    assert db.get("ports") == []
    assert "POSTGRES_PASSWORD" in db["environment"]
    assert api["environment"]["APP_ENV"] == "production"
    assert str(api["environment"]["DEBUG"]).lower() == "false"
    assert "@db:5432/comforce" in api["environment"]["DATABASE_URL"]
    assert api.get("volumes") == []
    assert "--reload" not in api["command"]
