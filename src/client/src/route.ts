import { useEffect, useState } from "react";
import type { Route } from "./types";

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "home") return { name: "home" };
  if (parts[0] === "map") return { name: "map" };
  if (parts[0] === "requests") return { name: "requests" };
  if (parts[0] === "hubs" && parts[1] && parts[2]) return { name: "thread", hubId: parts[1], threadId: parts[2] };
  if (parts[0] === "hubs" && parts[1]) return { name: "hub", hubId: parts[1] };
  return { name: "hubs" };
}

export function go(path: string) {
  const next = path.startsWith("#") ? path : `#${path.startsWith("/") ? path : `/${path}`}`;
  if (window.location.hash !== next) window.location.hash = next;
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
