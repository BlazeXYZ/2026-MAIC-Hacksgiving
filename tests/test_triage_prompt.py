"""Tests for the intake triage prompt template and output schema."""

import json
import re
import sys
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.server.ai.prompts import TRIAGE_SYSTEM_PROMPT, build_triage_prompt
from src.server.ai.schemas import (
    TriageCategory,
    TriageOutputSchema,
    UrgencyTier,
)

# Extract every fenced ```json block from the prompt.
JSON_BLOCK_RE = re.compile(r"```json\n(.*?)\n```", re.DOTALL)
EXAMPLE_BLOCKS = JSON_BLOCK_RE.findall(TRIAGE_SYSTEM_PROMPT)


def _example_outputs():
    """Parse and validate all fenced JSON blocks in the prompt."""
    outputs = []
    for block in EXAMPLE_BLOCKS:
        outputs.append(TriageOutputSchema.model_validate(json.loads(block)))
    return outputs


def test_all_categories_appear_in_prompt():
    for category in TriageCategory:
        assert f'"{category.value}"' in TRIAGE_SYSTEM_PROMPT


def test_all_urgency_tiers_appear_in_prompt():
    for tier in UrgencyTier:
        assert f'"{tier.value}"' in TRIAGE_SYSTEM_PROMPT


def test_schema_keys_appear_in_prompt():
    for key in ("category", "urgency", "escalate", "explanation"):
        assert f'"{key}"' in TRIAGE_SYSTEM_PROMPT


def test_at_least_five_few_shot_examples():
    assert len(EXAMPLE_BLOCKS) >= 5


def test_every_fenced_json_block_validates():
    outputs = _example_outputs()
    assert len(outputs) == len(EXAMPLE_BLOCKS)
    for output in outputs:
        assert isinstance(output, TriageOutputSchema)


def test_build_triage_prompt_embeds_resident_text():
    free_text = "I need diapers for my baby before Friday"
    prompt = build_triage_prompt(free_text)
    assert TRIAGE_SYSTEM_PROMPT in prompt
    assert free_text in prompt


def test_scenario_stranded_in_cold():
    outputs = _example_outputs()
    match = [o for o in outputs if o.category == TriageCategory.WARMTH]
    assert len(match) == 1
    assert match[0].urgency == UrgencyTier.URGENT


def test_scenario_domestic_crisis():
    outputs = _example_outputs()
    match = [
        o
        for o in outputs
        if o.category == TriageCategory.SUPPORT and o.escalate
    ]
    assert len(match) == 1
    assert match[0].urgency == UrgencyTier.URGENT


def test_scenario_missed_pantry():
    outputs = _example_outputs()
    match = [
        o
        for o in outputs
        if o.category == TriageCategory.FOOD and not o.escalate
    ]
    assert match, "expected a non-escalated food example (missed pantry)"
    assert any(o.urgency == UrgencyTier.TODAY for o in match)


def test_scenario_ride_to_clinic():
    outputs = _example_outputs()
    match = [o for o in outputs if o.category == TriageCategory.RIDE]
    assert len(match) == 1
    assert match[0].urgency == UrgencyTier.THIS_WEEK


def test_scenario_greeting_only_asks_clarifying_question():
    outputs = _example_outputs()
    match = [o for o in outputs if o.category == TriageCategory.OTHER]
    assert len(match) == 1
    assert match[0].clarifying_question is not None
    assert match[0].urgency == UrgencyTier.THIS_WEEK
