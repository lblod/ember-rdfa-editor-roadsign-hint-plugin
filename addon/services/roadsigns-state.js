import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { A } from '@ember/array';

export default Service.extend({
  addressregister: service(),
  hintPlugin: service('rdfa-editor-roadsign-hint-plugin'),
  roadsignsWithConcepts: A(),

  async init() {
    this._super(...arguments);
    this.set('roadsignsWithConcepts', await this.addAddressToRoadsigns(this.hintPlugin.roadsignsWithConcepts));
  },

  /**
   * Get all the roadsign related to a decision
   *
   * @method getRoadsignsWithConcepts
   *
   * @param string Uri of the decision
   *
   * @param {Array} roadsigns of the decision and their concepts
   *
   * @public
   */

  // TODO Use getRoadsignsWithConcepts to get only the roadsigns that are in the
  // besluit of the hint card. It now gets all the roadsigns from all the besluiten.
  // Currently not working because of the async init() (adding the readable addresses
  // to the roadsigns)

  // getRoadsignsWithConcepts(besluitUri) {
  //   return this.roadsignsWithConcepts.filter( roadsign => {
  //     (roadsign.besluitUri == besluitUri) ? true : false;
  //   })
  // },

  /**
   * Remove a roadsign listed in the cards
   *
   * @method removeRoadsignInCards
   *
   * @param {Object} object containing the roadsign and its concept
   *
   * @public
   */
  removeRoadsignInCards(roadsignWithConcept) {
    this.roadsignsWithConcepts.removeObject(roadsignWithConcept);
  },

  /**
   * Add human readable addresses to the roadsign list
   *
   * @method addAddressToRoadsigns
   *
   * @param {Array} array of objects containing the roadsigns and their concepts
   *
   * @return {Array} array of objects containing the roadsigns with their addresses and their concepts
   *
   * @private
   */
  async addAddressToRoadsigns(roadsignsWithConcepts) {
    for (let roadsignWithConcept of roadsignsWithConcepts) {
      const [lat, lon] = this.addressregister.getLatLon(roadsignWithConcept.roadsign.point);
      const address = await this.addressregister.getLocation(lat, lon);

      if(address && address.length > 0) {
        roadsignWithConcept.roadsign.set('address', address.firstObject.fullAddress);
      } else {
        roadsignWithConcept.roadsign.set('address', roadsignWithConcept.roadsign.point);
      }
    }
    return roadsignsWithConcepts;
  }
});