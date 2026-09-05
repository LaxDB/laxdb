import { makeAsyncQueryFactory } from "@laxdb/reactivity/atom-query";

export const makeMalvernQuery = makeAsyncQueryFactory({
  staleTime: "5 minutes",
  idleTTL: "5 minutes",
  revalidateOnFocus: true,
});
