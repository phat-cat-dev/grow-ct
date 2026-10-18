<div id="top"></div>

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![GPL-3.0 License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/phat-cat-dev/grow-ct/tree/main/grow-ct">
    <!-- drop a logo at grow-ct/assets/logo.png when you have one -->
    🌱
  </a>

<h3 align="center">ADAPT &amp; GROW</h3>

  <p align="center">
    A fluid, token-driven standalone theme for the Adapt e-learning framework — one hue plus type/space dials drive the whole look, a universal frontmatter metadata layer rides every level, and the content comes with hand-drawn “ink” animation built in.
    <br />
    <a href="https://github.com/phat-cat-dev/grow-ct/blob/main/docs/grow-base-architecture.md"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/phat-cat-dev/grow-ct/blob/main/gallery/grow-lesson.html">View a lesson preview</a>
    ·
    <a href="https://github.com/phat-cat-dev/grow-ct/issues">Report Bug</a>
    ·
    <a href="https://github.com/phat-cat-dev/grow-ct/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul><li><a href="#built-with">Built With</a></li></ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#the-grow-layer">The GROW layer</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

**ADAPT &amp; GROW** (`grow-ct`) is a complete, standalone theme for the
[Adapt framework](https://github.com/adaptlearning/adapt_framework). Where the
default theme (vanilla) is a fixed design, GROW is a **design *system*** driven
by a handful of dials, plus a **data layer** that travels with every structural
level of a course.

Three ideas hold it together:

- **One engine, a few dials.** One hue (`--h`) drives the whole colour palette;
  a type-scale dial and a space-density dial drive a fully fluid `clamp()` type
  ramp and spacing scale. Change a dial, reskin everything — chrome and content,
  light and dark.
- **A universal frontmatter / metadata layer.** Every level (lesson → phase →
  section → component → step → item) can carry `_grow` metadata. It is stamped
  onto the DOM as `data-grow-role` / `data-grow-level` (`dNN`) / `data-grow-type`
  and `data-fm-*` **always** — whether or not it is displayed — so non-presentational
  data lives on the element, not in the markup. A `_display` flag decides what
  renders.
- **Role-based BEM.** One reusable `.frontmatter` block (and `.lesson / .phase /
  .section / .component / .step / .item` structural blocks) vary by modifier, not
  by prefix. Classes read as plain CSS; `grow` lives only in `data-*` and tokens.

It is a fork of `adapt-contrib-vanilla` (so **GPL-3.0**), with vanilla's proven
shell painting re-driven by the GROW token engine, plus template/view overrides
that add the frontmatter data-layer and the custom lesson structure.

<p align="right">(<a href="#top">back to top</a>)</p>

### Built With

* [Adapt framework](https://github.com/adaptlearning/adapt_framework) &middot; [adapt-contrib-core](https://github.com/adaptlearning/adapt-contrib-core)
* [LESS](https://lesscss.org/)
* [Handlebars](https://handlebarsjs.com/) &middot; [JSX / React](https://react.dev/) (for interactive components)
* [Backbone.js](https://backbonejs.org/)
* [Grunt](https://gruntjs.com/) &middot; [Node.js](https://nodejs.org/)
* [Docker](https://www.docker.com/)

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

You can see the theme two ways: open the **standalone gallery previews** in a
browser (no build), or build it into a real Adapt course.

### Prerequisites

Either:

* **Docker** (easiest — nothing else to install), or
* **Node.js ≥ 18** + the Adapt CLI and Grunt
  ```sh
  npm install -g adapt-cli grunt-cli
  ```

### Installation

**Option A — Docker (one command, builds + serves):**
```sh
git clone https://github.com/phat-cat-dev/grow-ct.git
cd grow-ct
docker compose up --build        # → http://localhost:8080
```
First run clones the Adapt framework, installs plugins, drops this theme in, sets
the course `_theme`, builds and serves. See [`docker/README.md`](../docker/README.md).

**Option B — into an existing Adapt framework build:**
```sh
cp -r grow-ct  <framework>/src/grow-ct
```
```jsonc
// <framework>/src/course/config.json
{ "_theme": "grow-ct", "_menu": "adapt-contrib-boxMenu" }
```
```sh
grunt build        # or: grunt dev   (watch)
```

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- USAGE -->
## Usage

**Turn the dials** (in `less/_defaults/_grow-tokens.less`, or per section at
runtime):
```css
:root{ --h: 24; }            /* rotate the whole palette          */
:root{ --type-scale: 1.1; }  /* 10% larger type, fluidly          */
:root{ --space-scale: 0.9; } /* 10% tighter rhythm                */
```

**Author frontmatter / metadata** on any level (course / page / article / block
/ component) under the `_grow` target attribute:
```jsonc
"_grow": {
  "_frontmatter": {
    "_isEnabled": true,
    "_display": true,                       // false = metadata-only (data-fm-* only)
    "eyebrow": "Module 2 · Lesson 3",
    "_fields": [
      { "_key": "duration", "label": "Duration", "value": "12 min", "_display": true },
      { "_key": "owner",    "label": "Author",   "value": "stuart", "_display": false }
    ],
    "_objectives": ["Explain where colour comes from in a token system"]
  }
}
```

**See it rendered** — open any of these in a browser:

| Preview | Shows |
|---|---|
| [`gallery/grow-lesson.html`](../gallery/grow-lesson.html) | A full lesson — hero + objectives, article frontmatter, phase cards, sections, components — with a “reveal data layer” toggle |
| [`gallery/grow-structure.html`](../gallery/grow-structure.html) | The template-override structure (frontmatter section + two-column block) with a show-structure toggle |
| [`gallery/grow-stacks.html`](../gallery/grow-stacks.html) | How the theme layers onto Adapt (the two build stacks) |

_Full reference: [`docs/grow-base-architecture.md`](../docs/grow-base-architecture.md),
[`docs/grow-data-presentation-map.md`](../docs/grow-data-presentation-map.md),
[`docs/grow-adapt-mapping-spec.md`](../docs/grow-adapt-mapping-spec.md)._

<p align="right">(<a href="#top">back to top</a>)</p>

## The GROW layer

```
less/_defaults/_grow-tokens.less   the token engine (colour hue + fluid type + fluid space)
less/_defaults/_colors.less        bridges vanilla's palette onto the GROW colours
less/grow-*.less                   content kit (marks, bullets, backgrounds, washes, heroes)
                                   + grow-structure / grow-lesson (frontmatter, columns, phase cards)
templates/*.hbs                    page/article/block overrides + the _grow-frontmatter partial
js/growMeta.js                     stamps the data layer (data-grow-* / data-fm-*)
js/theme*.js                       theme views; inject the #ink filter; route columns
schema/grow-structure.schema.json  the _grow field shapes
examples/*.json                    worked course fragments
```

Companion package [`packages/grow-core-base/`](../packages/grow-core-base/)
holds the “adab” style-tier scaffold (the generator target) and a buildable
assembly config.

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

- [x] Token engine wired into the theme (colour / type / space dials)
- [x] Universal frontmatter / metadata data-layer (`_grow`, `data-grow-*`)
- [x] Role-based BEM structural objects + per-phase cards
- [x] Docker build/serve environment
- [ ] Verify the live `grunt build` (themeBlockView column routing, schema merge in the authoring tool)
- [ ] Live-retint the chrome surfaces (opt-in `var()` on direct-use vars)
- [ ] JSX components for the interactive learning-steps
- [ ] A theme/layout generator that writes the token profiles
- [ ] Tag & publish **v1.0.0**

See the [open issues](https://github.com/phat-cat-dev/grow-ct/issues) for the full list.

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions are welcome. Fork the repo, create a feature branch, and open a PR;
or open an issue with the `enhancement` tag. If you like it, star the repo!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- LICENSE -->
## License

**GPL-3.0** — `grow-ct` is a fork of
[adapt-contrib-vanilla](https://github.com/adaptlearning/adapt-contrib-vanilla)
(GPL-3.0); vanilla's shell LESS, button mixins, theme views and schema are
retained and re-driven by the GROW engine. See [`LICENSE`](LICENSE). (The wider
asset kit at the repository root is MIT; this theme is GPL-3.0 by inheritance.)

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Maintainer: [@phat-cat-dev](https://github.com/phat-cat-dev) · _add your preferred contact here_

Project Link: [https://github.com/phat-cat-dev/grow-ct](https://github.com/phat-cat-dev/grow-ct)

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [The Adapt community & adapt-contrib-vanilla](https://github.com/adaptlearning)
* [Best-README-Template](https://github.com/othneildrew/Best-README-Template)

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/phat-cat-dev/grow-ct.svg?style=for-the-badge
[contributors-url]: https://github.com/phat-cat-dev/grow-ct/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/phat-cat-dev/grow-ct.svg?style=for-the-badge
[forks-url]: https://github.com/phat-cat-dev/grow-ct/network/members
[stars-shield]: https://img.shields.io/github/stars/phat-cat-dev/grow-ct.svg?style=for-the-badge
[stars-url]: https://github.com/phat-cat-dev/grow-ct/stargazers
[issues-shield]: https://img.shields.io/github/issues/phat-cat-dev/grow-ct.svg?style=for-the-badge
[issues-url]: https://github.com/phat-cat-dev/grow-ct/issues
[license-shield]: https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=for-the-badge
[license-url]: https://github.com/phat-cat-dev/grow-ct/blob/main/grow-ct/LICENSE
