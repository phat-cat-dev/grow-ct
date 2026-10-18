import Adapt from 'core/js/adapt';

/**
 * Abbott theme controller.
 *
 * Adapt loads this via bower.json "main". It does three small things — the
 * look itself lives in the LESS/token layer, not here:
 *
 *   1. _courseStyle   — applies the course's _courseStyle class to <html> so
 *                       authors can set a page-wide variant.
 *   2. #ink filter    — injects ONE shared SVG turbulence filter into the page
 *                       so any element can get the hand-drawn Abbott wobble with
 *                       `filter: url(#ink)` in CSS (works on HTML and SVG alike).
 *   3. no-motion      — lets authors ship a course with decorative motion off
 *                       (config _abbott._disableMotion), and exposes a helper to
 *                       toggle it at runtime. The CSS in 25-motion.less reacts to
 *                       <html class="no-motion"> (and to prefers-reduced-motion).
 */

// One canonical ink filter for the whole theme. Keeping a single definition
// here means every scribble/mark layer wobbles consistently, and the gallery's
// per-page copies collapse to this one in a real build.
const INK_FILTER = `
<svg class="abbott-ink-defs" width="0" height="0" aria-hidden="true" focusable="false"
     style="position:absolute;width:0;height:0;overflow:hidden">
  <filter id="ink" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2"/>
  </filter>
</svg>`;

class Theme extends Backbone.Controller {
  initialize() {
    this.listenTo(Adapt, 'app:dataReady', this.onDataReady);
  }

  onDataReady() {
    const config = Adapt.course.get('_abbott') || {};

    // 1. page-wide variant
    const courseStyle = Adapt.course.get('_courseStyle');
    if (courseStyle) $('html').addClass(courseStyle);

    // 2. shared ink filter — inject once
    this.injectInkFilter();

    // 3. decorative motion off, if the course asked for it
    if (config._disableMotion === true) this.setMotion(false);
  }

  injectInkFilter() {
    if (document.getElementById('ink')) return; // already present (e.g. in markup)
    document.body.insertAdjacentHTML('beforeend', INK_FILTER);
  }

  /** Turn decorative motion on/off at runtime. setMotion(false) adds no-motion. */
  setMotion(on) {
    $('html').toggleClass('no-motion', on === false);
  }
}

export default new Theme();
