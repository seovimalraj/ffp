declare module "three-dxf-loader" {
  import { Loader, LoadingManager, Object3D } from "three";
  import { DxfParser } from "dxf-parser";

  export class DXFLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (data: Object3D) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent) => void,
    ): void;
    parse(text: string, parser: DxfParser): Object3D;
  }
}

declare module "dxf-parser" {
  export class DxfParser {
    constructor();
    parseSync(text: string): any;
  }
}
