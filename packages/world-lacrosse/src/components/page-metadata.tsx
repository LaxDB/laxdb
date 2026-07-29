import { useLayoutEffect } from "react";

const siteTitle = "2026 Women's Lacrosse Championship";

export function PageMetadata({
  title,
  description,
}: {
  readonly title?: string;
  readonly description: string;
}) {
  useLayoutEffect(() => {
    document.title = title ? `${title} | ${siteTitle}` : `${siteTitle} | LaxDB`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", description);
  }, [description, title]);
  return null;
}
