export interface Next {
  (): void;
}

interface Middleware<T> {
  (context: T, next: Next): void;
}

export class Dispatcher<T> {
  middlewares: Middleware<T>[];

  constructor(...mw: Middleware<T>[]) {
    this.middlewares = [];
    this.middlewares.push(...mw);
  }
  use(...mw: Middleware<T>[]) {
    this.middlewares.push(...mw);
  }
  dispatch(context: T) {
    return invokeMiddlewares(context, this.middlewares);
  }
}
function invokeMiddlewares<T>(context: T, middlewares: Middleware<T>[]): void {
  if (!middlewares.length) return;
  const mw = middlewares[0];
  return mw(context, () => invokeMiddlewares(context, middlewares.slice(1)));
}