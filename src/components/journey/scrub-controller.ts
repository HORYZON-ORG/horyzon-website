type ScrubControllerDependencies = {
 currentTime: () => number;
 canSeek: () => boolean;
 seek: (time: number) => void;
};

export function scrollTime(travelled: number, range: number, duration: number) {
 const progress = Math.max(0, Math.min(1, travelled / Math.max(1, range)));
 return Math.max(0, duration) * progress;
}

export function createScrubController({ currentTime, canSeek, seek }: ScrubControllerDependencies) {
 let target = 0;

 const flush = () => {
  if (!canSeek() || Math.abs(currentTime() - target) < 1 / 60) return;
  seek(target);
 };

 return {
  update(nextTarget: number) {
   target = Math.max(0, nextTarget);
   flush();
  },
  flush,
 };
}
