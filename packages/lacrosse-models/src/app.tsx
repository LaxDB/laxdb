import type { ModelViewerElement } from "@google/model-viewer";
import { createElement, useCallback, useEffect, useState } from "react";

export function BlenderLab() {
  return (
    <main className="flex min-h-dvh flex-col bg-card md:flex-row">
      <HeadViewer
        src="/models/mirage-head.glb?v=6"
        name="Unstrung ECD Mirage 3.0 head"
      />
      <HeadViewer
        src="/models/patent-d707770.glb?v=2"
        name="Warrior patent US D707770 S head, Figures 1–6"
      />
    </main>
  );
}

function HeadViewer({ src, name }: { src: string; name: string }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadViewer() {
      try {
        await import("@google/model-viewer");
      } catch {
        setError(true);
      }
    }
    void loadViewer();
  }, []);

  const connectViewer = useCallback((node: ModelViewerElement | null) => {
    if (!node) return;
    const onError = () => {
      setError(true);
    };
    node.addEventListener("error", onError);
    return () => {
      node.removeEventListener("error", onError);
    };
  }, []);

  return (
    <section aria-label={name} className="h-dvh w-full min-w-0 md:w-1/2">
      {error ? (
        <p role="alert" className="p-4">
          {name} could not load. Reload this page or check WebGL support.
        </p>
      ) : (
        createElement("model-viewer", {
          ref: connectViewer,
          src,
          alt: `${name}. Drag or use arrow keys to rotate; scroll or pinch to zoom.`,
          "camera-controls": true,
          "camera-orbit": "20deg 82deg auto",
          "min-camera-orbit": "auto auto 0.05m",
          "max-camera-orbit": "auto auto 2m",
          "interaction-prompt": "none",
          "touch-action": "pan-y",
          style: { width: "100%", height: "100%" },
        })
      )}
    </section>
  );
}
