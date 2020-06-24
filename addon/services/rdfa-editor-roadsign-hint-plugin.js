import Service from '@ember/service';
// TODO: this import is not exactly pretty
import {  findUniqueRichNodes } from '@lblod/ember-rdfa-editor/utils/rdfa/rdfa-rich-node-helpers';

const PLUGIN_ID = "editor-plugins/roadsign-hint-card";
/**
 * Entry point for RoadsignHint
 *
 * @module editor-roadsign-hint-plugin
 * @class RdfaEditorRoadsignHintPlugin
 * @constructor
 * @extends EmberService
 */
export default class RdfaEditorRoadsignHintPlugin extends Service {
  editorApi = "0.1"

  /**
   * Handles the incoming events from the editor dispatcher.  Responsible for generating hint cards.
   *
   * @method execute
   *
   * @param {Array} rdfaBlocks Set of logical blobs of content which may have changed.  Each blob is
   * either has a different semantic meaning, or is logically separated (eg: a separate list item).
   * @param {Object} hintsRegistry Keeps track of where hints are positioned in the editor.
   * @param {Object} editor Your public interface through which you can alter the document.
   *
   * @public
   */
  execute(rdfaBlocks, hintsRegistry, editor) {
    const besluitRichNodes = findUniqueRichNodes(rdfaBlocks, { typeof: 'http://data.vlaanderen.be/ns/besluit#Besluit'});
    for(const richNode of besluitRichNodes ){
      hintsRegistry.removeHints({region: richNode.region, scope: PLUGIN_ID});
    }

    let filteredBesluitRichNodes = [];
    const snippetRicheNodes = findUniqueRichNodes(rdfaBlocks, { property: 'http://mu.semte.ch/vocabularies/ext/verkeersbordenVlaanderenSnippet' });

    for (const richNode of snippetRicheNodes) {
      const besluitUri = this.getBesluitFromVerkeersSnippet(richNode.rdfaBlocks);
      filteredBesluitRichNodes = [ ...filteredBesluitRichNodes, ...besluitRichNodes.filter(n => n.rdfaAttributes.resource === besluitUri)];
    }

    for (const richNode of filteredBesluitRichNodes){
      const location = richNode.region;
      hintsRegistry.addHint( PLUGIN_ID, {
        location,
        card: PLUGIN_ID,
        info: {
          card: PLUGIN_ID,
          hintsRegistry,
          editor,
          location,
          selectionContext: { resource: richNode.rdfaAttributes.resource }
        },
        options: { noHighlight: true }
      });
    }
  }

  getBesluitFromVerkeersSnippet(rdfaBlocks){
    for(const block of rdfaBlocks){
        return block.context.find(t => t.object=== 'http://data.vlaanderen.be/ns/besluit#Besluit').subject;
    }
    return null;
  }
}
