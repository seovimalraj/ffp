import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  loadCadAssemblyFile,
  loadCadAssemblyWithTopology,
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

function makeCadFile(name = "fixture.step"): File {
  return {
    name,
    arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
  } as unknown as File;
}

const fixtureRoot = {
  name: "Root",
  partId: "part:1",
  meshes: [0],
  children: [],
};

const fixtureMeshes = [
  {
    name: "Part 1",
    partId: "part:1",
    positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]),
    indices: new Uint32Array([0, 1, 2]),
  },
];

describe("mesh-loader CAD topology path", () => {
  it("returns explicit topology unavailable status when runtime lacks topology", async () => {
    const worker = new FakeWorker((req, emit) => {
      emit({
        id: req.id,
        ok: true,
        type: "tessellate_with_topology",
        root: fixtureRoot,
        meshes: fixtureMeshes,
        topology: null,
        topologyAvailability: {
          exact: false,
          reason: "missing_runtime_support",
          message: "Topology symbol was not found in runtime.",
          runtimeSymbols: [],
        },
      });
    });

    const result = await loadCadAssemblyWithTopology(
      makeCadFile(),
      worker as unknown as Worker,
    );

    assert.equal(result.ext, "step");
    assert.equal(result.meshes.length, 1);
    assert.equal(result.topology, null);
    assert.equal(result.topologyAvailability.exact, false);
    assert.equal(result.topologyAvailability.reason, "missing_runtime_support");
    assert.equal(result.root.name, "Root");
  });

  it("falls back to worker_request_unsupported when worker returns parts-only payload", async () => {
    const worker = new FakeWorker((req, emit) => {
      emit({
        id: req.id,
        ok: true,
        mode: "parts",
        root: fixtureRoot,
        meshes: fixtureMeshes,
      });
    });

    const result = await loadCadAssemblyWithTopology(
      makeCadFile(),
      worker as unknown as Worker,
    );

    assert.equal(result.topology, null);
    assert.equal(result.topologyAvailability.exact, false);
    assert.equal(result.topologyAvailability.reason, "worker_request_unsupported");
    assert.equal(result.meshes.length, 1);
  });

  it("falls back to tessellate parts when topology request fails loudly", async () => {
    const worker = new FakeWorker((req, emit) => {
      if (req.type === "tessellate_with_topology") {
        emit({
          id: req.id,
          ok: false,
          error:
            "Missing required OCCT runtime export 'TessellateWithTopology'. Artifacts: /occ/occt-import-js.js and /occ/occt-import-js.wasm.",
        });
        return;
      }

      if (req.type === "tessellate") {
        emit({
          id: req.id,
          ok: true,
          mode: "parts",
          root: fixtureRoot,
          meshes: fixtureMeshes,
        });
      }
    });

    const result = await loadCadAssemblyWithTopology(
      makeCadFile(),
      worker as unknown as Worker,
    );

    assert.equal(result.topology, null);
    assert.equal(result.topologyAvailability.exact, false);
    assert.equal(result.topologyAvailability.reason, "missing_runtime_support");
    assert.match(
      result.topologyAvailability.message,
      /Missing required OCCT runtime export 'TessellateWithTopology'/,
    );
    assert.equal(result.meshes.length, 1);
  });

  it("keeps loadCadAssemblyFile API stable as a compatibility wrapper", async () => {
    const worker = new FakeWorker((req, emit) => {
      emit({
        id: req.id,
        ok: true,
        type: "tessellate_with_topology",
        root: fixtureRoot,
        meshes: fixtureMeshes,
        topology: null,
        topologyAvailability: {
          exact: false,
          reason: "missing_runtime_support",
          message: "Topology symbol was not found in runtime.",
        },
      });
    });

    const result = await loadCadAssemblyFile(
      makeCadFile(),
      worker as unknown as Worker,
    );

    assert.equal(result.ext, "step");
    assert.equal(result.meshes.length, 1);
    assert.equal((result as any).topology, undefined);
    assert.equal(result.root.name, "Root");
  });
});
