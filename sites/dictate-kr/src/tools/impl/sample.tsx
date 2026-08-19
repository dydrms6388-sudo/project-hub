"use client";
import { useState } from "react";
export default function Sample() {
  const [n, setN] = useState(0);
  return (
    <button type="button" aria-label="스파이크" onClick={() => {
      const w = new Worker(new URL("../../workers/spike.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e) => setN(e.data.value);
      w.postMessage("go");
    }}>spike {n}</button>
  );
}
