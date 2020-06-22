import Service from '@ember/service';
import normalizeLocation from '../utils/normalize-location';

/**
 * Entry point for RoadsignHint
 *
 * @module editor-roadsign-hint-plugin
 * @class RdfaEditorRoadsignHintPlugin
 * @constructor
 * @extends EmberService
 */
export default class RdfaEditorRoadsignHintPlugin extends Service {

  /**
   * Handles the incoming events from the editor dispatcher.  Responsible for generating hint cards.
   *
   * @method execute
   *
   * @param {string} hrId Unique identifier of the state in the HintsRegistry.  Allows the
   * HintsRegistry to update absolute selected regions based on what a user has entered in between.
   * @param {Array} rdfaBlocks Set of logical blobs of content which may have changed.  Each blob is
   * either has a different semantic meaning, or is logically separated (eg: a separate list item).
   * @param {Object} hintsRegistry Keeps track of where hints are positioned in the editor.
   * @param {Object} editor Your public interface through which you can alter the document.
   *
   * @public
   */
  execute(hrId, rdfaBlocks, hintsRegistry, editor) {
    const hints = [];

    for( const rdfaBlock of rdfaBlocks ){
      hintsRegistry.removeHintsInRegion(rdfaBlock.region, hrId, "roadsign-hint-scope");

      let idx = rdfaBlock.text.toLowerCase().indexOf('hello');
      if( idx !== -1 ) {
        // the hintsregistry needs to know the location with respect to the document
        const absoluteLocation = normalizeLocation( [idx, idx + 'hello'.length], rdfaBlock.region );

        hints.push( {
          // info for the hintsRegistry
          location: absoluteLocation,
          card: "editor-plugins/roadsign-hint-card",
          // any content you need to render the component and handle its actions
          info: {
            hrId, hintsRegistry, editor,
            location: absoluteLocation
          }
        });
      }
    }

    hintsRegistry.addHints(hrId, "roadsign-hint-scope", hints);
  }
}
