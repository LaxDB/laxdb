export const localApiUrl = `http://localhost:${process.env.API_PORT ?? "1437"}`;

// Each app selects the browser paths that the API worker serves.
export const apiRoutes = (hostname: string, paths: readonly string[]) =>
  paths.map((path) => ({ pattern: `${hostname}${path}*` }));

export const apiProxy = (paths: readonly string[]) =>
  Object.fromEntries(paths.map((path) => [path, { target: localApiUrl }]));
