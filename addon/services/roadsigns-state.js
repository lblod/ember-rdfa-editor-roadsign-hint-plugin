import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { reads } from '@ember/object/computed';

export default Service.extend({
  addressregister: service(),
  hintPlugin: service('rdfa-editor-roadsign-hint-plugin'),
  roadsignsWithConcepts: reads('hintPlugin.roadsignsWithConcepts'),

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
  getRoadsignsWithConcepts(besluitUri) {
    return this.roadsignsWithConcepts.filter( roadsignWithConcept => {
      return (roadsignWithConcept.roadsign.besluitUri == besluitUri) ? true : false;
    })
  },

  /**
   * Remove a roadsign listed in the cards
   *
   * @method removeRoadsignInCards
   *
   * @param {string} uri of the roadsign we want to remove
   *
   * @public
   */
  removeRoadsignInCards(roadsignUri) {
    const roadsignWithConcept = this.roadsignsWithConcepts.find(roadsignWithConcept => {
      return roadsignWithConcept.roadsign.uri == roadsignUri;
    })
    this.roadsignsWithConcepts.removeObject(roadsignWithConcept);
  }
});
