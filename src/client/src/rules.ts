import type { Board, Hub, Person, Thread } from "./types";

const ADDRESS =
  /\b\d{2,5}\s+(?:[NSEW]\.?\s+)?(?:[A-Za-z0-9.'\-]+\s+){1,3}(?:st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|way|ct|court)\b/i;
const LIVE_AT =
  /\b(i live at|my address is|come to my (?:house|home|door)|drop (?:it |food |this )?at my (?:house|home|door))\b/i;
const PHONE = /\b(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}\b/;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;

const ANSWERS: { hub: string; words: string[]; answer: string }[] = [
  {
    hub: "food",
    words: ["formula", "diaper", "pantry", "hungry", "grocery", "grocer", "food", "bread"],
    answer:
      "Open pantries on this hub's map are the first stop. Formula and diapers are short in Haymarket this week. A coordinator can turn this into a private request so your address stays off the thread.",
  },
  {
    hub: "missing",
    words: ["sector", "search", "missing", "rally", "tip"],
    answer:
      "Check the live search thread and the Search grid before you head out. Pair with a lead at the rally point. Do not post a home address, and do not search alone on your first night.",
  },
  {
    hub: "domestic",
    words: ["line", "call", "safe", "exit", "sojourner", "staffed"],
    answer:
      "Sojourner Family Peace Center answers 24/7 at 414-933-2722. ComForce answers at 414-395-0552. You do not need to say where you are. Quick Exit is the red button, or Esc on a computer.",
  },
  {
    hub: "rides",
    words: ["ride", "clinic", "driver", "seat", "pickup"],
    answer:
      "Post a corner and a time on the Ride board, not a house number. The ride desk confirms the driver before you get in. Clinic names can stay on a private request.",
  },
  {
    hub: "youth",
    words: ["mentor", "circle", "thursday", "youth"],
    answer:
      "Thursday circle doors open at 6. Young people come with a mentor. Do not post a young person's name, school, or address. Sam reads mentor requests.",
  },
  {
    hub: "disaster",
    words: ["shelter", "warm", "freeze", "cold", "lobby", "welfare"],
    answer:
      "Warming rooms on the shelter map open only when ComForce calls a drop. Check News before you drive anyone over. Welfare checks stay on the blocks already assigned.",
  },
  {
    hub: "parents",
    words: ["childcare", "babysit", "swap", "diaper", "stroller"],
    answer:
      "Post a public corner and a time. Last names and addresses stay off the thread. A parent volunteer confirms childcare before you leave a child with someone.",
  },
  {
    hub: "podcast",
    words: ["episode", "taping", "on air", "question"],
    answer:
      "Questions for the live taping can be a thread on this hub. Say if your name should stay off the air. The show does not read addresses or anything from Domestic Safety.",
  },
];

export function holdReason(text: string): string | null {
  if (ADDRESS.test(text) || LIVE_AT.test(text)) {
    return "It included a home address. Take the address out and post again, or ask a coordinator to make a private request.";
  }
  if (PHONE.test(text)) {
    return "It included a phone number. Share that with ComForce, not the hub. Take the number out and post again.";
  }
  if (EMAIL.test(text)) {
    return "It included an email address. Take it out and post again. A coordinator can pass it along privately.";
  }
  return null;
}

export function automaticAnswer(hubId: string, text: string): string | null {
  if (!text.includes("?")) return null;
  const lowered = text.toLowerCase();
  const match = ANSWERS.find((row) => row.hub === hubId && row.words.some((word) => lowered.includes(word)));
  return match?.answer ?? null;
}

export function trustLabel(score: number): string {
  if (score >= 90) return "Trusted";
  if (score >= 75) return "Reliable";
  if (score >= 50) return "Known helper";
  if (score >= 1) return "New to helping";
  return "Cleared";
}

export function isStaff(person: Person | undefined): boolean {
  return person?.role === "employee" || person?.role === "coordinator";
}

export function hubStats(hub: Hub): string {
  if (hub.private) return "Private · members are never shown";
  const count = new Intl.NumberFormat("en-US").format(hub.member_count ?? 0);
  return `${count} members · ${hub.stats_extra}`;
}

export function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function hotScore(thread: Thread): number {
  const hours = Math.max(0.2, (Date.now() - new Date(thread.created_at).getTime()) / 3600000);
  return thread.helpful / (hours + 2) ** 1.2;
}

export function personMap(board: Board): Map<string, Person> {
  return new Map(board.people.map((person) => [person.id, person]));
}

export function nextAlerts(mode: Hub["alerts"]): Hub["alerts"] {
  if (mode === "important") return "all";
  if (mode === "all") return "off";
  return "important";
}

export function alertLabel(mode: Hub["alerts"]): string {
  if (mode === "all") return "Alerts: everything";
  if (mode === "off") return "Alerts: off";
  return "Alerts: important only";
}
