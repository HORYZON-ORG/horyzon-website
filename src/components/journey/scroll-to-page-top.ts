export type ScrollTo = (options: ScrollToOptions) => void;

export function scrollToPageTop(reducedMotion: boolean, scrollTo: ScrollTo = window.scrollTo.bind(window)) {
 scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
}
