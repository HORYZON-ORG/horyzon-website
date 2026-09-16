"""Regenerate scroll assets: python scripts/build-journey-video.py ORIGINAL.mp4.

Requires ffmpeg on PATH or the Python imageio-ffmpeg package.
Preserves the supplied 1280x720 / 24fps source; never upscale this asset.
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
for variant, quality in [('web', 20), ('mobile', 25)]:
    subprocess.run([
        ffmpeg, '-hide_banner', '-y', '-i', str(source), '-map', '0:v:0',
        '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(quality),
        '-g', '1', '-keyint_min', '1', '-bf', '0', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', str(destination / f'horizon-{variant}.mp4')
    ], check=True)
