import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/roadsign-image';
import { inject as service } from '@ember/service';

export default Component.extend({
  layout,
  store: service(),

  didReceiveAttrs(){
    this._super(...arguments);
    this.set('concept', this.concepts.find(x => x.id === this.roadsign.roadsignConcept.substring(this.roadsign.roadsignConcept.lastIndexOf('/') + 1)));
  },
});
