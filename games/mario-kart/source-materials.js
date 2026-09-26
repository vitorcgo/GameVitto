/** Surface treatment for the optional locally converted course. */
export function finishSourceFiltering(material) {
  // glTF samplers do not retain the converter's anisotropic filtering.
  // Restore it after loading so oblique road markings and grain stay readable.
  // Three.js clamps the requested level to the GPU's supported maximum.
  for (const texture of Object.values(material)) {
    if (!texture?.isTexture || texture.isRenderTargetTexture) continue;
    if (texture.anisotropy === 8) continue;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }
}
export function isSourceAsphalt(name) {
  return /^(fc_road(?:_G|_MARIOKART|_WhiteLine(?:_G)?)?|fc_ColorRoad|fc_RoadOther2(?:_G)?)$/.test(name);
}
export function finishSourceAsphalt(material) {
  if (!isSourceAsphalt(material.name)) return;
  // Source reflectivity/normal textures carry the aggregate pattern. Balance
  // their response under our stadium lights without painting new grain into
  // the albedo. These are authored PBR values, not Nintendo shader constants.
  const paintedLane = material.name === 'fc_ColorRoad';
  material.roughness = (material.roughnessMap ? 1 : .52) * (paintedLane ? 1 : .85);
  material.normalScale?.setScalar(paintedLane ? 1.1 : 2.2);
  material.color.setScalar(paintedLane ? 1 : .55);
}
export function finishSourceLights(material) {
  if (!material.emissiveMap) return;
  if (/^fc_(?:StadiumLight(?:_CubeMap)?|LightObj(?:\.002|_NoBake)?|nuki_[23])$/.test(material.name)) {
    material.emissiveIntensity = 3.2;
  } else if (/^fc_(?:window_[12]|Enkei_Building_(?:Plane|3D))$/.test(material.name)) {
    material.emissiveIntensity = 1.25;
  } else if (material.name === 'fc_StadiumSignboard') {
    material.emissiveIntensity = .9;
  }
}
