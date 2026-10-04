import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { Ctx } from "../core/types";
import { W, H } from "../core/math";
import { now } from "../state";
import { SR, ensureAudio } from "../audio/music";
import { cv, paintTo, replay } from "../cards/render";

export type DrawFn = (ctx: Ctx, t: number) => void;
export interface VideoResult {
  blob: Blob;
  hd: boolean;
  audio: boolean;
}

export const canEncode = typeof window.VideoEncoder === "function" && typeof window.VideoFrame === "function";

export const recMime: string | null = (() => {
  if (!window.MediaRecorder || !cv.captureStream) return null;
  return (
    ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => {
      try {
        return MediaRecorder.isTypeSupported(m);
      } catch {
        return false;
      }
    }) || null
  );
})();
export const videoMime = canEncode || recMime;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const yieldUI = () => wait(0);

async function pickVideoConfig(w: number, h: number, bitrate: number) {
  const codecs: [string, "avc" | "vp9"][] = [
    ["avc1.640033", "avc"],
    ["avc1.64002a", "avc"],
    ["avc1.640028", "avc"],
    ["avc1.4d0033", "avc"],
    ["avc1.4d0028", "avc"],
    ["avc1.42e033", "avc"],
    ["avc1.42e028", "avc"],
    ["vp09.00.40.08", "vp9"]
  ];
  for (const [codec, mc] of codecs)
    for (const mode of ["constant", undefined] as const) {
      const cfg: VideoEncoderConfig = { codec, width: w, height: h, bitrate, framerate: 30 };
      if (mode) cfg.bitrateMode = mode;
      if (mc === "avc") cfg.avc = { format: "avc" };
      try {
        const r = await VideoEncoder.isConfigSupported(cfg);
        if (r.supported) return { cfg, mc };
      } catch {
        /* try the next codec */
      }
    }
  return null;
}

async function pickAudioConfig() {
  if (typeof window.AudioEncoder !== "function" || typeof window.AudioData !== "function") return null;
  const options: [string, "aac" | "opus"][] = [
    ["mp4a.40.2", "aac"],
    ["opus", "opus"]
  ];
  for (const [codec, mc] of options) {
    const cfg: AudioEncoderConfig = { codec, sampleRate: SR, numberOfChannels: 2, bitrate: 192000 };
    try {
      const r = await AudioEncoder.isConfigSupported(cfg);
      if (r.supported) return { cfg, mc };
    } catch {
      /* try the next codec */
    }
  }
  return null;
}

/** Frame-perfect export: every frame is drawn and encoded deliberately (no screen recording). */
export async function encodeMp4(secs: number, onProgress: (p: number) => void, audioBuf: AudioBuffer | null, drawFn?: DrawFn): Promise<VideoResult> {
  const fps = 30,
    n = Math.round(fps * secs);
  let w = W,
    h = H,
    v = await pickVideoConfig(W, H, 20000000);
  if (!v) {
    w = 864;
    h = 1080;
    v = await pickVideoConfig(w, h, 14000000);
  }
  if (!v) throw new Error("no video codec");
  const a = audioBuf ? await pickAudioConfig() : null;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: v.mc, width: w, height: h, frameRate: fps },
    audio: a ? { codec: a.mc, numberOfChannels: 2, sampleRate: SR } : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset"
  });
  let failure: unknown = null;
  const venc = new VideoEncoder({
    output: (c, m) => muxer.addVideoChunk(c, m),
    error: (e) => {
      failure = e;
    }
  });
  venc.configure(v.cfg);
  if (a && audioBuf) {
    const aenc = new AudioEncoder({
      output: (c, m) => muxer.addAudioChunk(c, m),
      error: (e) => {
        failure = e;
      }
    });
    aenc.configure(a.cfg);
    const L = audioBuf.getChannelData(0),
      Rr = audioBuf.numberOfChannels > 1 ? audioBuf.getChannelData(1) : L;
    const total = Math.min(L.length, Math.round(SR * secs)),
      step = 1024;
    for (let i = 0; i < total; i += step) {
      const len = Math.min(step, total - i),
        data = new Float32Array(len * 2);
      data.set(L.subarray(i, i + len), 0);
      data.set(Rr.subarray(i, i + len), len);
      const ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round((i / SR) * 1e6), data });
      aenc.encode(ad);
      ad.close();
    }
    await aenc.flush();
    aenc.close();
  }
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d")!,
    base = now();
  for (let i = 0; i < n; i++) {
    if (failure) throw failure;
    const t = i / fps;
    octx.setTransform(w / W, 0, 0, h / H, 0, 0);
    if (drawFn) drawFn(octx, t);
    else paintTo(octx, base + t, t);
    const vf = new VideoFrame(off, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    venc.encode(vf, { keyFrame: i % 15 === 0 });
    vf.close();
    while (venc.encodeQueueSize > 4) await wait(4);
    if (i % 6 === 0) {
      onProgress(i / n);
      await yieldUI();
    }
  }
  await venc.flush();
  venc.close();
  if (failure) throw failure;
  muxer.finalize();
  return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), hd: w === W, audio: !!a };
}

/** Real-time screen capture of the canvas, for browsers without WebCodecs. */
export async function recordFallback(secs: number, onProgress: (p: number) => void, audioBuf: AudioBuffer | null): Promise<VideoResult> {
  if (!recMime) throw new Error("no recorder");
  const stream = cv.captureStream(30);
  let src: AudioBufferSourceNode | null = null;
  const actx = audioBuf ? ensureAudio() : null;
  if (audioBuf && actx && actx.createMediaStreamDestination) {
    const dest = actx.createMediaStreamDestination();
    src = actx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }
  const rec = new MediaRecorder(stream, { mimeType: recMime, videoBitsPerSecond: 20000000, audioBitsPerSecond: 192000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const done = new Promise<void>((res) => {
    rec.onstop = () => res();
  });
  rec.start(250);
  replay();
  if (src) src.start();
  const steps = Math.ceil(secs * 4);
  for (let s = 0; s < steps; s++) {
    onProgress(s / steps);
    await wait(250);
  }
  rec.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  return { blob: new Blob(chunks, { type: recMime.split(";")[0] }), hd: false, audio: !!src };
}

export function teaserBlob(drawTeaser: DrawFn): Promise<Blob | null> {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  drawTeaser(c.getContext("2d")!, 1.2);
  return new Promise((res) => c.toBlob(res, "image/png"));
}

