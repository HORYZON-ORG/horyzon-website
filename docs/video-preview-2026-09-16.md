# Home video: local preview verification

## Diagnosis

The supplied original is 1280x720, 24fps, 10 seconds (240 video frames),
4,511,790 bytes including audio. It is not a 4K source.
Previous desktop asset: 910x512, 15fps, 2,951,460 bytes.
Previous mobile asset: 640x360, 15fps, 1,412,303 bytes.
Both old files already used independently seekable frames: GOP length was
not the underlying issue. Downsampling lost detail and 90 original frames.
Full-height portrait cover further enlarges and crops the landscape source.

The old controller also sought multiple positions within a single source frame.
The updated controller quantizes targets at 24fps, retains only the latest target
while seeking, and coalesces scroll layout reads in requestAnimationFrame.
Source changes now reinitialize playback activation when crossing the breakpoint.

## Result and tradeoff

Both assets retain native 1280x720 and all 240 frames, with no audio, all-intra
H.264 and faststart. Desktop: 9,581,854 bytes. Mobile: 5,784,671 bytes.
Mobile uses a higher CRF to reduce download while retaining spatial resolution.
No generated detail or frame interpolation. On a 2560px display the source is
still enlarged 2x: visibly improved source retention is not native 1440p sharpness.
Larger files increase cold-load time; mobile at 5 Mbps needs roughly 9 seconds
to transfer the entire file, excluding overhead. The poster remains available.

## Executed checks

- Production build, typecheck, lint and full repository test command passed.
- Chrome: 1920x1080 desktop and 390x844 mobile emulation, DPR 3, CPU throttle 4x.
- Eight-second forward/reverse scroll over the entire story, followed by settling.
- Updated production preview: video frame callback gap p95 16.8ms in both modes;
  seek event duration p95 2.0ms desktop / 1.3ms emulated mobile.
- These are local browser timings, not a claim of 60 distinct source frames/sec
  or a physical-phone benchmark. Initial baseline also had fast seeks; a long
  decoder stall was not reproduced on this machine.
- No page errors or horizontal overflow in the two measured viewports.
- Pause/resume, 844x390 orientation/source switch, reduced-motion toggle,
  recovery from static mode and arrival at the final frame passed.
- Screenshots inspected at mobile DPR 3 and 2560x1440 desktop.
- A routed baseline experiment lacked correct byte-range behavior and was
  discarded; it is not evidence for a speed comparison.

Browser API reference: https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback

## Preview

Run the built site with `npm run start -- --hostname 0.0.0.0 --port 3100`.
Current local preview: http://localhost:3100.
Phone on the same LAN: http://192.168.68.59:3100 (subject to host firewall).
Use slow swipes, quick forward/back swipes, rotation and the static-view button.
No physical iPhone/Android was connected for this verification; Safari and
device thermal/memory behavior remain to be validated on actual hardware.
Raw local measurements and screenshots are in ignored `.preview/`.
No production deployment was performed.
