export const localApiUrl = `http://localhost:${process.env.API_PORT ?? "1437"}`;

export const apiProxy = (paths: readonly string[]) =>
  Object.fromEntries(paths.map((path) => [path, { target: localApiUrl }]));
