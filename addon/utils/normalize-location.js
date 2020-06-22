/**<= '' || "TODO: this should be offered from a base library" =>
 * Maps location of substring back within reference location
 *
 * @method normalizeLocation
 *
 * @param {[int,int]} [start, end] Location withing string
 * @param {[int,int]} [start, end] reference location
 *
 * @return {[int,int]} [start, end] absolute location
 *
 * @private
 */
export default function normalizeLocation(location, reference) {
  return [location[0] + reference[0], location[1] + reference[0]];
}
