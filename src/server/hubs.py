"""In-memory hubs: forums, replies, and staff-set trust scores.

Trust scores are never calculated here. A person only has one after a staffer
types it. The store resets when the process restarts; the client keeps a copy.
"""

from __future__ import annotations

import copy
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

SEED_PATH = Path(__file__).resolve().parents[2] / "data" / "processed" / "hubs.json"
ME_ID = "jordan"
STAFF_ROLES = {"employee", "coordinator"}

_ADDRESS = re.compile(
    r"\b\d{2,5}\s+(?:[NSEW]\.?\s+)?(?:[A-Za-z0-9.'\-]+\s+){1,3}"
    r"(?:st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|way|ct|court)\b",
    re.IGNORECASE,
)
_LIVE_AT = re.compile(
    r"\b(i live at|my address is|come to my (?:house|home|door)|drop (?:it |food |this )?at my (?:house|home|door))\b",
    re.IGNORECASE,
)
_PHONE = re.compile(r"\b(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}\b")
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")

_ANSWERS: tuple[tuple[str, tuple[str, ...], str], ...] = (
    (
        "food",
        ("formula", "diaper", "pantry", "hungry", "grocery", "grocer", "food", "bread"),
        "Open pantries on this hub's map are the first stop. Formula and diapers are short in Haymarket this week. A coordinator can turn this into a private request so your address stays off the thread.",
    ),
    (
        "missing",
        ("sector", "search", "missing", "rally", "tip"),
        "Check the live search thread and the Search grid before you head out. Pair with a lead at the rally point. Do not post a home address, and do not search alone on your first night.",
    ),
    (
        "domestic",
        ("line", "call", "safe", "exit", "sojourner", "staffed"),
        "Sojourner Family Peace Center answers 24/7 at 414-933-2722. ComForce answers at 414-395-0552. You do not need to say where you are. Quick Exit is the red button, or Esc on a computer.",
    ),
    (
        "rides",
        ("ride", "clinic", "driver", "seat", "pickup"),
        "Post a corner and a time on the Ride board, not a house number. The ride desk confirms the driver before you get in. Clinic names can stay on a private request.",
    ),
    (
        "youth",
        ("mentor", "circle", "thursday", "youth"),
        "Thursday circle doors open at 6. Young people come with a mentor. Do not post a young person's name, school, or address. Sam reads mentor requests.",
    ),
    (
        "disaster",
        ("shelter", "warm", "freeze", "cold", "lobby", "welfare"),
        "Warming rooms on the shelter map open only when ComForce calls a drop. Check News before you drive anyone over. Welfare checks stay on the blocks already assigned.",
    ),
    (
        "parents",
        ("childcare", "babysit", "swap", "diaper", "stroller"),
        "Post a public corner and a time. Last names and addresses stay off the thread. A parent volunteer confirms childcare before you leave a child with someone.",
    ),
    (
        "podcast",
        ("episode", "taping", "on air", "question"),
        "Questions for the live taping can be a thread on this hub. Say if your name should stay off the air. The show does not read addresses or anything from Domestic Safety.",
    ),
)


class ThreadIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=4000)


class ReplyIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    parent_id: str | None = None


class TrustIn(BaseModel):
    score: int | None = Field(default=None, ge=0, le=100)
    note: str | None = Field(default=None, max_length=280)


class SuggestionIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    audience: str = Field(min_length=1, max_length=120)
    why: str = Field(min_length=1, max_length=500)


class ToolItemIn(BaseModel):
    title: str = Field(min_length=1, max_length=180)


class ShareIn(BaseModel):
    what: str = Field(min_length=1, max_length=180)
    when: str = Field(min_length=1, max_length=120)
    posting_as: str = Field(default="Resident", max_length=40)


class ReviewIn(BaseModel):
    release: bool


_board: dict[str, Any] | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _stamp(minutes_ago: int) -> str:
    return (_now() - timedelta(minutes=minutes_ago)).isoformat()


def _load_seed() -> dict[str, Any]:
    raw = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    board = copy.deepcopy(raw)
    for key in ("threads", "replies", "news", "notices"):
        for row in board[key]:
            row["created_at"] = _stamp(int(row.pop("minutes_ago", 0)))
    for row in board["threads"]:
        row["helpful_by_me"] = False
    for row in board["replies"]:
        row["helpful_by_me"] = False
    for hub in board["hubs"]:
        hub["alerts"] = "important"
    board["suggestions"] = []
    board["me_id"] = ME_ID
    board["revision"] = 1
    return board


def reset_store() -> dict[str, Any]:
    global _board
    _board = _load_seed()
    return _board


def board() -> dict[str, Any]:
    global _board
    if _board is None:
        _board = _load_seed()
    return _board


def _bump() -> dict[str, Any]:
    data = board()
    data["revision"] = int(data["revision"]) + 1
    return data


def _person(person_id: str) -> dict[str, Any]:
    for person in board()["people"]:
        if person["id"] == person_id:
            return person
    raise HTTPException(status_code=404, detail="No person with that id")


def _hub(hub_id: str) -> dict[str, Any]:
    for hub in board()["hubs"]:
        if hub["id"] == hub_id:
            return hub
    raise HTTPException(status_code=404, detail="No hub with that id")


def _thread(thread_id: str) -> dict[str, Any]:
    for thread in board()["threads"]:
        if thread["id"] == thread_id:
            return thread
    raise HTTPException(status_code=404, detail="No thread with that id")


def _tool(tool_id: str) -> dict[str, Any]:
    for tool in board()["tools"]:
        if tool["id"] == tool_id:
            return tool
    raise HTTPException(status_code=404, detail="No tool with that id")


def hold_reason(text: str) -> str | None:
    """Posts with a home address, phone, or email stay off the public thread."""
    if _ADDRESS.search(text) or _LIVE_AT.search(text):
        return (
            "It included a home address. Take the address out and post again, "
            "or ask a coordinator to make a private request."
        )
    if _PHONE.search(text):
        return (
            "It included a phone number. Share that with ComForce, not the hub. "
            "Take the number out and post again."
        )
    if _EMAIL.search(text):
        return (
            "It included an email address. Take it out and post again. "
            "A coordinator can pass it along privately."
        )
    return None


def automatic_answer(hub_id: str, text: str) -> str | None:
    if "?" not in text:
        return None
    lowered = text.lower()
    for hub, words, answer in _ANSWERS:
        if hub == hub_id and any(word in lowered for word in words):
            return answer
    return None


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def create_thread(hub_id: str, title: str, body: str) -> dict[str, Any]:
    _hub(hub_id)
    reason = hold_reason(f"{title}\n{body}")
    thread = {
        "id": _new_id("thread"),
        "hub_id": hub_id,
        "author_id": ME_ID,
        "title": title.strip(),
        "body": body.strip(),
        "created_at": _stamp(0),
        "pinned": False,
        "helpful": 0,
        "helpful_by_me": False,
        "flair": "Question" if "?" in title else None,
        "steps": None,
        "ai_answer": None if reason else automatic_answer(hub_id, f"{title}\n{body}"),
        "held": reason is not None,
        "held_reason": reason,
    }
    data = _bump()
    data["threads"].insert(0, thread)
    return data


def create_reply(thread_id: str, body: str, parent_id: str | None) -> dict[str, Any]:
    thread = _thread(thread_id)
    if thread["held"]:
        raise HTTPException(status_code=409, detail="This post is held. It is not public yet.")
    reason = hold_reason(body)
    if reason:
        raise HTTPException(status_code=422, detail=reason)
    if parent_id is not None:
        parent = next((row for row in board()["replies"] if row["id"] == parent_id), None)
        if parent is None or parent["thread_id"] != thread_id:
            raise HTTPException(status_code=404, detail="That reply is not on this thread")
    reply = {
        "id": _new_id("reply"),
        "thread_id": thread_id,
        "author_id": ME_ID,
        "body": body.strip(),
        "created_at": _stamp(0),
        "parent_id": parent_id,
        "helpful": 0,
        "helpful_by_me": False,
    }
    data = _bump()
    data["replies"].append(reply)
    return data


def toggle_helpful(kind: str, item_id: str) -> dict[str, Any]:
    rows = board()["threads"] if kind == "thread" else board()["replies"]
    row = next((item for item in rows if item["id"] == item_id), None)
    if row is None:
        raise HTTPException(status_code=404, detail="Nothing to mark")
    if kind == "thread" and row["held"]:
        raise HTTPException(status_code=409, detail="Held posts are not public")
    if row["helpful_by_me"]:
        row["helpful"] = max(0, int(row["helpful"]) - 1)
        row["helpful_by_me"] = False
    else:
        row["helpful"] = int(row["helpful"]) + 1
        row["helpful_by_me"] = True
    return _bump()


def set_trust(person_id: str, score: int | None, note: str | None) -> dict[str, Any]:
    """Record a score a staffer typed. Nothing here inspects their posts."""
    person = _person(person_id)
    me = _person(ME_ID)
    if me["role"] not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Only ComForce staff set trust scores")
    person["trust_score"] = score
    person["trust_note"] = (note or "").strip() or None
    person["trust_set_by"] = me["name"] if score is not None else None
    return _bump()


def toggle_join(hub_id: str) -> dict[str, Any]:
    hub = _hub(hub_id)
    hub["joined"] = not bool(hub["joined"])
    if not hub["private"] and isinstance(hub.get("member_count"), int):
        hub["member_count"] += 1 if hub["joined"] else -1
    return _bump()


def set_alerts(hub_id: str, mode: str) -> dict[str, Any]:
    if mode not in {"important", "all", "off"}:
        raise HTTPException(status_code=422, detail="Alerts are important, all, or off")
    _hub(hub_id)["alerts"] = mode
    return _bump()


def add_suggestion(name: str, audience: str, why: str) -> dict[str, Any]:
    data = _bump()
    data["suggestions"].insert(
        0,
        {
            "id": _new_id("idea"),
            "name": name.strip(),
            "audience": audience.strip(),
            "why": why.strip(),
            "created_at": _stamp(0),
        },
    )
    return data


def review_thread(thread_id: str, release: bool) -> dict[str, Any]:
    thread = _thread(thread_id)
    if not thread["held"]:
        raise HTTPException(status_code=409, detail="This post is already public")
    if release:
        still = hold_reason(f"{thread['title']}\n{thread['body']}")
        if still:
            raise HTTPException(
                status_code=422,
                detail="The address, phone, or email is still in the post. It stays held.",
            )
        thread["held"] = False
        thread["held_reason"] = None
        thread["ai_answer"] = automatic_answer(
            thread["hub_id"], f"{thread['title']}\n{thread['body']}"
        )
    return _bump()


def claim_request(request_id: str) -> dict[str, Any]:
    for request in board()["requests"]:
        if request["id"] == request_id:
            if request["claimed_by"]:
                raise HTTPException(status_code=409, detail="Someone already took this")
            request["claimed_by"] = ME_ID
            return _bump()
    raise HTTPException(status_code=404, detail="No request with that id")


def add_tool_item(tool_id: str, title: str) -> dict[str, Any]:
    tool = _tool(tool_id)
    if tool["kind"] != "board":
        raise HTTPException(status_code=409, detail="This tool does not take new posts")
    me = _person(ME_ID)
    tool["items"].insert(
        0,
        {
            "id": _new_id("item"),
            "title": title.strip(),
            "meta": f"{me['name']} · just now",
            "status": "Open",
        },
    )
    return _bump()


def advance_item(tool_id: str, item_id: str) -> dict[str, Any]:
    tool = _tool(tool_id)
    item = next((row for row in tool["items"] if row["id"] == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="No row with that id")
    if tool["kind"] == "sectors":
        order = ["Pending", "Searching", "Cleared"]
        current = item.get("status", "Pending")
        item["status"] = order[(order.index(current) + 1) % len(order)] if current in order else "Searching"
    elif tool["kind"] == "checks":
        item["status"] = "Open" if item.get("status") == "Done" else "Done"
    elif tool["kind"] == "events":
        mine = not bool(item.get("mine"))
        item["mine"] = mine
        item["going"] = int(item.get("going") or 0) + (1 if mine else -1)
        item["status"] = "Going" if mine else "Listed"
    else:
        raise HTTPException(status_code=409, detail="Nothing to mark on this tool")
    return _bump()


def share_food(what: str, when: str, posting_as: str) -> dict[str, Any]:
    _hub("food")
    reason = hold_reason(f"{what}\n{when}")
    if reason:
        raise HTTPException(status_code=422, detail=reason)
    me = _person(ME_ID)
    place_id = _new_id("place")
    data = _bump()
    data["places"].insert(
        0,
        {
            "id": place_id,
            "hub_id": "food",
            "name": what.strip(),
            "detail": f"{posting_as.strip()} · {when.strip()}",
            "status": when.strip(),
            "open": True,
            "x": 48,
            "y": 52,
        },
    )
    data["threads"].insert(
        0,
        {
            "id": _new_id("thread"),
            "hub_id": "food",
            "author_id": ME_ID,
            "title": f"{what.strip()}, free",
            "body": f"Posted by {me['name']} as a {posting_as.strip().lower()}. Pickup: {when.strip()}. The address stays with the person who claims it.",
            "created_at": _stamp(0),
            "pinned": False,
            "helpful": 0,
            "helpful_by_me": False,
            "flair": "Offer",
            "steps": None,
            "ai_answer": None,
            "held": False,
            "held_reason": None,
        },
    )
    return data


def mark_notices_read() -> dict[str, Any]:
    for notice in board()["notices"]:
        notice["unread"] = False
    return _bump()


router = APIRouter(prefix="/api/hubs", tags=["hubs"])


@router.get("/board")
def get_board() -> dict[str, Any]:
    return board()


@router.post("/{hub_id}/threads")
def post_thread(hub_id: str, payload: ThreadIn) -> dict[str, Any]:
    return create_thread(hub_id, payload.title, payload.body)


@router.post("/threads/{thread_id}/replies")
def post_reply(thread_id: str, payload: ReplyIn) -> dict[str, Any]:
    return create_reply(thread_id, payload.body, payload.parent_id)


@router.post("/threads/{thread_id}/helpful")
def post_thread_helpful(thread_id: str) -> dict[str, Any]:
    return toggle_helpful("thread", thread_id)


@router.post("/replies/{reply_id}/helpful")
def post_reply_helpful(reply_id: str) -> dict[str, Any]:
    return toggle_helpful("reply", reply_id)


@router.post("/threads/{thread_id}/review")
def post_review(thread_id: str, payload: ReviewIn) -> dict[str, Any]:
    return review_thread(thread_id, payload.release)


@router.patch("/people/{person_id}/trust")
def patch_trust(person_id: str, payload: TrustIn) -> dict[str, Any]:
    return set_trust(person_id, payload.score, payload.note)


@router.post("/{hub_id}/join")
def post_join(hub_id: str) -> dict[str, Any]:
    return toggle_join(hub_id)


@router.post("/{hub_id}/alerts/{mode}")
def post_alerts(hub_id: str, mode: str) -> dict[str, Any]:
    return set_alerts(hub_id, mode)


@router.post("/suggestions")
def post_suggestion(payload: SuggestionIn) -> dict[str, Any]:
    return add_suggestion(payload.name, payload.audience, payload.why)


@router.post("/requests/{request_id}/claim")
def post_claim(request_id: str) -> dict[str, Any]:
    return claim_request(request_id)


@router.post("/tools/{tool_id}/items")
def post_tool_item(tool_id: str, payload: ToolItemIn) -> dict[str, Any]:
    return add_tool_item(tool_id, payload.title)


@router.post("/tools/{tool_id}/items/{item_id}/advance")
def post_advance(tool_id: str, item_id: str) -> dict[str, Any]:
    return advance_item(tool_id, item_id)


@router.post("/food/share")
def post_share(payload: ShareIn) -> dict[str, Any]:
    return share_food(payload.what, payload.when, payload.posting_as)


@router.post("/notices/read")
def post_notices_read() -> dict[str, Any]:
    return mark_notices_read()
