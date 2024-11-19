export class Counter {
  state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    switch (url.pathname) {
      case "/":
        return this.value();
      case "/increment":
        return this.increment();
      case "/decrement":
        return this.decrement();
      case "/value":
        return this.value();
      default:
        return new Response("Not found", { status: 404 });
    }
  }

  async increment(): Promise<Response> {
    let value = (await this.state.storage.get<number>("value")) || 0;
    value++;
    await this.state.storage.put("value", value);
    return new Response(value.toString());
  }

  async decrement(): Promise<Response> {
    let value = (await this.state.storage.get<number>("value")) || 0;
    value--;
    await this.state.storage.put("value", value);
    return new Response(value.toString());
  }

  async value(): Promise<Response> {
    let value = (await this.state.storage.get<number>("value")) || 0;
    return new Response(value.toString());
  }
}
