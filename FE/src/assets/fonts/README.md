# Service fonts

Font faces are declared in `src/styles/fonts.css` and bundled by Webpack from
relative URLs. The service owns these assets; it does not depend on a design
system package or server.

## Pretendard Variable

- Use: Korean, Latin and numeric product UI text.
- Asset: `PretendardVariable.woff2`, normal variable weights 100–900.
- Source: the `bibbidi-design` font asset, adopted on 2026-10-23; originally from
  [Pretendard](https://github.com/orioncactus/pretendard/tree/main/packages/pretendard/dist/web/variable/woff2).
- License: SIL Open Font License 1.1; see `Pretendard-LICENSE.txt`.

## Nunito brand subset

The brand name `bibbidi` uses Nunito normal, weight 900. This WOFF2 contains
only `b`, `d`, and `i` (U+0062, U+0064, U+0069).

- Source: [Google Fonts CSS API](https://fonts.googleapis.com/css2?family=Nunito:wght@900&text=bibbidi&display=swap)
- License: SIL Open Font License 1.1; see [OFL.txt](./OFL.txt).
- Downloaded: 2026-10-15. Google Fonts version: v32.

If the brand text or its weight changes, regenerate the subset and update the
`unicode-range` in `src/styles/fonts.css` together.
