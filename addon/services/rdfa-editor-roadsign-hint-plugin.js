/* eslint-disable require-yield */
import { getOwner } from '@ember/application';
import Service from '@ember/service';
import EmberObject from '@ember/object';
import { task, all } from 'ember-concurrency';
import { A }  from '@ember/array';
import { inject as service } from '@ember/service';

// TODO remove unused helper methods
// TODO document methods

/**
 * Service responsible for correct annotations of road signs
 *
 * @module editor-roadsign-hint-plugin
 * @class RdfaEditorRoadsignHintPlugin
 * @constructor
 * @extends EmberService
 */
const RdfaEditorRoadsignHintPlugin = Service.extend({
  store: service(),

  init(){
    this._super(...arguments);
    getOwner(this).resolveRegistration('config:environment');

    // TODO should not be set as properties of the service. Use const variables outside the service instead
    this.set('besluit', 'http://data.vlaanderen.be/ns/besluit#');
    this.set('geosparql', 'http://www.opengis.net/ont/geosparql#');
    this.set('locn', 'http://www.w3.org/ns/locn#');
    this.set('mobiliteit', 'https://data.vlaanderen.be/ns/mobiliteit#');
    this.set('infrastructuur', 'https://data.vlaanderen.be/ns/openbaardomein/infrastructuur#');
  },

  fetchRoadsignConcept: task(function * (roadsign) {
    const conceptUri = roadsign.roadsignConcept;
    const queryParams = {
      'filter[:uri:]': conceptUri
    };
    return (yield this.store.query('verkeersbordconcept', queryParams)).firstObject;
  }),

  /**
   * task to handle the incoming events from the editor dispatcher
   *
   * @method execute
   *
   * @param {string} hrId Unique identifier of the event in the hintsRegistry
   * @param {Array} contexts RDFa contexts of the text snippets the event applies on
   * @param {Object} hintsRegistry Registry of hints in the editor
   * @param {Object} editor The RDFa editor instance
   *
   * @public
   */
  execute: task(function * (hrId, rdfaBlocks, hintsRegistry, editor) {
    const hints = [];

    // TODO move to helper method
    const uniqueAanvullendReglementen = new Set();
    rdfaBlocks.forEach(rdfaBlock => {
      rdfaBlock.context.forEach(triple => {
        if (triple.object === 'http://data.vlaanderen.be/ns/besluit#AanvullendReglement' && triple.predicate === 'a') {
          uniqueAanvullendReglementen.add(triple.subject);
        }
      });
    });

    // TODO remove the caching construction with 'roadSignsPerBesluit'. Since we have a unique set of aanvullende reglementen,
    // we're sure we will scan each besluit only once
    // We only want to scan once for this subject, as the document won't have changed
    // within the processing of the loop.
    // We store the result in an intermediate variable, so this can be re-used in next iteration.
    // It wil contain:
    // { besluitUri : { newRoadSigns, regions }}

    let roadSignsPerBesluit = {};

    for (let aanvullendReglement of uniqueAanvullendReglementen) {
      let newRoadSigns = [];
      if(roadSignsPerBesluit[aanvullendReglement]){
        newRoadSigns = roadSignsPerBesluit[aanvullendReglement].newRoadSigns;
      }
      else {
        newRoadSigns = this.findUnreferencedRoadsigns(editor, aanvullendReglement);
        roadSignsPerBesluit[aanvullendReglement] = { newRoadSigns, regions: [] };
      }

      if(newRoadSigns.length === 0) continue;

      // TODO convert to map() instead of foreach() with a push()
      let fetchRoadsignConceptTasks = [];
      newRoadSigns.forEach((newRoadSign) => {
        fetchRoadsignConceptTasks.push(this.get('fetchRoadsignConcept').perform(newRoadSign));
      });

      // TODO create objects with a roadsign and the related roadsign concept and pass that object in the hint card
      // It will make the logic in the hint card less complex (where you have to look up the roadsignconcept in the list of all concepts)

      const newRoadsignsConcepts = yield all(fetchRoadsignConceptTasks);

      // TODO rename 'besluitBlock' to 'aanvullendReglementNode' to indicate it's a RichNode, not an RdfaBlock
      const besluitBlock = rdfaBlocks.find(r => {
        const rdfaAttributes = r.semanticNode.rdfaAttributes || {};
        return rdfaAttributes.resource == aanvullendReglement && rdfaAttributes.typeof.includes("http://data.vlaanderen.be/ns/besluit#AanvullendReglement");
      }).semanticNode;

      hintsRegistry.removeHintsInRegion(besluitBlock.region, hrId, this.get('who'));

      // TODO remove generateHintsForContext and use generateCard directly instead
      // The intermediate hints objects created by generateHintsForContext don't have any added value, but only add complexity
      hints.pushObjects(this.generateHintsForContext(besluitBlock, aanvullendReglement, besluitBlock.region, newRoadSigns, newRoadsignsConcepts));
    }

    const cards = hints.map( hint => this.generateCard(hrId, hintsRegistry, editor, hint) );
    if (cards.length > 0) {
      hintsRegistry.addHints(hrId, this.get('who'), cards);
    }
  }),

  detectRoadsignsInMap(besluitUri, besluitTriples) {
    let roadsigns = A([]);

    // TODO map 'subject' property of the resulting array since that's the only property that is used in the remaining code
    const opstellingTriples = besluitTriples.filter (t => t.predicate === 'a' && t.object === `${this.mobiliteit}Opstelling`);

    // TODO use map() instead of for-loop with pushObject()
    for (let { subject } of opstellingTriples) {
      const infrastructuurRoadSign = (besluitTriples.find(t => t.subject === subject && t.predicate === `${this.mobiliteit}omvatVerkeersbord`)).object;
      const roadsign = (besluitTriples.find(t => t.subject === infrastructuurRoadSign && t.predicate === `${this.mobiliteit}realiseert`)).object;

      const location = (besluitTriples.find(t => t.subject === subject && t.predicate === `${this.locn}geometry`) || {}).object;
      const point = (besluitTriples.find(t => t.subject === location && t.predicate === `${this.geosparql}asWKT`) || {}).object;
      const isBeginZone = besluitTriples.find(t => t.subject === roadsign && t.predicate === `${this.mobiliteit}isBeginZone`);
      const isEindeZone = besluitTriples.find(t => t.subject === roadsign && t.predicate === `${this.mobiliteit}isEindeZone`);
      const roadsignConcept = besluitTriples.find(t => t.subject === roadsign && t.predicate === `${this.mobiliteit}heeftVerkeersbordconcept`);

      roadsigns.pushObject(EmberObject.create({
        besluitUri,
        infrastructuurRoadSign,
        location,
        point,
        uri: roadsign,
        isBeginZone: isBeginZone && isBeginZone.object,
        isEindeZone: isEindeZone && isEindeZone.object,
        roadsignConcept: roadsignConcept && roadsignConcept.object,
      }));
    }
    return roadsigns;
  },

  // TODO rename to 'detectRoadsignsInDecision'
  detectRoadsignsInDecisions(besluitTriples) {
    // TODO We cannot rely on mobiliteit:wordtAangeduidDoor only to detect roadsigns in decisions
    // It might be that the roadsigns are not wrapped yet in a Mobilieitsmaatregel
    // We will define a custom predicate ext:roadsign to temporarely link a roadsign to an article
    // Both predicates mobiliteit:wordtAangeduidDoor and ext:roadsign must be checked here
    const roadSignTriples = (besluitTriples.filter(t => t.predicate === `${this.mobiliteit}wordtAangeduidDoor`));
    // TODO use map() instead of for-loop with pushObject()
    let roadsigns = A([]);
    for (let { object } of roadSignTriples) {
      roadsigns.pushObject(EmberObject.create({
        uri: object
      }));
    }
    return roadsigns;
  },

  findHighestNodeForBesluit(richNode, typeUri) {
    if(!richNode.parent)
      return null;
    if(!richNode.rdfaAttributes || !richNode.rdfaAttributes.typeof)
      return this.findHighestNodeForBesluit(richNode.parent, typeUri);
    if(!richNode.rdfaAttributes.typeof.includes(typeUri))
      return this.findHighestNodeForBesluit(richNode.parent, typeUri);
    return richNode;
  },

  /**
   * Given context object, tries to detect a context the plugin can work on
   *
   * @method detectRelevantContext
   *
   * @param {Object} context Text snippet at a specific location with an RDFa context
   *
   * @return {String} URI of context if found, else empty string.
   *
   * @private
   */
  detectRelevantContext(context){
    return context
      .context
      .find(t => t.object === `${this.besluit}AanvullendReglement` && t.predicate === 'a');
  },

  isSameRegion(a, b){
    return a[0] === b[0] && a[1] === b[1];
  },

  findUnreferencedRoadsigns(editor, besluitUri){
    const triples = editor.triplesDefinedInResource( besluitUri );
    const detectRoadsignsInMap = this.detectRoadsignsInMap(besluitUri, triples);
    const detectRoadsignsInDecisions = this.detectRoadsignsInDecisions(triples);

    const difference = detectRoadsignsInMap.filter(x => {
      return !detectRoadsignsInDecisions.find(y => {
        return y.uri === x.uri;
      });
    });
    return difference;
  },

  /**
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
  normalizeLocation(location, reference){
    return [location[0] + reference[0], location[1] + reference[0]];
  },

  /**
   * Generates a card given a hint
   *
   * @method generateCard
   *
   * @param {string} hrId Unique identifier of the event in the hintsRegistry
   * @param {Object} hintsRegistry Registry of hints in the editor
   * @param {Object} editor The RDFa editor instance
   * @param {Object} hint containing the hinted string and the location of this string
   *
   * @return {Object} The card to hint for a given template
   *
   * @private
   */
  generateCard(hrId, hintsRegistry, editor, hint){
    return EmberObject.create({
      info: {
        label: this.get('who'),
        unreferencedRoadsigns: hint.unreferencedRoadsigns,
        unreferencedRoadsignConcepts: hint.unreferencedRoadsignConcepts,
        plainValue: hint.text,
        location: hint.location,
        besluitUri: hint.resource,
        hrId, hintsRegistry, editor
      },
      location: hint.location,
      card: this.get('who')
    });
  },

  /**
   * Generates a hint, given a context
   *
   * @method generateHintsForContext
   *
   * @param {Object} context Text snippet at a specific location with an RDFa context
   *
   * @return {Object} [{dateString, location}]
   *
   * @private
   */
  generateHintsForContext(context, uri, location, unreferencedRoadsigns, unreferencedRoadsignConcepts){
    const hints = [];
    const resource = uri;
    const text = context.text || '';
    hints.push({ text, location, context, resource, unreferencedRoadsigns, unreferencedRoadsignConcepts });

    return hints;
  }
});

RdfaEditorRoadsignHintPlugin.reopen({
  who: 'editor-plugins/roadsign-hint-card'
});
export default RdfaEditorRoadsignHintPlugin;
