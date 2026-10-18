import Adapt from 'core/js/adapt';
import ThemePageView from './themePageView';
import ThemeArticleView from './themeArticleView';
import ThemeBlockView from './themeBlockView';
import ThemeComponentView from './themeComponentView';
import ThemeView from './themeView';

// One canonical ink filter for the whole theme — so any element can take the
// hand-drawn Grow wobble with `filter: url(#ink)` in CSS (HTML or SVG).
const INK_FILTER = `
<svg class="ink-defs" width="0" height="0" aria-hidden="true" focusable="false"
     style="position:absolute;width:0;height:0;overflow:hidden">
  <filter id="ink" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2"/>
  </filter>
</svg>`;

class Theme extends Backbone.Controller {

  initialize() {
    this.listenTo(Adapt, {
      'app:dataReady': this.onDataReady,
      'pageView:postRender articleView:postRender blockView:postRender componentView:postRender': this.onPostRender
    });
  }

  onDataReady() {
    $('html').addClass(Adapt.course.get('_courseStyle'));
    this.addFavIcon();
    this.injectInkFilter();
    if (Adapt.course.get('_grow')?._disableMotion === true) $('html').addClass('no-motion');
  }

  injectInkFilter() {
    if (document.getElementById('ink')) return;
    document.body.insertAdjacentHTML('beforeend', INK_FILTER);
  }

  /** Turn decorative motion on/off at runtime. setMotion(false) adds no-motion. */
  setMotion(on) {
    $('html').toggleClass('no-motion', on === false);
  }

  addFavIcon() {
    const favIcon = Adapt.course.get('_grow')?._favIcon;
    if (!favIcon?._src) return;
    const $head = $('head');
    if (favIcon._svg) {
      $head.append($(`<link rel="icon" type="image/svg+xml" href="${favIcon._svg}" />`));
    }
    $head.append($(`<link rel="icon" href="${favIcon._src}" />`));
    const appleSrc = favIcon._appleTouch || favIcon._src;
    $head.append($(`<link rel="apple-touch-icon" href="${appleSrc}" />`));
  }

  onPostRender(view) {
    const viewModel = view.model;
    const theme = viewModel.get('_grow');
    if (!theme) return;
    const model = new Backbone.Model(theme);
    const el = view.$el;
    switch (viewModel.get('_type')) {
      case 'page':
        new ThemePageView({ model, el });
        break;
      case 'article':
        new ThemeArticleView({ model, el });
        break;
      case 'block':
        new ThemeBlockView({ model, el });
        break;
      case 'component':
        new ThemeComponentView({ model, el });
        break;
      default:
        new ThemeView({ model, el });
    }
  }

}

export default new Theme();
