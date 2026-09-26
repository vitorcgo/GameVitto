/** Export-only light prototypes and shadow proxies in the local OBJ pack. */
export function sourceHelperMaterial(name) {
  // These two unplaced light components sit at the source origin, across the
  // actual road. Keep fc_StadiumLight_CubeMap: its roof lights are placed scenery.
  return name === 'fc_StaticShadow' || name === 'fc_LightObj_CubeMap' || name === 'fc_nuki_3_CubeMap';
}
