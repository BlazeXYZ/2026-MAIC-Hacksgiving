import { useState } from "react";
import { Icon } from "./icons";
import { ago, isStaff, trustLabel } from "./rules";
import { useHubs } from "./store";
import type { Person, Place } from "./types";

export function Byline({ person, when }: { person: Person; when?: string }) {
  const { openTrust, staff } = useHubs();
  return (
    <div className="top">
      <b>{person.name}</b>
      <span>{person.title}</span>
      {person.neighborhood && <span>· {person.neighborhood}</span>}
      {when && <span>· {when}</span>}
      {person.trust_score != null ? (
        <button
          type="button"
          className="trust"
          title={person.trust_note ?? "A staffer typed this score"}
          onClick={() => openTrust(person.id)}
        >
          <Icon name="shield" size={12} />
          {trustLabel(person.trust_score)} · {person.trust_score}
        </button>
      ) : staff ? (
        <button type="button" className="trust unset" onClick={() => openTrust(person.id)}>
          Set trust
        </button>
      ) : null}
    </div>
  );
}

export function Vote({
  pressed,
  count,
  onClick,
}: {
  pressed: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button type="button" className="vote" aria-pressed={pressed} aria-label="Mark helpful" onClick={onClick}>
      <Icon name="up" size={18} />
      <b>{count}</b>
      <small>helpful</small>
    </button>
  );
}

export function Flair({ name }: { name: string }) {
  const kind = name === "Alert" ? "urgent" : name === "Verified" || name === "Offer" ? "ai" : "plain";
  return <span className={`tag ${kind}`}>{name}</span>;
}

export function CityMap({ places, color }: { places: Place[]; color: string }) {
  return (
    <div className="citymap" role="img" aria-label="Schematic of places in this hub">
      <div className="river" />
      <div className="park a" />
      <div className="park b" />
      <span className="hood" style={{ left: "8%", top: "12%" }}>Westown</span>
      <span className="hood" style={{ left: "68%", top: "16%" }}>Juneautown</span>
      <span className="hood" style={{ left: "12%", top: "78%" }}>Near West Side</span>
      {places.map((place) => (
        <span
          key={place.id}
          className={place.open ? "mappin" : "mappin off"}
          style={{ left: `${place.x}%`, top: `${place.y}%` }}
          title={`${place.name}. ${place.detail}`}
        >
          <i style={{ background: place.open ? color : "#6C776F" }} />
          <span>{place.name}</span>
        </span>
      ))}
      <span className="attrib">Sample streets · not a live map</span>
    </div>
  );
}

export function TrustDialog() {
  const { board, people, trustTarget, openTrust, setTrust, me } = useHubs();
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (!trustTarget || !board || !me) return null;
  const person = trustTarget === "list" ? null : people.get(trustTarget);
  if (person && loadedFor !== person.id) {
    setLoadedFor(person.id);
    setScore(person.trust_score == null ? "" : String(person.trust_score));
    setNote(person.trust_note ?? "");
    setError(null);
  }

  const helpers = [...board.people].sort((a, b) => {
    const group = (row: Person) => (isStaff(row) || row.role === "volunteer" ? 0 : 1);
    if (group(a) !== group(b)) return group(a) - group(b);
    return (b.trust_score ?? -1) - (a.trust_score ?? -1);
  });

  async function save(nextScore: number | null) {
    if (!person) return;
    if (nextScore != null && (Number.isNaN(nextScore) || nextScore < 0 || nextScore > 100)) {
      setError("Type a whole number from 0 to 100, or clear the score.");
      return;
    }
    try {
      await setTrust(person.id, nextScore, nextScore == null ? "" : note);
      openTrust(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That score did not save");
    }
  }

  return (
    <div className="modal-back" onClick={() => openTrust(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="trust-title" onClick={(event) => event.stopPropagation()}>
        {person ? (
          <>
            <h2 id="trust-title">Trust score for {person.name}</h2>
            <p className="voice">
              ComForce staff type this by hand for people who keep showing up. The app does not calculate it, and marking a post helpful does not change it.
            </p>
            <p className="mod-sub" style={{ padding: 0, marginTop: 8 }}>
              {person.title}
              {person.neighborhood ? ` · ${person.neighborhood}` : ""}
              {person.trust_set_by ? ` · last set by ${person.trust_set_by}` : ""}
            </p>
            <div className="field">
              <label htmlFor="trust-score">Score, 0 to 100</label>
              <input
                id="trust-score"
                inputMode="numeric"
                value={score}
                onChange={(event) => setScore(event.target.value)}
                placeholder="No score yet"
              />
            </div>
            <div className="field">
              <label htmlFor="trust-note">Why this number</label>
              <textarea
                id="trust-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Walked two searches and stayed to file the sector."
              />
            </div>
            {score.trim() && trustLabel(Number(score)) && (
              <p className="mod-sub" style={{ padding: 0 }}>
                The badge will read “{trustLabel(Number(score))} · {Number(score)}”. That label only restates the number you typed.
              </p>
            )}
            {error && <p className="error">{error}</p>}
            <div className="held-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  if (!score.trim() || !Number.isInteger(Number(score))) {
                    setError("Type a whole number from 0 to 100, or clear the score.");
                    return;
                  }
                  void save(Number(score));
                }}
              >
                Save score
              </button>
              <button type="button" className="btn" onClick={() => save(null)}>
                Clear score
              </button>
              <button type="button" className="btn" onClick={() => openTrust("list")}>
                All people
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="trust-title">Trust scores</h2>
            <p className="voice">Set by staff. Employees and volunteers are listed first. Neighbors can have a score too, once someone types one.</p>
            <div style={{ marginTop: 12 }}>
              {helpers.map((row) => (
                <button key={row.id} type="button" className="personpick" onClick={() => openTrust(row.id)}>
                  <span>
                    <b>{row.name}</b>
                    <small style={{ display: "block" }}>{row.title}</small>
                  </span>
                  <span>{row.trust_score == null ? "No score" : `${trustLabel(row.trust_score)} · ${row.trust_score}`}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function when(iso: string): string {
  return ago(iso);
}
