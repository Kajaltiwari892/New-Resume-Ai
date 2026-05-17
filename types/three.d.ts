declare module "three" {
  export class WebGLRenderer {
    constructor(options?: Record<string, unknown>);
    capabilities: { isWebGL2: boolean };
    domElement: HTMLElement;
    setClearColor(color: number, alpha?: number): void;
    setSize(width: number, height: number): void;
    setPixelRatio(ratio: number): void;
    render(scene: unknown, camera: unknown): void;
    dispose(): void;
  }

  export class Scene {
    add(object: unknown): void;
  }

  export class OrthographicCamera {
    constructor(left: number, right: number, top: number, bottom: number, near: number, far: number);
    position: { z: number };
  }

  export class Vector2 {
    constructor(x?: number, y?: number);
    set(x: number, y: number): this;
  }

  export class Color {
    constructor(color?: string);
    set(color: string): this;
  }

  export class ShaderMaterial {
    constructor(options?: Record<string, unknown>);
    dispose(): void;
  }

  export class Mesh {
    constructor(geometry: unknown, material: unknown);
  }

  export class PlaneGeometry {
    constructor(width: number, height: number);
  }
}
