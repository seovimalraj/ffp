import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_WORKER_CAPABILITIES,
  getWorkerCapabilities,
} from "../mesh-loader";

type MessageHandler = (event: MessageEvent<any>) => void;

class FakeWorker {
  private handlers = new Set<MessageHandler>();

  constructor(
    private readonly responder?: (req: any, emit: (resp: any) => void) => void,
  ) {}

  addEventListener(type: string, handler: MessageHandler): void {
    if (type !== "message") return;
    this.handlers.add(handler);
  }

  removeEventListener(type: string, handler: MessageHandler): void {
    if (type !== "message") return;
    this.handlers.delete(handler);
  }

  postMessage(payload: any): void {
    if (!this.responder) return;
    this.responder(payload, (response) => {
      const event = { data: response } as MessageEvent<any>;
      for (const handler of this.handlers) {
        handler(event);
      }
    });
  }
}

describe("mesh-loader worker capabilities", () => {
  it("returns reported worker capabilities", async () => {
    const worker = new FakeWorker((req, emit) => {
      emit({
        id: req.id,
        ok: true,
        type: "get_worker_capabilities",
        capabilities: {
          exactCadPartExport: true,
          supportedExactCadFormats: ["step", "iges"],
        },
      });
    });

    const capabilities = await getWorkerCapabilities(worker as unknown as Worker, {
      timeoutMs: 20,
    });

    assert.deepEqual(capabilities, {
      exactCadPartExport: true,
      supportedExactCadFormats: ["step", "iges"],
    });
  });

  it("falls back when worker response payload is invalid", async () => {
    const worker = new FakeWorker((req, emit) => {
      emit({
        id: req.id,
        ok: true,
        type: "not_capabilities",
      });
    });

    const capabilities = await getWorkerCapabilities(worker as unknown as Worker, {
      timeoutMs: 20,
    });

    assert.deepEqual(capabilities, DEFAULT_WORKER_CAPABILITIES);
  });

  it("falls back when worker does not respond", async () => {
    const worker = new FakeWorker();
    const capabilities = await getWorkerCapabilities(worker as unknown as Worker, {
      timeoutMs: 20,
    });

    assert.deepEqual(capabilities, DEFAULT_WORKER_CAPABILITIES);
  });
});
