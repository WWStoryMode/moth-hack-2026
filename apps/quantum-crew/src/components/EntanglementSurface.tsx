// Renders the Atlas Entanglement Shader (see atlas/entanglementShader.ts) on a canvas. `film` fills its box with a
// rippling iridescent surface; `crystals` draws the tool's two linked crystals. Renders nothing (so the CSS
// placeholder shows) if the baked LUT is missing or WebGL 2 isn't available.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FRAGMENT, VERTEX } from "../atlas/entanglementShader.ts";

type Lut = { width: number; height: number; R: number[]; T: number[] };

// Optional at build time: present once `pnpm bake-shader` has run on the engine output.
const baked = import.meta.glob<Lut>("../assets/atlas/entanglement-lut.json", { eager: true, import: "default" });
const LUT: Lut | undefined = Object.values(baked)[0];

export const hasEntanglementShader = () => LUT !== undefined;

const THICKNESS_NM = 500; // the engine's default interlayer spacing

type Props = { mode: "film" | "crystals"; className?: string; fallback?: ReactNode };

export function EntanglementSurface({ mode, className, fallback = null }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !LUT) return;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: true });
    if (!gl) return setFailed(true);

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[entanglement shader]", e);
      return setFailed(true);
    }
    gl.useProgram(program);

    // One big triangle covers the canvas.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // The engine's sampler settings: phase axis repeats, angle axis clamps, linear filtering. Row 0 (θ = 0) is
    // uploaded first so it lands at t = 0, as the engine's shader expects. R16F filters linearly everywhere.
    const lut = LUT;
    const texture = (unit: number, data: number[], name: string) => {
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, lut.width, lut.height, 0, gl.RED, gl.FLOAT, new Float32Array(data));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, name), unit);
      return tex;
    };
    const textures = [texture(0, lut.R, "uRTexture"), texture(1, lut.T, "uTTexture")];

    const uTime = gl.getUniformLocation(program, "uTime");
    const uRes = gl.getUniformLocation(program, "uRes");
    gl.uniform1f(gl.getUniformLocation(program, "uThickness"), THICKNESS_NM);
    gl.uniform1i(gl.getUniformLocation(program, "uMode"), mode === "film" ? 0 : 1);

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, mode === "film" ? 1 : 2);
    const start = performance.now();
    let frame = 0;
    const draw = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, still ? 4 : (performance.now() - start) / 1000);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!still && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const onVisible = () => {
      if (!document.hidden && !still) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    draw();

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisible);
      textures.forEach((t) => gl.deleteTexture(t));
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
    };
  }, [mode]);

  if (!LUT || failed) return <>{fallback}</>;
  return <canvas ref={ref} className={`entangle entangle--${mode} ${className ?? ""}`} aria-hidden="true" />;
}

/** The tool's two linked crystals: the live shader when available, else the CSS crystals. */
export function Crystals({ className }: { className?: string }) {
  return (
    <EntanglementSurface
      mode="crystals"
      className={`crystals ${className ?? ""}`}
      fallback={
        <div className={`reveal__crystals ${className ?? ""}`} aria-hidden="true">
          <div className="crystal" />
          <div className="crystal" />
        </div>
      }
    />
  );
}
