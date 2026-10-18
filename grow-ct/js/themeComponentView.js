import ThemeView from './themeView';
import { stampMeta } from './growMeta';

export default class ThemeComponentView extends ThemeView {

  className() {}

  setCustomStyles() {
    stampMeta(this.$el, this.model.get('_frontmatter'), { role: 'learning-step', depth: 4 });
  }

  onRemove() {}

}
