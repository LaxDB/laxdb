export const scheduleDateLabel = (date: Date, timeZone?: string): string =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(date);
