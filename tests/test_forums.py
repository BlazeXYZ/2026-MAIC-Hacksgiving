"""Hub forums: seed threads, posting, held posts, helpful marks, and coordinator review."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.server.ai.hotspots import COORDINATOR_API_KEY
from src.server.ai.pii import REDACTION_PLACEHOLDER
from src.server.api.forums import router
from src.server.forums import rules, store

app = FastAPI()
app.include_router(router)
client = TestClient(app)
COORD = {"X-Coordinator-Key": COORDINATOR_API_KEY}
BASE = "/api/v1/forums"

# Synthetic details only: 555 exchange and a made-up street.
FAKE_ADDRESS = "1200 N Example St"
FAKE_PHONE = "414-555-0199"


@pytest.fixture(autouse=True)
def fresh_store() -> None:
    store.reset()


def threads(hub: str, **params: str) -> dict:
    res = client.get(f"{BASE}/hubs/{hub}/threads", params=params)
    assert res.status_code == 200, res.text
    return res.json()


def post_thread(
    hub: str = "food-pantry",
    title: str = "Anyone have spare bread?",
    body: str = "Two loaves.",
    **extra: object,
) -> dict:
    res = client.post(
        f"{BASE}/hubs/{hub}/threads", json={"title": title, "body": body, **extra}
    )
    assert res.status_code == 201, res.text
    return res.json()


# ---------- reading ----------


def test_every_hub_has_seed_threads_with_the_welcome_post_pinned_first() -> None:
    for hub in rules.HUB_IDS:
        listing = threads(hub)
        assert listing["threads"], hub
        first = listing["threads"][0]
        assert first["pinned"] is True
        assert first["steps"]
        assert listing["held_count"] == 0


def test_unknown_hub_is_404() -> None:
    assert client.get(f"{BASE}/hubs/nope/threads").status_code == 404
    assert (
        client.post(
            f"{BASE}/hubs/nope/threads", json={"title": "Hi there", "body": "x"}
        ).status_code
        == 404
    )


def test_thread_detail_lists_replies_oldest_first_with_nesting() -> None:
    detail = client.get(f"{BASE}/threads/missing-live").json()
    assert detail["reply_count"] == len(detail["replies"]) == 3
    times = [r["created_at"] for r in detail["replies"]]
    assert times == sorted(times)
    nested = [r for r in detail["replies"] if r["parent_id"]]
    assert nested and nested[0]["parent_id"] == "reply-live-1"


def test_sort_new_and_top_keep_pinned_first() -> None:
    new = threads("food-pantry", sort="new")["threads"]
    assert new[0]["pinned"]
    rest = [t["created_at"] for t in new[1:]]
    assert rest == sorted(rest, reverse=True)
    top = threads("food-pantry", sort="top")["threads"]
    helpful = [t["helpful"] for t in top[1:]]
    assert helpful == sorted(helpful, reverse=True)


def test_search_filters_by_title_and_body() -> None:
    found = threads("food-pantry", q="formula")["threads"]
    assert [t["id"] for t in found] == ["food-formula"]


def test_seed_text_carries_no_private_details() -> None:
    for hub in rules.HUB_IDS:
        for summary in threads(hub)["threads"]:
            detail = client.get(f"{BASE}/threads/{summary['id']}").json()
            texts = [
                detail["title"],
                detail["body"],
                *(r["body"] for r in detail["replies"]),
            ]
            for text in texts:
                reason = rules.hold_reason(text)
                # Only the ComForce hotline (a public line) may appear.
                assert reason is None or rules.COMFORCE_HOTLINE in text, text


# ---------- posting ----------


def test_clean_thread_is_published_under_a_pseudonym() -> None:
    posted = post_thread()
    assert posted["status"] == "published"
    assert posted["handle"] in store.HANDLES
    assert posted["thread"]["author"] == posted["handle"]
    ids = [t["id"] for t in threads("food-pantry", sort="new")["threads"]]
    assert posted["thread"]["id"] in ids


def test_handle_from_an_earlier_post_is_kept_and_unknown_handles_are_replaced() -> None:
    first = post_thread()
    again = post_thread(handle=first["handle"])
    assert again["handle"] == first["handle"]
    named = post_thread(handle="Jane Q. Resident")
    assert named["handle"] in store.HANDLES


@pytest.mark.parametrize(
    ("body", "word"),
    [
        (f"Please drop diapers at {FAKE_ADDRESS}.", "address"),
        ("I live at the blue house on the corner, come by.", "address"),
        (f"Text me at {FAKE_PHONE}.", "phone"),
        ("Email me at someone@example.com", "email"),
    ],
)
def test_private_details_hold_the_thread_and_say_why(body: str, word: str) -> None:
    posted = post_thread(title="Need diapers", body=body)
    assert posted["status"] == "held"
    assert word in posted["held_reason"]
    listing = threads("food-pantry")
    assert posted["thread"]["id"] not in [t["id"] for t in listing["threads"]]
    assert listing["held_count"] == 1
    assert client.get(f"{BASE}/threads/{posted['thread']['id']}").status_code == 404


def test_abusive_post_is_held_for_review() -> None:
    posted = post_thread(title="Watch your back", body="I know who you are.")
    assert posted["status"] == "held"
    assert posted["held_reason"] == rules.MODERATION_REASON


def test_question_gets_an_automatic_answer_and_flair() -> None:
    posted = post_thread(
        hub="missing-persons",
        title="Which sector should I search?",
        body="Free after 6.",
    )
    assert posted["thread"]["flair"] == "Question"
    assert posted["thread"]["answer"] and "Search grid" in posted["thread"]["answer"]


def test_crisis_wording_gets_the_hotline_in_any_hub() -> None:
    posted = post_thread(
        hub="food-pantry", title="Rough night", body="Honestly I am not safe at home."
    )
    assert posted["status"] == "published"
    assert rules.COMFORCE_HOTLINE in posted["thread"]["answer"]


def test_coordinator_posts_are_labeled_and_skip_the_hold() -> None:
    res = client.post(
        f"{BASE}/hubs/domestic-safety/threads",
        json={
            "title": "Line is staffed",
            "body": f"Call ComForce at {rules.COMFORCE_HOTLINE}.",
        },
        headers=COORD,
    )
    assert res.status_code == 201
    posted = res.json()
    assert posted["status"] == "published"
    assert posted["thread"]["author"] == store.COORDINATOR_HANDLE
    assert posted["thread"]["role"] == "coordinator"


def test_a_wrong_key_posts_as_a_neighbor() -> None:
    res = client.post(
        f"{BASE}/hubs/food-pantry/threads",
        json={"title": "Hello there", "body": f"Call me {FAKE_PHONE}"},
        headers={"X-Coordinator-Key": "guess"},
    )
    assert res.json()["status"] == "held"
    assert res.json()["thread"]["role"] == "neighbor"


def test_reply_and_reply_to_a_reply() -> None:
    res = client.post(f"{BASE}/threads/food-bread/replies", json={"body": "On my way."})
    assert res.status_code == 201 and res.json()["status"] == "published"
    reply_id = res.json()["reply"]["id"]
    nested = client.post(
        f"{BASE}/threads/food-bread/replies",
        json={"body": "Me too.", "parent_id": reply_id},
    )
    assert nested.json()["reply"]["parent_id"] == reply_id
    detail = client.get(f"{BASE}/threads/food-bread").json()
    assert {reply_id, nested.json()["reply"]["id"]} <= {
        r["id"] for r in detail["replies"]
    }


def test_reply_to_a_parent_on_another_thread_is_404() -> None:
    res = client.post(
        f"{BASE}/threads/food-bread/replies",
        json={"body": "Hi", "parent_id": "reply-live-1"},
    )
    assert res.status_code == 404


def test_held_reply_stays_off_the_thread() -> None:
    res = client.post(
        f"{BASE}/threads/food-bread/replies",
        json={"body": f"Bring it to {FAKE_ADDRESS}"},
    )
    assert res.json()["status"] == "held"
    detail = client.get(f"{BASE}/threads/food-bread").json()
    assert res.json()["reply"]["id"] not in [r["id"] for r in detail["replies"]]
    assert threads("food-pantry")["held_count"] == 1


def test_cannot_reply_to_a_held_thread() -> None:
    held = post_thread(body=f"At {FAKE_ADDRESS}")
    res = client.post(
        f"{BASE}/threads/{held['thread']['id']}/replies", json={"body": "ok"}
    )
    assert res.status_code == 404


def test_validation_rejects_empty_and_oversized_posts() -> None:
    assert (
        client.post(
            f"{BASE}/hubs/food-pantry/threads", json={"title": "", "body": "x"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"{BASE}/hubs/food-pantry/threads",
            json={"title": "Fine", "body": "x" * 2001},
        ).status_code
        == 422
    )
    assert (
        client.post(f"{BASE}/threads/food-bread/replies", json={"body": ""}).status_code
        == 422
    )


# ---------- helpful ----------


def test_helpful_adds_and_takes_back() -> None:
    before = client.get(f"{BASE}/threads/food-bread").json()["helpful"]
    assert (
        client.post(f"{BASE}/threads/food-bread/helpful").json()["helpful"]
        == before + 1
    )
    assert (
        client.post(f"{BASE}/threads/food-bread/helpful", json={"on": False}).json()[
            "helpful"
        ]
        == before
    )
    assert client.post(f"{BASE}/replies/reply-bread-1/helpful").json()["helpful"] == 5


def test_helpful_on_missing_or_held_posts_is_404() -> None:
    assert client.post(f"{BASE}/threads/nope/helpful").status_code == 404
    assert client.post(f"{BASE}/replies/nope/helpful").status_code == 404
    held = post_thread(body=f"At {FAKE_ADDRESS}")
    assert (
        client.post(f"{BASE}/threads/{held['thread']['id']}/helpful").status_code == 404
    )


# ---------- coordinator review ----------


def test_admin_routes_need_the_coordinator_key() -> None:
    assert client.get(f"{BASE}/admin/held").status_code == 403
    assert (
        client.get(
            f"{BASE}/admin/held", headers={"X-Coordinator-Key": "guess"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"{BASE}/admin/held/x/review", json={"action": "remove"}
        ).status_code
        == 403
    )


def test_coordinator_sees_held_threads_and_replies_with_reasons() -> None:
    held_thread = post_thread(body=f"Drop it at {FAKE_ADDRESS}")
    held_reply = client.post(
        f"{BASE}/threads/missing-live/replies", json={"body": f"Call {FAKE_PHONE}"}
    ).json()
    rows = client.get(f"{BASE}/admin/held", headers=COORD).json()
    by_id = {row["id"]: row for row in rows}
    assert by_id[held_thread["thread"]["id"]]["kind"] == "thread"
    reply_row = by_id[held_reply["reply"]["id"]]
    assert reply_row["kind"] == "reply"
    assert reply_row["thread_id"] == "missing-live"
    assert reply_row["hub_id"] == "missing-persons"
    assert all(row["held_reason"] for row in rows)


def test_publish_scrubs_private_details() -> None:
    held = post_thread(body=f"Drop it at {FAKE_ADDRESS} please")
    thread_id = held["thread"]["id"]
    res = client.post(
        f"{BASE}/admin/held/{thread_id}/review",
        json={"action": "publish"},
        headers=COORD,
    )
    assert res.status_code == 200
    assert FAKE_ADDRESS not in res.json()["body"]
    assert REDACTION_PLACEHOLDER in res.json()["body"]
    detail = client.get(f"{BASE}/threads/{thread_id}").json()
    assert FAKE_ADDRESS not in detail["body"]
    assert threads("food-pantry")["held_count"] == 0


def test_publish_with_an_edit_uses_the_coordinators_text() -> None:
    held = post_thread(body="I live at the blue house, come by")
    res = client.post(
        f"{BASE}/admin/held/{held['thread']['id']}/review",
        json={
            "action": "publish",
            "body": "Can someone drop off bread? A coordinator has my details.",
        },
        headers=COORD,
    )
    assert res.json()["body"].startswith("Can someone drop off bread?")


def test_publish_a_held_reply() -> None:
    held = client.post(
        f"{BASE}/threads/food-bread/replies", json={"body": f"Call {FAKE_PHONE}"}
    ).json()
    reply_id = held["reply"]["id"]
    client.post(
        f"{BASE}/admin/held/{reply_id}/review",
        json={"action": "publish"},
        headers=COORD,
    )
    replies = client.get(f"{BASE}/threads/food-bread").json()["replies"]
    published = next(r for r in replies if r["id"] == reply_id)
    assert FAKE_PHONE not in published["body"]


def test_remove_deletes_the_held_post() -> None:
    held = post_thread(body=f"At {FAKE_ADDRESS}")
    thread_id = held["thread"]["id"]
    res = client.post(
        f"{BASE}/admin/held/{thread_id}/review",
        json={"action": "remove"},
        headers=COORD,
    )
    assert res.json() == {"id": thread_id, "action": "remove", "body": None}
    assert client.get(f"{BASE}/admin/held", headers=COORD).json() == []
    again = client.post(
        f"{BASE}/admin/held/{thread_id}/review",
        json={"action": "remove"},
        headers=COORD,
    )
    assert again.status_code == 404


def test_reviewing_a_published_post_is_404() -> None:
    res = client.post(
        f"{BASE}/admin/held/food-bread/review", json={"action": "remove"}, headers=COORD
    )
    assert res.status_code == 404


def test_reset_goes_back_to_the_seed() -> None:
    post_thread()
    store.reset()
    ids = {t["id"] for t in threads("food-pantry")["threads"]}
    assert ids == {"food-welcome", "food-formula", "food-bread", "food-porch"}
