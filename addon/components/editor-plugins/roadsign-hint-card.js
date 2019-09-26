import { reads } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/roadsign-hint-card';
import { inject as service } from '@ember/service';
import { computed }  from '@ember/object';

/**
* Card displaying a hint of the Date plugin
*
* @module editor-roadsign-hint-plugin
* @class RoadsignHintCard
* @extends Ember.Component
*/
export default Component.extend({
  layout,
  hintPlugin: service('rdfa-editor-roadsign-hint-plugin'),

  /**
   * Region on which the card applies
   * @property location
   * @type [number,number]
   * @private
  */
  location: reads('info.location'),

  /**
   * Unique identifier of the event in the hints registry
   * @property hrId
   * @type Object
   * @private
  */
  hrId: reads('info.hrId'),

  /**
   * The RDFa editor instance
   * @property editor
   * @type RdfaEditor
   * @private
  */
  editor: reads('info.editor'),

  /**
   * Hints registry storing the cards
   * @property hintsRegistry
   * @type HintsRegistry
   * @private
  */
  hintsRegistry: reads('info.hintsRegistry'),

  roadsigns: reads('hintPlugin.roadsigns'),

  /**
   * The array of all roadsings(mobiliteit:Verkeersteken) which are not referenced from any article
   */
  unreferencedRoadsigns: computed ('roadsigns.[]', 'info.editor', function() {
    const triples = this.info.editor.triplesDefinedInResource( this.info.besluitUri );

    return this.roadsigns
      .filter ( sign => sign.besluitUri === this.info.besluitUri)
      .filter ( sign => {
        const regel = triples.find(t => t.predicate === `${this.hintPlugin.mobiliteit}wordtAangeduidDoor` && t.object === sign.uri);
        return !regel || !triples.some(t => t.predicate === `${this.hintPlugin.mobiliteit}heeftMobiliteitsMaatregel` && t.object === regel.subject);
      });
  }),

  actions: {
    insert(){
      // this.get('hintsRegistry').removeHintsAtLocation(this.get('location'), this.get('hrId'), 'editor-plugins/roadsign-hint-card');
      // const mappedLocation = this.get('hintsRegistry').updateLocationToCurrentIndex(this.get('hrId'), this.get('location'));
      // this.get('editor').replaceTextWithHTML(...mappedLocation, this.get('info').htmlString);
    }
  }
});
