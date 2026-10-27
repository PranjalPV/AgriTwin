import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
// Minimal stand-in for next/dynamic used by the static demo bundle.
export default function dynamic<P extends object>(loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>, opts?: { loading?: () => ReactNode }) {
  const L = lazy(async () => { const m = await loader(); return "default" in (m as object) ? (m as { default: ComponentType<P> }) : { default: m as ComponentType<P> }; });
  return function Dyn(props: P) {
    return <Suspense fallback={opts?.loading ? opts.loading() : null}>{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}<L {...(props as any)} /></Suspense>;
  };
}
