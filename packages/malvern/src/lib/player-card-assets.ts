import newsreaderUrl from "@laxdb/ui/fonts/Newsreader.ttf?url";
import oswaldUrl from "@laxdb/ui/fonts/Oswald.woff2?url";
import type { LinkHTMLAttributes } from "react";

import type { CardPlayer } from "./player-cards";

export const cardFontPreload = {
  rel: "preload",
  as: "font",
  type: "font/woff2",
  crossOrigin: "anonymous",
  href: oswaldUrl,
} satisfies LinkHTMLAttributes<HTMLLinkElement>;

export const collectionFontPreload = {
  rel: "preload",
  as: "font",
  type: "font/ttf",
  crossOrigin: "anonymous",
  href: newsreaderUrl,
} satisfies LinkHTMLAttributes<HTMLLinkElement>;

// Match the gallery grid and .player-card-fullscreen width.
export const cardImageSizes = {
  gallery:
    "(min-width: 1440px) 443px, (min-width: 1280px) calc((100vw - 112px) / 3), (min-width: 768px) calc((100vw - 88px) / 2), (min-width: 640px) calc(100vw - 64px), calc(100vw - 32px)",
  viewer:
    "(min-width: 640px) min(calc(100vw - 64px), 750px, calc((100svh - 112px) * 5 / 7)), min(calc(100vw - 32px), 750px, calc((100svh - 112px) * 5 / 7))",
};

export function cardPhotoPreloads(player: CardPlayer) {
  if (!player.photo) return [];
  return [
    {
      rel: "preload",
      as: "image",
      href: player.photo.src,
      imageSrcSet: player.photo.srcSet,
      imageSizes: cardImageSizes.viewer,
      fetchPriority: "high",
    } satisfies LinkHTMLAttributes<HTMLLinkElement>,
  ];
}

export function preloadPlayerPhoto(player: CardPlayer) {
  if (!player.photo) return;
  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = "low";
  image.sizes = cardImageSizes.viewer;
  if (player.photo.srcSet) image.srcset = player.photo.srcSet;
  image.src = player.photo.src;
  // A failed speculative load must not block navigation.
  void image.decode().catch(() => {});
}
