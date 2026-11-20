import { useEffect, useState } from "react";
import { Directory } from "./Directory";
import { HubPage } from "./HubPage";
import { HomePage, MapPage, RequestsPage } from "./OtherPages";
import { useRoute } from "./route";
import { Disguise, Shell } from "./shell";
import { HubsProvider } from "./store";
import { ThreadPage } from "./ThreadPage";

const SHAKE_KEY = "comforce.shake-exit";

export default function App() {
  return (
    <HubsProvider>
      <Frame />
    </HubsProvider>
  );
}

function Frame() {
  const route = useRoute();
  const [disguise, setDisguise] = useState(false);
  const [taps, setTaps] = useState(0);
  const [shake, setShakeState] = useState(() => localStorage.getItem(SHAKE_KEY) === "1");

  function setShake(value: boolean) {
    setShakeState(value);
    localStorage.setItem(SHAKE_KEY, value ? "1" : "0");
  }

  function exit() {
    setTaps(0);
    setDisguise(true);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.repeat) {
        event.preventDefault();
        setTaps(0);
        setDisguise(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!shake || disguise) return;
    const onMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const force = Math.abs(acc.x ?? 0) + Math.abs(acc.y ?? 0) + Math.abs(acc.z ?? 0);
      if (force > 35) exit();
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [shake, disguise]);

  if (disguise) {
    return (
      <Disguise
        taps={taps}
        onTap={() => {
          const next = taps + 1;
          if (next >= 3) {
            setDisguise(false);
            setTaps(0);
          } else {
            setTaps(next);
          }
        }}
      />
    );
  }

  return (
    <Shell route={route} onExit={exit} shake={shake} setShake={setShake}>
      {route.name === "home" && <HomePage />}
      {route.name === "map" && <MapPage />}
      {route.name === "requests" && <RequestsPage />}
      {route.name === "hubs" && <Directory />}
      {route.name === "hub" && <HubPage hubId={route.hubId} />}
      {route.name === "thread" && <ThreadPage hubId={route.hubId} threadId={route.threadId} />}
    </Shell>
  );
}
