type ScrubControllerDependencies = {
 currentTime: () => number;
 canSeek: () => boolean;
 seek: (time: number) => void;
};

export function scrollTime(travelled: number, range: number, duration: number) {
 const progress = Math.max(0, Math.min(1, travelled / Math.max(1, range)));
 return Math.max(0, duration) * progress;
}

export function journeyFocalPoint(time: number, mobile: boolean) {
 const stops = mobile
  ? [[0, .45], [1, .46], [2, .47], [3, .48], [4, .49], [5, .51], [5.5, .53]]
  : [[0, .66], [1, .64], [2, .615], [3, .58], [4, .545], [4.5, .52], [5, .5], [5.5, .5]];
 const focal = stops[stops.length - 1][1];
 for (let i = 1; i < stops.length; i++) {
  if (time <= stops[i][0]) {
   const [start, from] = stops[i - 1];
   const [end, to] = stops[i];
   return from + (to - from) * Math.max(0, (time - start) / (end - start));
  }
 }
 return focal;
}

export function createScrubController({ currentTime, canSeek, seek }: ScrubControllerDependencies) {
 let target = 0;

 const flush = () => {
  if (!canSeek() || Math.abs(currentTime() - target) < 1 / 60) return;
  seek(target);
 };

 return {
  update(nextTarget: number) {
   // The source is 24fps. Sub-frame seeks cost decoding without new imagery.
   target = Math.floor(Math.max(0, nextTarget) * 24 + 1e-7) / 24;
   flush();
  },
  flush,
 };
}
