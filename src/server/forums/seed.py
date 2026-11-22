"""Synthetic starter threads for each hub.

Every name here is a pseudonym and every place is a public corner or a
listed service. The missing-persons threads follow the same sample case as
the alert banner and the Search grid (sector C2 holds the lead).

`SEED_CASES` holds the one synthetic missing-person case. The store opens a
pinned lead thread for each case when it loads.
"""

from __future__ import annotations

from typing import Literal, TypedDict

Role = Literal["neighbor", "volunteer", "coordinator", "organization"]
Flair = Literal["Alert", "Question", "Offer", "Verified", "Event"]
CaseStatus = Literal["active", "resolved"]


class SeedCase(TypedDict):
    id: str
    display_name: str
    last_known_point: str
    status: CaseStatus
    minutes_ago: int


class SeedReply(TypedDict):
    id: str
    author: str
    role: Role
    body: str
    minutes_ago: int
    parent_id: str | None
    helpful: int


class SeedThread(TypedDict):
    id: str
    hub_id: str
    author: str
    role: Role
    title: str
    body: str
    minutes_ago: int
    pinned: bool
    flair: Flair | None
    steps: list[str] | None
    answer: str | None
    helpful: int
    replies: list[SeedReply]


def _reply(
    id: str,
    author: str,
    role: Role,
    body: str,
    minutes_ago: int,
    helpful: int = 0,
    parent_id: str | None = None,
) -> SeedReply:
    return {
        "id": id,
        "author": author,
        "role": role,
        "body": body,
        "minutes_ago": minutes_ago,
        "parent_id": parent_id,
        "helpful": helpful,
    }


def _thread(
    id: str,
    hub_id: str,
    author: str,
    role: Role,
    title: str,
    body: str,
    minutes_ago: int,
    *,
    helpful: int = 0,
    pinned: bool = False,
    flair: Flair | None = None,
    steps: list[str] | None = None,
    answer: str | None = None,
    replies: list[SeedReply] | None = None,
) -> SeedThread:
    return {
        "id": id,
        "hub_id": hub_id,
        "author": author,
        "role": role,
        "title": title,
        "body": body,
        "minutes_ago": minutes_ago,
        "pinned": pinned,
        "flair": flair,
        "steps": steps,
        "answer": answer,
        "helpful": helpful,
        "replies": replies or [],
    }


SEED_THREADS: tuple[SeedThread, ...] = (
    # ---------- missing persons ----------
    _thread(
        "missing-welcome",
        "missing-persons",
        "Denise",
        "coordinator",
        "New here? How a search works",
        "Read this before you post a tip.",
        6000,
        helpful=40,
        pinned=True,
        steps=[
            "Send tips to a coordinator first. Only verified updates go on the thread, so rumors do not spread.",
            "Claim a sector on the Search grid, then mark it searching or cleared.",
            "Never post a home address. Rally points are public corners.",
        ],
    ),
    _thread(
        "missing-live",
        "missing-persons",
        "Denise",
        "coordinator",
        "Live search: Jordan, 19. Rally point at 27th and Wisconsin",
        "Last seen near 27th & W Wisconsin Ave. Rally point is the northeast corner of that intersection. "
        "4 sectors are cleared and 4 are being searched. Wear something visible and check in before you "
        "start a sector.",
        40,
        helpful=31,
        flair="Alert",
        replies=[
            _reply(
                "reply-live-1",
                "Lantern",
                "volunteer",
                "B2 is cleared. Alleys and storefront entries checked. Heading to the rally point for a new sector.",
                30,
                helpful=8,
            ),
            _reply(
                "reply-live-2",
                "Sparrow",
                "volunteer",
                "A1 is done too. Park paths and parking lots, nothing noted.",
                22,
                helpful=5,
            ),
            _reply(
                "reply-live-3",
                "Denise",
                "coordinator",
                "Thank you both. D row is still open if you are new and want a partner.",
                18,
                helpful=4,
                parent_id="reply-live-1",
            ),
        ],
    ),
    _thread(
        "missing-lead",
        "missing-persons",
        "Brook",
        "volunteer",
        "Verified lead in sector C2: navy jacket near the transit shelter",
        "A witness saw a navy jacket matching the description near the bus shelter in C2. A coordinator "
        "confirmed it. If you are nearby, walk the lit side and call the search lead before you approach anyone.",
        28,
        helpful=16,
        flair="Verified",
    ),
    _thread(
        "missing-join",
        "missing-persons",
        "Juniper",
        "neighbor",
        "I can take a sector after 7. Which one is still open?",
        "I am in Westown and can walk for about an hour. First search, so I would rather pair with someone.",
        15,
        helpful=6,
        flair="Question",
        answer="The D row on the Search grid is still unsearched. Pair with a volunteer at the rally point "
        "before you start. Do not search alone on your first night.",
        replies=[
            _reply(
                "reply-join-1",
                "Cedar",
                "volunteer",
                "Come to the rally point and look for the hi-vis vest. We can walk D1 together.",
                8,
                helpful=2,
            ),
        ],
    ),
    # ---------- food pantry ----------
    _thread(
        "food-welcome",
        "food-pantry",
        "Denise",
        "coordinator",
        "New here? How this hub works",
        "Three things, then you are ready.",
        8000,
        helpful=54,
        pinned=True,
        steps=[
            "Need food tonight? The Map tab shows pantries that are open now.",
            "Have extra? Post it on Inventory. Your address is only shared with the place that claims it.",
            "Every post is checked before it goes public, to keep everyone safe.",
        ],
    ),
    _thread(
        "food-formula",
        "food-pantry",
        "Willow",
        "neighbor",
        "Where can I get baby formula tonight?",
        "Store by me is out and I don't get paid till Friday.",
        22,
        helpful=8,
        flair="Question",
        answer="Two pantries with formula are open until 8 PM within a mile. A coordinator can also turn "
        "this into a private request for a drop-off.",
        replies=[
            _reply(
                "reply-formula-1",
                "Denise",
                "coordinator",
                "The church basement pantry has formula until 8. If you want a drop-off instead, I can make "
                "that a private request so your address never hits the thread.",
                18,
                helpful=5,
            ),
            _reply(
                "reply-formula-2",
                "Harbor",
                "volunteer",
                "I can run a can over after the porch shelf is stocked, if Denise opens the private request.",
                12,
                helpful=3,
                parent_id="reply-formula-1",
            ),
            _reply(
                "reply-formula-3",
                "Willow",
                "neighbor",
                "Private request please. Thank you both.",
                9,
                helpful=2,
                parent_id="reply-formula-1",
            ),
        ],
    ),
    _thread(
        "food-bread",
        "food-pantry",
        "Corner grocery on Walnut",
        "organization",
        "Day-old bread and produce, free after 7 PM",
        "About 6 cases. Bring a bag. First come, first served until 9.",
        60,
        helpful=21,
        flair="Offer",
        replies=[
            _reply(
                "reply-bread-1",
                "Maple",
                "neighbor",
                "I can take a case of bread to the porch shelf after 7:30 if that helps.",
                40,
                helpful=4,
            ),
        ],
    ),
    _thread(
        "food-porch",
        "food-pantry",
        "Harbor",
        "volunteer",
        "Our block club can host a pantry shelf. Who stocks it?",
        "We have a porch with a roof and a neighbor home most days.",
        180,
        helpful=14,
        flair="Question",
        replies=[
            _reply(
                "reply-porch-1",
                "Denise",
                "coordinator",
                "Start with bread, canned protein, and formula if we have it. I will put your block on the "
                "stocking list. Tell me the corner, not the house number.",
                100,
                helpful=6,
            ),
        ],
    ),
    # ---------- domestic safety ----------
    _thread(
        "domestic-welcome",
        "domestic-safety",
        "Denise",
        "coordinator",
        "This hub is private. Read this first",
        "Membership is never listed. Posts stay inside the hub.",
        9000,
        helpful=22,
        pinned=True,
        steps=[
            "Do not post your address, your workplace, or anyone else's full name.",
            "In danger right now, call 911. ComForce answers 24/7 at 414-395-0552.",
        ],
    ),
    _thread(
        "domestic-line",
        "domestic-safety",
        "Sparrow",
        "neighbor",
        "Is the 24/7 line staffed tonight?",
        "I may need to call from a friend's phone. I do not want to post where I am.",
        50,
        helpful=9,
        flair="Question",
        answer="Yes. ComForce answers 24/7 at 414-395-0552. You do not need to say where you are to ask "
        "for a check-in.",
        replies=[
            _reply(
                "reply-line-1",
                "Denise",
                "coordinator",
                "If you only have a minute, call and say you need a check-in. You do not have to explain "
                "where you are.",
                42,
                helpful=4,
            ),
        ],
    ),
)


#: Same sample case as the alert banner and the Search grid. Display name only,
#: and the last-known point is a public intersection, never a home.
SEED_CASES: tuple[SeedCase, ...] = (
    {
        "id": "case-jordan",
        "display_name": "Jordan, 19",
        "last_known_point": "27th & W Wisconsin Ave",
        "status": "active",
        "minutes_ago": 45,
    },
)
