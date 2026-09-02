import { SimSpec } from "./types";
import * as osc from "./oscillation";
import * as ch from "./chaos";
import * as gr from "./gravity";
import * as me from "./mechanics";
import * as wf from "./waveFluidEm";

export const sims: Record<string, SimSpec> = {
  "simple-pendulum": osc.simplePendulum,
  "driven-oscillator": osc.drivenOscillator,
  "coupled-oscillators": osc.coupledOscillators,
  "elastic-pendulum": osc.elasticPendulum,
  "parametric-pendulum": osc.parametricPendulum,
  "foucault-pendulum": osc.foucaultPendulum,
  "stick-slip": osc.stickSlip,
  "fput-chain": osc.fputChain,
  "double-pendulum": ch.doublePendulum,
  "driven-damped-pendulum": ch.drivenDampedPendulum,
  duffing: ch.duffing,
  "magnetic-pendulum": ch.magneticPendulum,
  "standard-map": ch.standardMap,
  billiards: ch.billiards,
  "henon-heiles": ch.henonHeiles,
  "chaotic-waterwheel": ch.chaoticWaterwheel,
  "inverse-square-orbit": gr.inverseSquareOrbit,
  "three-body": gr.threeBody,
  "n-body-cluster": gr.nBodyCluster,
  "relativistic-precession": gr.relativisticPrecession,
  "swinging-atwood": gr.swingingAtwood,
  "projectile-drag": me.projectileDrag,
  "rocket-equation": me.rocketEquation,
  "elastic-collisions-1d": me.elasticCollisions1d,
  "bouncing-ball": me.bouncingBall,
  "galton-board": me.galtonBoard,
  "brachistochrone-race": me.brachistochroneRace,
  "rotating-frame": me.rotatingFrame,
  "spinning-top": me.spinningTop,
  "wave-on-string": wf.waveOnString,
  "ripple-tank": wf.rippleTank,
  "doppler-effect": wf.dopplerEffect,
  "diffusion-heat": wf.diffusionHeat,
  "hanging-chain": wf.hangingChain,
  "gas-in-box": wf.gasInBox,
  "point-vortices": wf.pointVortices,
  "radioactive-decay": wf.radioactiveDecay,
  "charged-particle-fields": wf.chargedParticleFields,
  "electric-field-lines": wf.electricFieldLines,
  "quantum-tunneling": wf.quantumTunneling,
};

export type { Sim, SimSpec, Metric } from "./types";
