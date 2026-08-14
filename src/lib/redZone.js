/**
 * Independent hotels do not participate in the Red Zone kicker.
 * Use this to decide whether to render a Red Zone status or show N/A.
 */
export function isRedZoneApplicable(property) {
  return property?.parent_brand !== 'Independent';
}