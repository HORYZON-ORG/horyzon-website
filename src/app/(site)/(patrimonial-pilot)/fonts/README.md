# JetBrains Mono for Evento

Self-hosted JetBrains Mono, the same approved font family, used at weights 500
and 600. Downloaded 18 October 2026 from the Latin face returned by Google Fonts
for `JetBrains Mono:wght@100..800`:

https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD7OwE.woff2

WOFF2, 40,404 bytes, variable `wght` axis 100–800. Italian accented glyphs are
present. The adjacent SIL OFL 1.1 license is copied from the existing repository
JetBrains Mono license. The PDF font files in `src/lib/radar/fonts` are unchanged.
Those files contain only static Mono 500, insufficient for Evento's real 600.

`next/font/local` avoids Next 16.3.5's parsing failure for the extensionless
`/l/font?kit=...&skey=...&v=...` URLs observed in Turbopack's generated CSS.
Family, weights, normal style, display swap and `--event-mono` are preserved.
