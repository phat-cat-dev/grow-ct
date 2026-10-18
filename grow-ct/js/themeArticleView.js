import ThemeView from './themeView';
import { stampMeta } from './growMeta';

export default class ThemeArticleView extends ThemeView {

  className() {}

  setCustomStyles() {
    stampMeta(this.$el, this.model.get('_frontmatter'), { role: 'phase', depth: 2 });
    this.processHeader();
  }

  processHeader() {
    const header = this.model.get('_articleHeader');
    if (!header) return;
    const $header = this.$('.article__header');
    this.setTextAlignment(header);
    this.addHeaderBackgroundLayer($header);
    this.setHeaderBackgroundImage(header, $header);
    this.setHeaderBackgroundStyles(header, $header);
    this.setHeaderMinimumHeight(header, $header);
  }

  onRemove() {}

}
