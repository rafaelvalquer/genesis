import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createRocketOrbitNodes, updateRocketOrbit } from "./createRocketOrbit.js";

describe("orientação orbital do foguete", () => {
  it("alinha o nariz ao movimento e o topo para fora do planeta", () => {
    const parent = new THREE.Group();
    const rocket = createRocketOrbitNodes({ THREE, parent, quality: { quality: "high" }, biome: { atmosphere: "#22d3ee" }, model: new THREE.Group() });
    updateRocketOrbit(THREE, rocket, 3.25, false);
    const forward = rocket.forward.clone().applyQuaternion(rocket.motionNode.quaternion).normalize();
    const up = rocket.up.clone().applyQuaternion(rocket.motionNode.quaternion).normalize();
    const current = rocket.motionNode.position.clone();
    const angle = 3.25 * Math.PI * 2 / 24;
    const nextAngle = angle + .025;
    const next = new THREE.Vector3(Math.cos(nextAngle) * 1.55, Math.sin(nextAngle * .65) * .25, Math.sin(nextAngle) * 1.25);
    const tangent = next.sub(current).normalize();
    const radial = current.clone().normalize();
    const desiredUp = radial.clone()
      .addScaledVector(tangent, -radial.dot(tangent))
      .normalize();
    expect(forward.dot(tangent)).toBeGreaterThan(.999);
    expect(up.dot(desiredUp)).toBeGreaterThan(.999);
  });
});
