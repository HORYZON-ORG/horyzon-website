"""Regenerate seek-friendly scroll assets from the supplied master video.

Requires ffmpeg on PATH or the Python imageio-ffmpeg package. The web asset
keeps up to 1080p detail; the lighter mobile asset is capped at 720p. Sources
below either ceiling are never upscaled.
"""
import argparse
from pathlib import Path
import shutil
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
args = parser.parse_args()
source = args.source.resolve(strict=True)
ffmpeg = shutil.which('ffmpeg')
if not ffmpeg:
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
destination = Path(__file__).resolve().parents[1] / 'public' / 'journey'
variants = [
    ('web', 22, "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease"),
    ('mobile', 25, "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease"),
]
for variant, quality, scale in variants:
    subprocess.run([
        ffmpeg, '-hide_banner', '-y', '-i', str(source), '-map', '0:v:0',
        '-an', '-vf', scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', str(quality),
        '-g', '1', '-keyint_min', '1', '-bf', '0', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', str(destination / f'horizon-{variant}.mp4')
    ], check=True)
