// Fonts embedded as data: URIs so the exported surprise file is fully self-contained
// (no request to Google Fonts, works offline, and nothing is sent to a third party).
import figtree500 from "@fontsource/figtree/files/figtree-latin-500-normal.woff2?inline";
import figtree600 from "@fontsource/figtree/files/figtree-latin-600-normal.woff2?inline";
import caveat600 from "@fontsource/caveat/files/caveat-latin-600-normal.woff2?inline";
import cormorant600 from "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-italic.woff2?inline";
import cormorant700 from "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-italic.woff2?inline";

const face = (family: string, weight: number, style: string, src: string) =>
  `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};font-display:swap;src:url(${src}) format("woff2")}`;

export const giftFontCss = [
  face("Figtree", 500, "normal", figtree500),
  face("Figtree", 600, "normal", figtree600),
  face("Caveat", 600, "normal", caveat600),
  face("Cormorant Garamond", 600, "italic", cormorant600),
  face("Cormorant Garamond", 700, "italic", cormorant700)
].join("\n");
