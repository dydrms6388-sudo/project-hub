import { Renderer } from "./types";
import * as gs from "./geometrySize";
import * as ga from "./geometryAngle";
import * as br from "./brightness";
import * as cc from "./colorContour";
import * as fd from "./fading";
import * as mo from "./motion";
import * as am from "./ambiguous";

export const renderers: Record<string, Renderer> = {
  "muller-lyer": gs.mullerLyer,
  ponzo: gs.ponzo,
  ebbinghaus: gs.ebbinghaus,
  delboeuf: gs.delboeuf,
  "vertical-horizontal": gs.verticalHorizontal,
  "oppel-kundt": gs.oppelKundt,
  sander: gs.sander,
  jastrow: gs.jastrow,
  "helmholtz-squares": gs.helmholtzSquares,
  zollner: ga.zollner,
  "hering-wundt": ga.heringWundt,
  poggendorff: ga.poggendorff,
  orbison: ga.orbison,
  "cafe-wall": ga.cafeWall,
  "fraser-spiral": ga.fraserSpiral,
  "hermann-grid": br.hermannGrid,
  "simultaneous-contrast": br.simultaneousContrast,
  "mach-bands": br.machBands,
  "whites-illusion": br.whitesIllusion,
  cornsweet: br.cornsweet,
  "checker-shadow": br.checkerShadow,
  ehrenstein: br.ehrenstein,
  "kanizsa-triangle": cc.kanizsaTriangle,
  "neon-color-spreading": cc.neonColorSpreading,
  "watercolor-illusion": cc.watercolorIllusion,
  "color-afterimage": cc.colorAfterimage,
  bezold: cc.bezold,
  troxler: fd.troxler,
  "blind-spot": fd.blindSpot,
  "motion-aftereffect": mo.motionAftereffect,
  "phi-beta": mo.phiBeta,
  ternus: mo.ternus,
  "induced-motion": mo.inducedMotion,
  barberpole: mo.barberpole,
  "kinetic-depth": mo.kineticDepth,
  stereokinetic: mo.stereokinetic,
  "necker-cube": am.neckerCube,
  "schroeder-stairs": am.schroederStairs,
  "rubin-vase": am.rubinVase,
  "penrose-triangle": am.penroseTriangle,
};

export type { Renderer, RenderOpts, DrawFn } from "./types";
