"""Patch the Capacitor Android and iOS projects for the demo shell."""

from __future__ import annotations

import os
import plistlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLIENT = ROOT / "src" / "client"
TEMPLATES = Path(__file__).resolve().parent / "templates"


def escape_properties(value: str) -> str:
    return value.replace("\\", "\\\\").replace(":", "\\:").replace(" ", "\\ ")


def patch_android() -> None:
    gradle = CLIENT / "android" / "app" / "build.gradle"
    if not gradle.is_file():
        return
    text = gradle.read_text()
    if 'abiFilters "arm64-v8a"' not in text:
        needle = "versionName "
        idx = text.find(needle)
        if idx == -1:
            raise SystemExit(f"Could not find versionName in {gradle}")
        line_end = text.find("\n", idx)
        insert = "\n        ndk {\n            abiFilters \"arm64-v8a\"\n        }"
        text = text[: line_end] + insert + text[line_end:]
        gradle.write_text(text)

    manifest = CLIENT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
    xml = manifest.read_text()
    if "usesCleartextTraffic" not in xml:
        xml = xml.replace(
            "<application",
            '<application\n        android:usesCleartextTraffic="true"',
            1,
        )
    for permission in (
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
    ):
        tag = f'<uses-permission android:name="{permission}" />'
        if permission not in xml:
            xml = xml.replace("</manifest>", f"    {tag}\n</manifest>")
    manifest.write_text(xml)

    activities = list((CLIENT / "android").rglob("MainActivity.java"))
    if len(activities) != 1:
        raise SystemExit(f"Expected one MainActivity.java, found {activities}")
    activity = activities[0]
    package_line = next(
        line for line in activity.read_text().splitlines() if line.startswith("package ")
    )
    package_name = package_line.removeprefix("package ").removesuffix(";").strip()
    source = (TEMPLATES / "MainActivity.java").read_text().replace("PACKAGE_NAME", package_name)
    activity.write_text(source)

    sdk = os.environ.get("ANDROID_HOME", "").strip()
    if sdk:
        props = CLIENT / "android" / "local.properties"
        props.write_text(f"sdk.dir={escape_properties(sdk)}\n")


def patch_ios() -> None:
    plist_path = CLIENT / "ios" / "App" / "App" / "Info.plist"
    delegate = CLIENT / "ios" / "App" / "App" / "AppDelegate.swift"
    if not plist_path.is_file():
        return
    with plist_path.open("rb") as handle:
        info = plistlib.load(handle)
    info["NSAppTransportSecurity"] = {"NSAllowsArbitraryLoads": True}
    info["NSLocationWhenInUseUsageDescription"] = (
        "ComForce uses your location to show nearby safe places, pantries, and search sectors."
    )
    info["UIRequiredDeviceCapabilities"] = ["arm64"]
    with plist_path.open("wb") as handle:
        plistlib.dump(info, handle)
    if delegate.is_file():
        delegate.write_text((TEMPLATES / "AppDelegate.swift").read_text())


def main() -> None:
    patch_android()
    patch_ios()


if __name__ == "__main__":
    main()
