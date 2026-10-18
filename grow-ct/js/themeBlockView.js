import ThemeView from './themeView';
import { stampMeta } from './growMeta';

export default class ThemeBlockView extends ThemeView {

  className() {
    return this.model.get('_isDividerBlock') ? 'is-divider-block' : '';
  }

  setCustomStyles() {
    stampMeta(this.$el, this.model.get('_frontmatter'), { role: 'section', depth: 3 });
    this.processHeader();
    this.setPaddingTop();
    this.setPaddingBottom();
    this.setComponentVerticalAlignment();
    this.setComponentHorizontalAlignment();
    this.arrangeColumns();
  }

  // ---- grow columns -------------------------------------------------------
  // When _grow._columns is authored, block.hbs renders empty column mounts
  // (.col__components) plus the normal staging .component__container that
  // Adapt appends components into. Each column claims components by _id; we move
  // the matching component elements into their column. A MutationObserver covers
  // the timing — component child views may append after this view is created.
  arrangeColumns() {
    const columns = this.model.get('_columns');
    if (!columns || !this.$('.cols').length) return;

    const idToColumn = new Map();
    columns.forEach((col, i) => (col._components || []).forEach(id => idToColumn.set(id, i)));

    const staging = this.$('.component__container')[0];
    if (!staging) return;

    const move = () => {
      let movedAll = true;
      staging.querySelectorAll('[data-adapt-id]').forEach(el => {
        const i = idToColumn.get(el.getAttribute('data-adapt-id'));
        if (i === undefined) { movedAll = false; return; } // unassigned: leave in place
        const target = this.$(`[data-grow-col-components="${i}"]`)[0];
        if (target) target.appendChild(el);
      });
      // once every assigned component is placed, hide the empty staging container
      const remaining = staging.querySelectorAll('[data-adapt-id]').length;
      if (remaining === 0) staging.setAttribute('hidden', '');
      return movedAll && remaining === 0;
    };

    if (move()) return;                    // already all present — done
    // otherwise watch for components arriving, then move + stop
    const obs = new MutationObserver(() => { if (move()) obs.disconnect(); });
    obs.observe(staging, { childList: true });
    this._growColObserver = obs;
  }

  processHeader() {
    const header = this.model.get('_blockHeader');
    if (!header) return;
    const $header = this.$('.block__header');
    this.setTextAlignment(header);
    this.addHeaderBackgroundLayer($header);
    this.setHeaderBackgroundImage(header, $header);
    this.setHeaderBackgroundStyles(header, $header);
    this.setHeaderMinimumHeight(header, $header);
  }

  setPaddingTop() {
    const paddingTop = this.model.get('_paddingTop');
    if (!paddingTop) return;
    this.$el.addClass(`${paddingTop}-padding-top`);
  }

  setPaddingBottom() {
    const paddingBottom = this.model.get('_paddingBottom');
    if (!paddingBottom) return;
    this.$el.addClass(`${paddingBottom}-padding-bottom`);
  }

  setComponentVerticalAlignment() {
    const componentVerticalAlignment = this.model.get('_componentVerticalAlignment');
    if (!componentVerticalAlignment) return;
    this.$el.addClass(`align-vert-${componentVerticalAlignment}`);
  }

  setComponentHorizontalAlignment() {
    const componentHorizontalAlignment = this.model.get('_componentHorizontalAlignment');
    if (!componentHorizontalAlignment) return;
    this.$el.addClass(`align-horz-${componentHorizontalAlignment}`);
  }

  onRemove() {
    if (this._growColObserver) this._growColObserver.disconnect();
  }

}
