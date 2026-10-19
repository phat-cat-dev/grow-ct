# Standalone button modifier tuner

Open [the tool](index.html) directly or through a local server. No build,
framework, external fonts, network service or storage is required.
The original HSL tuner is unchanged.

Three families (brand, blue-grey, neutral) and shades 200–900 reuse the original
lightness ladder: 84, 73, 60, 48, 40, 32, 24 and 17 percent.
Four interaction modifiers preserve the original concepts: inverse flip, shaded,
outline and ghost. Hover and keyboard focus both preview the interaction.

Modifiers include hue, two saturations, selected family/shade, font size/weight,
corner radius, border width, padding, tracking, transition duration, shadow,
full width, disabled state and label. Click any swatch to select it.
Forced hover/pressed states affect only the selected preview and are never
exported. Matrix buttons remain usable when the selected specimen is disabled.
Reduced motion removes transitions.

Copy HTML + scoped CSS, download a self-contained HTML specimen, or export
settings JSON. JSON is an output record, not an import/persistence mechanism.
Exported buttons are native buttons with no click action attached. Output uses
`.bt-scope`, family/shade classes and `--bt-*` tokens. Avoid overriding two
different configurations on the same `.bt-scope`; isolate exports or namespace
their selectors when combining independently tuned designs.

Filled-state foregrounds choose black or white from calculated sRGB relative
luminance, rather than assuming every dark numbered shade needs white text.
This intentionally improves on the original fixed shade-based foregrounds.
The displayed contrast is for the solid normal state only, not an accessibility
guarantee for every modifier, opacity, hover colour or destination background.
Test outline/ghost shades on their real host surfaces.
