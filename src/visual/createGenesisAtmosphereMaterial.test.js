import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createGenesisAtmosphereMaterial } from "./createGenesisAtmosphereMaterial.js";

describe("Fresnel da atmosfera Genesis", () => {
  it("calcula normal, direção de câmera e luz em world space", () => {
    const material = createGenesisAtmosphereMaterial(THREE);
    expect(material.vertexShader).toContain("varying vec3 vWorldNormal");
    expect(material.vertexShader).toContain("mat3(modelMatrix) * normal");
    expect(material.fragmentShader).toContain("cameraPosition - vWorldPosition");
    expect(material.fragmentShader).toContain("dot(normalize(vWorldNormal), normalize(uLightDirection))");
    expect(material.vertexShader).not.toContain("normalMatrix * normal");
    material.dispose();
  });

  it("mantém a direção da luz normalizada após sincronização", () => {
    const material = createGenesisAtmosphereMaterial(THREE);
    material.userData.setGenesisLightDirection(new THREE.Vector3(3, 2, 4));
    expect(material.uniforms.uLightDirection.value.length()).toBeCloseTo(1);
    material.dispose();
  });
});
