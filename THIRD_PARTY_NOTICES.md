# Third-party notices

The Maricopa SBDC advisor dashboards (Client Intake and Advisor Toolbox) use the open-source work listed below. The full license texts ship with each site in `assets/`.

| Component | Use | License | License file |
|---|---|---|---|
| Tabler 1.7.3 (tabler.io), © The Tabler Authors / codecalm.net Paweł Kuna | Base CSS (`assets/tabler.min.css`, trimmed to the rules the pages use) | MIT | `assets/LICENSE-tabler.txt` |
| Tabler Icons (tabler.io/icons) | Inline SVG icons (`js/icons.js`) | MIT | `assets/LICENSE-tabler-icons.txt` |
| Vision UI Dashboard by Simmmple & Creative Tim | Visual style (gradients, glass cards) | MIT | `assets/LICENSE-vision-ui.txt` |
| Plus Jakarta Sans by Tokotype | Web font (`assets/fonts`) | SIL Open Font License 1.1 | `assets/fonts/LICENSE-OFL-plus-jakarta-sans.txt` |
| shadcn/ui and Tremor | Layout patterns only (no code copied) | MIT | n/a |
| Business Model Canvas by Strategyzer (strategyzer.com) | Printable canvas (`pages/bmc.html`) | CC BY-SA 3.0 | credited on the printable |
| Sidebar and tile illustrations | Original SBDC production site icons (`assets/img`) | Maricopa SBDC | n/a |

## Landscape image
Self-hosted `assets/img/landscape.webp` is an original generated oil-paint landscape created for this restyle. No third-party stock license is required.

## Fonts
Instrument Serif and DM Sans are loaded from Google Fonts (SIL Open Font License).
The custom SBDC lettermark uses Instrument Serif outlines (SIL Open Font License), arranged as an original mark. It is not official SBDC or SBA trademark artwork.

## Chrome extension (`extension/`)
- `extension/fonts`: DM Sans (variable, latin) and Instrument Serif (400, latin) packaged from the Fontsource builds, SIL Open Font License 1.1. License texts are next to the files.
- `extension/lib/icons.js`: Tabler Icons (MIT), same set as the dashboard.
- `extension/img/landscape.webp`: copy of `assets/img/landscape.webp`.
- Tests use Playwright (Apache 2.0) as a dev-only tool. It is not part of the extension.
