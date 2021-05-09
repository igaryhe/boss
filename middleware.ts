export interface Next {
  (): void | Promise<void>;
}

interface Middleware<T> {
  (context: T, next: Next): void | Promise<void>;
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
  dispatch(context: T): void | Promise<void> {
    return invokeMiddlewares(context, this.middlewares);
  }
}

function invokeMiddlewares<T>(context: T, middlewares: Middleware<T>[]): void | Promise<void> {
  if (!middlewares.length) return;  
  const mw = middlewares[0];
  return mw(context, async () => await invokeMiddlewares(context, middlewares.slice(1)));
}