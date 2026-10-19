# Card and callout makers

Separate standalone tools:

- [Card system maker](../card-maker/index.html): optional header/footer, title,
  body, optional original SVG icon and shared accent-driven decoration.
- [Callout maker](../callout-maker/index.html): optional icon, title/body and
  adjustable leading accent bar.
- [Button tuner](../button-tuner/index.html): related button modifiers.

Pages work offline using shared local `maker.js` and `maker.css`.
Regenerate entry pages with `node .\tools\component-maker\build-makers.cjs`.
No dependency installation, original-studio edits or network access is needed.

## Colour model

Themed components follow brand / colour-grey / pure-grey family selection.
Plain-neutral uses the line token, distinct from the semantic neutral variant.
Semantic hues are fixed: positive 150°, neutral amber 38°, negative 5°,
comment 270°, info 200°. Saturation/lightness are adjustable independently of
brand hue. Functional labels (advice/do, warning/dont, starting, action) describe
these same semantic variants, not new palettes.

The single `--cm-accent` property drives the border, icon, header/footer tint and
fill. Plain surface, tinted, soft and invert are independent modifiers.
Inverse text uses black/white selected from accent luminance. Custom host token
overrides and blended surfaces still need destination contrast testing.
No-header/no-footer cards remove those elements rather than hiding empty areas.
Callouts are ordinary `aside` content, not automatic live alerts.

## Export and reuse

Copy HTML/CSS, download standalone HTML, download CSS or export settings JSON.
JSON is an output record; import and persistence are not implemented.
All content is escaped as text; headings may be H2, H3 or H4.
Choose the appropriate level for your destination page.
Icons are decorative SVGs because meaning is supplied by text.

CSS is scoped to `.cm-card` or `.cm-callout` and their descendants. Cards and
callouts therefore coexist without cross-tool style collisions.
For independently configured copies of the *same* kind, namespace their selectors
or use iframes so one exported stylesheet does not override another.

Tokens include `--cm-accent`, `--cm-on-accent`, `--cm-paper`, `--cm-ink`,
`--cm-line`, `--cm-pad` and `--cm-radius`.
Paper, ink and line consume existing `--surface-1`, `--ink` and `--line`
tokens when present. Family HSL tokens are exported with the current settings.
If you override the accent manually, also set a suitable `--cm-on-accent`.
No animation or scripts are needed for exported components.

Accordions are not part of these two makers.
