export const throwRouterError = (error: unknown): never => {
  // oxlint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router expects throwing redirect()/notFound()
  throw error;
};
