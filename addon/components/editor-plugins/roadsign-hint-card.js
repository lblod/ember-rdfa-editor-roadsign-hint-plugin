import { action } from '@ember/object';
import Component from '@glimmer/component';

/**
 * Card displaying a hint of the Date plugin
 *
 * @module editor-roadsign-hint-plugin
 * @class RoadsignHintCard
 * @extends Ember.Component
 */
export default class RoadsignHintCard extends Component {
  @action
  insert() {
    const info = this.args.info;
    info.hintsRegistry.removeHintsAtLocation( info.location, info.hrId, "roadsign-hint-scope");
    const mappedLocation = info.hintsRegistry.updateLocationToCurrentIndex(info.hrId, info.location);
    const selection = info.editor.selectHighlight( mappedLocation );
    info.editor.update( selection, {
      set: { innerHTML: 'my <a href="https://say-editor.com">Say Editor</a> hint card' }
    });
  }
}
