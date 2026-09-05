import { makeAsyncQueryFactory } from "@laxdb/reactivity/atom-query";

export const malvernAtomDefaultIdleTTL = 5 * 60 * 1_000;

export const makeMalvernQuery = makeAsyncQueryFactory({
  staleTime: "5 minutes",
  revalidateOnFocus: true,
});
