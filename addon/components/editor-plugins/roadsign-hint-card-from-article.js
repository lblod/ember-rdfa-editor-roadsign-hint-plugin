import { reads } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/roadsign-hint-card-from-article';
import { inject as service } from '@ember/service';
import { v4 } from "ember-uuid";

/**
* Card displaying a hint specific to an article of the Roadsign Hint plugin
*
* @module editor-roadsign-hint-plugin
* @class RoadsignHintCard
* @extends Ember.Component
*/
export default Component.extend({
  layout
});
