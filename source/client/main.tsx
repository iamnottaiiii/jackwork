import { spaceQueryClient } from "@hatch/space-sdk/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";
import icon192 from "./assets/jackwork-icon-192.png";
import icon512 from "./assets/jackwork-icon-512.png";

/* The page icon is the owner's finished logo itself (the four soft
   red glows with JackWork in glow red at the top right, transparent
   background), resized from ~/workspace/jackwork/logo/
   jackwork-logo-final.png — never redrawn. The empty inline icon in
   index.html is replaced with it as soon as the bundle loads. */
const faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (faviconEl) {
  faviconEl.type = "image/png";
  faviconEl.href = icon192;
}
const touchIconEl = document.createElement("link");
touchIconEl.rel = "apple-touch-icon";
touchIconEl.href = icon512;
document.head.appendChild(touchIconEl);

const rootEl = document.querySelector<HTMLElement>("[data-generated-space-root]");
if (!rootEl) {
  throw new Error("missing generated space root element");
}

// If you edit this file: keep `<QueryClientProvider client={spaceQueryClient}>`
// wrapping the app (every space shares the SDK's QueryClient), and keep
// BOTH the `hatch-space-root` class AND the `data-hatch-space-root`
// attribute on the outer div. The SDK styles select on
// `.hatch-space-root[data-hatch-space-root]` to apply mobile safe-area
// insets (notches, gesture bars, etc.), correct viewport sizing, and the
// hosting header/chrome offsets — dropping either breaks layout silently.
createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={spaceQueryClient}>
      <div className="hatch-space-root" data-hatch-space-root>
        <App />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
