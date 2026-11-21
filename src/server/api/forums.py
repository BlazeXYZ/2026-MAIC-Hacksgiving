"""Hub forums API: threads, replies, helpful marks, and held-post review.

Anyone can read and post. A post with a home address, phone number, email,
or SSN, or one the abuse classifier flags, is held: it stays off the public
list until a coordinator publishes it (with private details scrubbed) or
removes it. Routes under `/admin` sit behind `X-Coordinator-Key`. Posts sent
with a valid key are labeled as ComForce staff and skip the hold.

Missing-person cases: each active case has one pinned lead thread in the
Missing Persons hub. Every neighbor reply to it is a tip and is held, whatever
the usual check says. A coordinator publishes it as `Verified` (scrubbed),
keeps it private (it then only shows on `/admin/private-tips`), or removes it.
"""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Literal, NoReturn

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from src.server.ai.hotspots import (
    get_coordinator_api_key,
    require_coordinator,
)
from src.server.forums import store
from src.server.forums.rules import HUB_IDS

router = APIRouter(prefix="/api/v1/forums", tags=["forums"])
admin = APIRouter(
    prefix="/admin", tags=["forums-admin"], dependencies=[Depends(require_coordinator)]
)


# ---------- shapes ----------


class ReplyOut(BaseModel):
    id: str
    thread_id: str
    author: str
    role: str
    body: str
    created_at: datetime
    parent_id: str | None
    helpful: int
    flair: str | None = None
    sector: str | None = Field(
        default=None, description="Search grid sector a lead tip names, like C2."
    )


class ThreadSummary(BaseModel):
    id: str
    hub_id: str
    author: str
    role: str
    title: str
    body: str
    created_at: datetime
    pinned: bool
    flair: str | None
    steps: list[str] | None
    answer: str | None = Field(
        description="An automatic answer for a common question or crisis wording."
    )
    helpful: int
    reply_count: int
    case_id: str | None = Field(
        default=None, description="Set on a case's lead thread. Replies are held."
    )
    locked: bool = Field(
        default=False, description="A resolved case's lead thread takes no replies."
    )


class ThreadDetail(ThreadSummary):
    replies: list[ReplyOut]


class ThreadList(BaseModel):
    hub_id: str
    threads: list[ThreadSummary]
    held_count: int = Field(
        description="Posts in this hub waiting for a coordinator. Their text is never shown here."
    )


class PostResult(BaseModel):
    """What the author sees after posting. A held post is not public yet."""

    status: Literal["published", "held"]
    held_reason: str | None
    handle: str = Field(
        description="The pseudonym this post went up under. Send it back to keep it."
    )


class ThreadPosted(PostResult):
    thread: ThreadSummary


class ReplyPosted(PostResult):
    reply: ReplyOut


class ThreadCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=1, max_length=2000)
    handle: str | None = Field(
        default=None, max_length=40, description="A pseudonym from an earlier post."
    )


class ReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)
    parent_id: str | None = Field(default=None, max_length=40)
    handle: str | None = Field(default=None, max_length=40)
    sector: str | None = Field(
        default=None,
        pattern=r"^\s*[A-Za-z][0-9]{1,2}\s*$",
        description="Optional Search grid sector for a lead tip, like C2.",
    )


class HelpfulIn(BaseModel):
    on: bool = True


class HelpfulOut(BaseModel):
    helpful: int


class HeldPost(BaseModel):
    id: str
    kind: Literal["thread", "reply"]
    hub_id: str
    thread_id: str
    thread_title: str
    author: str
    title: str | None
    body: str
    held_reason: str
    created_at: datetime
    case_id: str | None = Field(
        default=None, description="Set when this is a tip on a case lead thread."
    )
    sector: str | None = None


class PrivateTip(BaseModel):
    id: str
    case_id: str
    thread_id: str
    thread_title: str
    author: str
    body: str
    sector: str | None
    created_at: datetime


class CaseOut(BaseModel):
    id: str
    display_name: str
    last_known_point: str
    status: Literal["active", "resolved"]
    thread_id: str
    created_at: datetime
    resolved_at: datetime | None


class CaseCreate(BaseModel):
    display_name: str = Field(
        min_length=1, max_length=40, description="Initials or a first name and age."
    )
    last_known_point: str = Field(
        min_length=3, max_length=120, description="A public corner or landmark."
    )


class ReviewIn(BaseModel):
    action: Literal["publish", "keep_private", "remove"]
    body: str | None = Field(
        default=None,
        max_length=2000,
        description="Optional edited text to publish instead.",
    )


class ReviewOut(BaseModel):
    id: str
    action: Literal["publish", "keep_private", "remove"]
    body: str | None = Field(
        description="The text as published, after scrubbing. None when removed."
    )


# ---------- helpers ----------


def _fail(err: store.ForumError) -> NoReturn:
    raise HTTPException(status_code=err.status, detail=err.detail) from err


def _is_coordinator(key: str | None) -> bool:
    active_key = get_coordinator_api_key()
    return active_key is not None and key is not None and secrets.compare_digest(key, active_key)


def _reply_out(reply: store.Reply) -> ReplyOut:
    return ReplyOut(
        id=reply.id,
        thread_id=reply.thread_id,
        author=reply.author,
        role=reply.role,
        body=reply.body,
        created_at=reply.created_at,
        parent_id=reply.parent_id,
        helpful=reply.helpful,
        flair=reply.flair,
        sector=reply.sector,
    )


def _summary(thread: store.Thread) -> ThreadSummary:
    return ThreadSummary(
        id=thread.id,
        hub_id=thread.hub_id,
        author=thread.author,
        role=thread.role,
        title=thread.title,
        body=thread.body,
        created_at=thread.created_at,
        pinned=thread.pinned,
        flair=thread.flair,
        steps=thread.steps,
        answer=thread.answer,
        helpful=thread.helpful,
        reply_count=len(thread.public_replies()),
        case_id=thread.case_id,
        locked=thread.locked,
    )


def _case_out(case: store.Case) -> CaseOut:
    return CaseOut(
        id=case.id,
        display_name=case.display_name,
        last_known_point=case.last_known_point,
        status=case.status,
        thread_id=case.thread_id,
        created_at=case.created_at,
        resolved_at=case.resolved_at,
    )


def _detail(thread: store.Thread) -> ThreadDetail:
    replies = sorted(thread.public_replies(), key=lambda r: r.created_at)
    return ThreadDetail(
        **_summary(thread).model_dump(), replies=[_reply_out(r) for r in replies]
    )


# ---------- public ----------


@router.get("/hubs", response_model=list[str])
def hubs() -> list[str]:
    """Hub ids that have a forum."""
    return list(HUB_IDS)


@router.get("/hubs/{hub_id}/threads", response_model=ThreadList)
def list_threads(
    hub_id: str,
    sort: Literal["hot", "new", "top"] = "hot",
    q: str | None = Query(default=None, max_length=80),
) -> ThreadList:
    try:
        threads, held = store.list_threads(hub_id, sort, q)
    except store.ForumError as err:
        _fail(err)
    return ThreadList(
        hub_id=hub_id, threads=[_summary(t) for t in threads], held_count=held
    )


@router.post("/hubs/{hub_id}/threads", response_model=ThreadPosted, status_code=201)
def create_thread(
    hub_id: str,
    body: ThreadCreate,
    x_coordinator_key: str | None = Header(default=None, alias="X-Coordinator-Key"),
) -> ThreadPosted:
    try:
        thread = store.create_thread(
            hub_id,
            body.title,
            body.body,
            body.handle,
            coordinator=_is_coordinator(x_coordinator_key),
        )
    except store.ForumError as err:
        _fail(err)
    return ThreadPosted(
        status=thread.status,
        held_reason=thread.held_reason,
        handle=thread.author,
        thread=_summary(thread),
    )


@router.get("/threads/{thread_id}", response_model=ThreadDetail)
def get_thread(thread_id: str) -> ThreadDetail:
    try:
        return _detail(store.get_thread(thread_id))
    except store.ForumError as err:
        _fail(err)


@router.post(
    "/threads/{thread_id}/replies", response_model=ReplyPosted, status_code=201
)
def create_reply(
    thread_id: str,
    body: ReplyCreate,
    x_coordinator_key: str | None = Header(default=None, alias="X-Coordinator-Key"),
) -> ReplyPosted:
    try:
        reply = store.create_reply(
            thread_id,
            body.body,
            body.parent_id,
            body.handle,
            coordinator=_is_coordinator(x_coordinator_key),
            sector=body.sector,
        )
    except store.ForumError as err:
        _fail(err)
    return ReplyPosted(
        status=reply.status,
        held_reason=reply.held_reason,
        handle=reply.author,
        reply=_reply_out(reply),
    )


@router.post("/threads/{thread_id}/helpful", response_model=HelpfulOut)
def thread_helpful(thread_id: str, body: HelpfulIn | None = None) -> HelpfulOut:
    try:
        return HelpfulOut(
            helpful=store.mark_helpful("thread", thread_id, body.on if body else True)
        )
    except store.ForumError as err:
        _fail(err)


@router.post("/replies/{reply_id}/helpful", response_model=HelpfulOut)
def reply_helpful(reply_id: str, body: HelpfulIn | None = None) -> HelpfulOut:
    try:
        return HelpfulOut(
            helpful=store.mark_helpful("reply", reply_id, body.on if body else True)
        )
    except store.ForumError as err:
        _fail(err)


@router.get("/cases", response_model=list[CaseOut])
def cases() -> list[CaseOut]:
    """Missing-person cases and their lead threads. Display names only."""
    return [_case_out(c) for c in store.list_cases()]


# ---------- coordinator ----------


@admin.get("/held", response_model=list[HeldPost])
def held() -> list[HeldPost]:
    rows: list[HeldPost] = []
    for post in store.held_posts():
        if isinstance(post, store.Thread):
            rows.append(
                HeldPost(
                    id=post.id,
                    kind="thread",
                    hub_id=post.hub_id,
                    thread_id=post.id,
                    thread_title=post.title,
                    author=post.author,
                    title=post.title,
                    body=post.body,
                    held_reason=post.held_reason or "",
                    created_at=post.created_at,
                )
            )
        else:
            parent = store.thread_of(post)
            rows.append(
                HeldPost(
                    id=post.id,
                    kind="reply",
                    hub_id=parent.hub_id,
                    thread_id=parent.id,
                    thread_title=parent.title,
                    author=post.author,
                    title=None,
                    body=post.body,
                    held_reason=post.held_reason or "",
                    created_at=post.created_at,
                    case_id=parent.case_id,
                    sector=post.sector,
                )
            )
    return rows


@admin.get("/private-tips", response_model=list[PrivateTip])
def private_tips() -> list[PrivateTip]:
    """Lead tips kept private, for example ones passed to police."""
    rows: list[PrivateTip] = []
    for tip in store.private_tips():
        parent = store.thread_of(tip)
        rows.append(
            PrivateTip(
                id=tip.id,
                case_id=parent.case_id or "",
                thread_id=parent.id,
                thread_title=parent.title,
                author=tip.author,
                body=tip.body,
                sector=tip.sector,
                created_at=tip.created_at,
            )
        )
    return rows


@admin.post("/cases", response_model=CaseOut, status_code=201)
def open_case(body: CaseCreate) -> CaseOut:
    """Open a case. Its pinned lead thread goes up in the Missing Persons hub."""
    try:
        return _case_out(store.open_case(body.display_name, body.last_known_point))
    except store.ForumError as err:
        _fail(err)


@admin.post("/cases/{case_id}/resolve", response_model=CaseOut)
def resolve_case(case_id: str) -> CaseOut:
    """Close a case. Its lead thread is unpinned and locked."""
    try:
        return _case_out(store.resolve_case(case_id))
    except store.ForumError as err:
        _fail(err)


@admin.post("/held/{post_id}/review", response_model=ReviewOut)
def review(post_id: str, body: ReviewIn) -> ReviewOut:
    try:
        post = store.review(post_id, body.action, body.body)
    except store.ForumError as err:
        _fail(err)
    return ReviewOut(
        id=post_id, action=body.action, body=post.body if post is not None else None
    )


router.include_router(admin)
