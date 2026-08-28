import localFont from "next/font/local";
import { VT323 } from "next/font/google";

// Pixelated MS Sans Serif by lou (FontStruct), CC BY-SA 3.0. See MS-SANS-SERIF-LICENSE.txt.
export const msSans = localFont({
  src: [
    { path: "./ms_sans_serif.woff2", weight: "400", style: "normal" },
    { path: "./ms_sans_serif_bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ui",
  display: "swap",
  preload: true,
});

export const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-term",
  display: "swap",
  preload: false,
});
