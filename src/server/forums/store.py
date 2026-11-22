"""Process-local forum store.

One lock covers every read and write, like `intake/store.py` and
`inventory/store.py`. A restart, or `reset()`, goes back to the seed threads.
Nothing records who a poster is: authors are pseudonyms from `HANDLES`.

Missing-person cases live here too. Each case owns exactly one lead thread,
pinned while the case is active and locked once it is resolved. Every reply to
a lead thread is held for a coordinator, who publishes it as `Verified`, keeps
it private (coordinators only), or removes it.
"""

from __future__ import annotations

import secrets
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Literal

from src.server.ai.pii import scrub_pii
from src.server.forums.rules import (
    HUB_IDS,
    LEAD_TIP_NOTICE,
    automatic_answer,
    hold_reason,
    lead_tip_reason,
)
from src.server.forums.seed import SEED_CASES, SEED_THREADS, CaseStatus, Flair, Role

#: `private` is a lead tip a coordinator kept off the thread. Only coordinator
#: routes ever return it.
Status = Literal["published", "held", "private"]
Sort = Literal["hot", "new", "top"]
ReviewAction = Literal["publish", "keep_private", "remove"]

CASE_HUB = "missing-persons"

#: Pseudonyms handed to posters. Shared with the Search grid's volunteer names.
HANDLES: tuple[str, ...] = (
    "Lantern", "Maple", "Cedar", "Harbor", "Brook", "Willow", "Juniper", "Sparrow",
    "Aspen", "Birch", "Heron", "Linden", "Marigold", "Oriole", "Prairie", "Quarry",
    "Robin", "Sumac", "Thistle", "Wren",
)  # fmt: skip

COORDINATOR_HANDLE = "ComForce coordinator"


@dataclass
class Reply:
    id: str
    thread_id: str
    author: str
    role: Role
    body: str
    created_at: datetime
    parent_id: str | None
    helpful: int = 0
    status: Status = "published"
    held_reason: str | None = None
    flair: Flair | None = None
    #: Search grid sector a lead tip names, for example "C2". Lead tips only.
    sector: str | None = None


@dataclass
class Thread:
    id: str
    hub_id: str
    author: str
    role: Role
    title: str
    body: str
    created_at: datetime
    pinned: bool = False
    flair: Flair | None = None
    steps: list[str] | None = None
    answer: str | None = None
    helpful: int = 0
    status: Status = "published"
    held_reason: str | None = None
    replies: list[Reply] = field(default_factory=list)
    #: Set on a case's lead thread. Every reply to it is held.
    case_id: str | None = None
    #: A locked thread takes no new replies (its case is resolved).
    locked: bool = False

    def public_replies(self) -> list[Reply]:
        return [r for r in self.replies if r.status == "published"]


@dataclass
class Case:
    id: str
    display_name: str
    last_known_point: str
    status: CaseStatus
    thread_id: str
    created_at: datetime
    resolved_at: datetime | None = None


class ForumError(Exception):
    """Raised for a request the store cannot carry out. `status` maps to HTTP."""

    def __init__(self, status: int, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


_lock = threading.RLock()
_threads: dict[str, Thread] = {}
_cases: dict[str, Case] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(4)}"


def reset(now: datetime | None = None) -> None:
    """Drop every post and load the seed threads, dated relative to `now`."""
    now = now or _now()
    with _lock:
        _threads.clear()
        _cases.clear()
        for seed in SEED_THREADS:
            thread = Thread(
                id=seed["id"],
                hub_id=seed["hub_id"],
                author=seed["author"],
                role=seed["role"],
                title=seed["title"],
                body=seed["body"],
                created_at=now - timedelta(minutes=seed["minutes_ago"]),
                pinned=seed["pinned"],
                flair=seed["flair"],
                steps=list(seed["steps"]) if seed["steps"] else None,
                answer=seed["answer"],
                helpful=seed["helpful"],
            )
            for row in seed["replies"]:
                thread.replies.append(
                    Reply(
                        id=row["id"],
                        thread_id=thread.id,
                        author=row["author"],
                        role=row["role"],
                        body=row["body"],
                        created_at=now - timedelta(minutes=row["minutes_ago"]),
                        parent_id=row["parent_id"],
                        helpful=row["helpful"],
                    )
                )
            _threads[thread.id] = thread
        for seed_case in SEED_CASES:
            case = _open_case_locked(
                seed_case["display_name"],
                seed_case["last_known_point"],
                case_id=seed_case["id"],
                thread_id=f"lead-{seed_case['id']}",
                at=now - timedelta(minutes=seed_case["minutes_ago"]),
            )
            if seed_case["status"] == "resolved":
                _resolve_case_locked(case, now)


def _require_hub(hub_id: str) -> None:
    if hub_id not in HUB_IDS:
        raise ForumError(404, "No hub with that id.")


def _public_thread(thread_id: str) -> Thread:
    thread = _threads.get(thread_id)
    if thread is None or thread.status != "published":
        raise ForumError(404, "No thread with that id.")
    return thread


def _author(handle: str | None, coordinator: bool) -> tuple[str, Role]:
    if coordinator:
        return COORDINATOR_HANDLE, "coordinator"
    if handle in HANDLES:
        return handle, "neighbor"
    return secrets.choice(HANDLES), "neighbor"


def _hot_score(thread: Thread, now: datetime) -> float:
    hours = max(0.0, (now - thread.created_at).total_seconds() / 3600)
    return (thread.helpful + len(thread.public_replies()) + 1) / (hours + 2) ** 1.5


def list_threads(
    hub_id: str, sort: Sort = "hot", query: str | None = None
) -> tuple[list[Thread], int]:
    """Public threads in a hub, pinned first, and how many posts there are held."""
    _require_hub(hub_id)
    now = _now()
    needle = (query or "").strip().lower()
    with _lock:
        in_hub = [t for t in _threads.values() if t.hub_id == hub_id]
        held = sum(1 for t in in_hub if t.status == "held") + sum(
            1
            for t in in_hub
            if t.status == "published"
            for r in t.replies
            if r.status == "held"
        )
        public = [t for t in in_hub if t.status == "published"]
        if needle:
            public = [t for t in public if needle in f"{t.title}\n{t.body}".lower()]
        if sort == "new":
            public.sort(key=lambda t: t.created_at, reverse=True)
        elif sort == "top":
            public.sort(key=lambda t: (t.helpful, t.created_at), reverse=True)
        else:
            public.sort(key=lambda t: _hot_score(t, now), reverse=True)
        public.sort(key=lambda t: not t.pinned)  # stable: pinned first, sort order kept
        return public, held


def get_thread(thread_id: str) -> Thread:
    with _lock:
        return _public_thread(thread_id)


def create_thread(
    hub_id: str,
    title: str,
    body: str,
    handle: str | None = None,
    *,
    coordinator: bool = False,
    model_hold: str | None = None,
) -> Thread:
    """Post a thread. It is held instead of published when `hold_reason` objects.

    `model_hold` is the decision model's second opinion, already awaited by the
    caller; the local checks win when they hold, and a coordinator post never does.
    """
    _require_hub(hub_id)
    title, body = title.strip(), body.strip()
    reason = None if coordinator else (hold_reason(f"{title}\n{body}") or model_hold)
    author, role = _author(handle, coordinator)
    thread = Thread(
        id=_new_id("thread"),
        hub_id=hub_id,
        author=author,
        role=role,
        title=title,
        body=body,
        created_at=_now(),
        flair="Question" if "?" in title else None,
        answer=None if reason else automatic_answer(hub_id, f"{title}\n{body}"),
        status="held" if reason else "published",
        held_reason=reason,
    )
    with _lock:
        _threads[thread.id] = thread
    return thread


def create_reply(
    thread_id: str,
    body: str,
    parent_id: str | None = None,
    handle: str | None = None,
    *,
    coordinator: bool = False,
    sector: str | None = None,
    model_hold: str | None = None,
) -> Reply:
    """Reply to a public thread, or to a public reply on it.

    On a case's lead thread every neighbor reply is a tip and is held, whatever
    `hold_reason` says. A coordinator's own reply goes up directly. For a plain
    neighbor reply `model_hold` is the decision model's second opinion, already
    awaited by the caller; the local checks win when they hold.
    """
    body = body.strip()
    author, role = _author(handle, coordinator)
    with _lock:
        thread = _public_thread(thread_id)
        if thread.locked:
            raise ForumError(409, "This case is closed. The lead thread takes no new tips.")
        is_tip = thread.case_id is not None and not coordinator
        reason: str | None
        if coordinator:
            reason = None
        elif is_tip:
            reason = lead_tip_reason(body)
        else:
            reason = hold_reason(body) or model_hold
        if parent_id is not None and not any(
            r.id == parent_id and r.status == "published" for r in thread.replies
        ):
            raise ForumError(404, "That reply is not on this thread.")
        reply = Reply(
            id=_new_id("reply"),
            thread_id=thread_id,
            author=author,
            role=role,
            body=body,
            created_at=_now(),
            parent_id=parent_id,
            status="held" if reason else "published",
            held_reason=reason,
            sector=sector.strip().upper() if is_tip and sector and sector.strip() else None,
        )
        thread.replies.append(reply)
        return reply


def mark_helpful(
    kind: Literal["thread", "reply"], post_id: str, on: bool = True
) -> int:
    """Add (or take back) one helpful mark. Returns the new count."""
    with _lock:
        row: Thread | Reply | None
        if kind == "thread":
            row = _public_thread(post_id)
        else:
            row = next(
                (
                    r
                    for t in _threads.values()
                    if t.status == "published"
                    for r in t.replies
                    if r.id == post_id and r.status == "published"
                ),
                None,
            )
            if row is None:
                raise ForumError(404, "No reply with that id.")
        row.helpful = row.helpful + 1 if on else max(0, row.helpful - 1)
        return row.helpful


# ---------- coordinator review ----------


def held_posts() -> list[Thread | Reply]:
    """Every held thread and held reply, oldest first."""
    with _lock:
        rows: list[Thread | Reply] = [
            t for t in _threads.values() if t.status == "held"
        ]
        rows += [
            r
            for t in _threads.values()
            if t.status == "published"
            for r in t.replies
            if r.status == "held"
        ]
        rows.sort(key=lambda row: row.created_at)
        return rows


def thread_of(reply: Reply) -> Thread:
    with _lock:
        return _threads[reply.thread_id]


def private_tips() -> list[Reply]:
    """Lead tips a coordinator kept private, oldest first. Coordinator routes only."""
    with _lock:
        rows = [r for t in _threads.values() for r in t.replies if r.status == "private"]
        rows.sort(key=lambda row: row.created_at)
        return rows


def review(
    post_id: str, action: ReviewAction, body: str | None = None
) -> Thread | Reply | None:
    """Publish a held post with private details scrubbed, keep a tip private, or remove it.

    A coordinator may pass an edited `body`, for example to take out a
    "come to my house" line the scrubber cannot see. A published lead tip gets
    the `Verified` flair. `keep_private` only applies to lead tips: the tip
    stays with coordinators and never reaches a public route. Returns the
    post, or None once it has been removed.
    """
    edited = body.strip() if body and body.strip() else None
    with _lock:
        for thread in list(_threads.values()):
            if thread.id == post_id and thread.status == "held":
                if action == "keep_private":
                    raise ForumError(409, "Only a tip on a case lead thread can be kept private.")
                if action == "remove":
                    del _threads[thread.id]
                    return None
                thread.title = scrub_pii(thread.title)
                thread.body = scrub_pii(edited or thread.body)
                thread.status, thread.held_reason = "published", None
                thread.answer = automatic_answer(
                    thread.hub_id, f"{thread.title}\n{thread.body}"
                )
                return thread
            if thread.status != "published":
                continue
            for reply in thread.replies:
                if reply.id == post_id and reply.status == "held":
                    if action == "remove":
                        thread.replies.remove(reply)
                        return None
                    if action == "keep_private":
                        if thread.case_id is None:
                            raise ForumError(
                                409, "Only a tip on a case lead thread can be kept private."
                            )
                        if edited:
                            reply.body = edited
                        reply.status = "private"
                        return reply
                    reply.body = scrub_pii(edited or reply.body)
                    reply.status, reply.held_reason = "published", None
                    if thread.case_id is not None:
                        reply.flair = "Verified"
                    return reply
    raise ForumError(404, "No held post with that id.")


# ---------- missing-person cases ----------


def _open_case_locked(
    display_name: str,
    last_known_point: str,
    *,
    case_id: str | None = None,
    thread_id: str | None = None,
    at: datetime | None = None,
) -> Case:
    at = at or _now()
    case = Case(
        id=case_id or _new_id("case"),
        display_name=display_name,
        last_known_point=last_known_point,
        status="active",
        thread_id=thread_id or _new_id("lead"),
        created_at=at,
    )
    _threads[case.thread_id] = Thread(
        id=case.thread_id,
        hub_id=CASE_HUB,
        author=COORDINATOR_HANDLE,
        role="coordinator",
        title=f"Lead thread: {display_name}. Send tips here",
        body=(
            f"Last known point: {last_known_point}. Reply with what you saw, the nearest "
            f"corner or landmark, and the time. {LEAD_TIP_NOTICE}"
        ),
        created_at=at,
        pinned=True,
        flair="Alert",
        steps=[
            LEAD_TIP_NOTICE,
            "Say what you saw, the nearest corner or landmark, and when. Never a house number.",
            "Know the Search grid sector, like C2? Add it so a verified lead can mark it.",
        ],
        case_id=case.id,
    )
    _cases[case.id] = case
    return case


def _resolve_case_locked(case: Case, at: datetime) -> None:
    case.status, case.resolved_at = "resolved", at
    thread = _threads[case.thread_id]
    thread.locked, thread.pinned = True, False


def open_case(display_name: str, last_known_point: str) -> Case:
    """Open a case and its one pinned lead thread in the Missing Persons hub."""
    display_name, last_known_point = display_name.strip(), last_known_point.strip()
    if not display_name or not last_known_point:
        raise ForumError(422, "A case needs a display name and a last-known point.")
    if hold_reason(f"{display_name}\n{last_known_point}"):
        raise ForumError(
            422,
            "Use initials or a first name and a public corner. No address, phone, or email.",
        )
    with _lock:
        return _open_case_locked(display_name, last_known_point)


def resolve_case(case_id: str) -> Case:
    """Close a case. Its lead thread is unpinned and locked."""
    with _lock:
        case = _cases.get(case_id)
        if case is None:
            raise ForumError(404, "No case with that id.")
        if case.status == "active":
            _resolve_case_locked(case, _now())
        return case


def list_cases() -> list[Case]:
    """Every case, active first, newest first within each status."""
    with _lock:
        rows = sorted(_cases.values(), key=lambda c: c.created_at, reverse=True)
        rows.sort(key=lambda c: c.status != "active")
        return rows


reset()
