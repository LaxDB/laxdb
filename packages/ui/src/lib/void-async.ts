export const voidAsync =
  <TArgs extends readonly unknown[]>(fn: (...args: TArgs) => unknown) =>
  (...args: TArgs): void => {
    void fn(...args);
  };
