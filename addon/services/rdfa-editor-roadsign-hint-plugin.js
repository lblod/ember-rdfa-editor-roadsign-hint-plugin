/* eslint-disable require-yield */
import { getOwner } from '@ember/application';
import Service from '@ember/service';
import EmberObject from '@ember/object';
import { task, all } from 'ember-concurrency';
import { A }  from '@ember/array';
import { inject as service } from '@ember/service';

const besluit = 'http://data.vlaanderen.be/ns/besluit#';
const geosparql = 'http://www.opengis.net/ont/geosparql#';
const locn = 'http://www.w3.org/ns/locn#';
const mobiliteit = 'https://data.vlaanderen.be/ns/mobiliteit#';
const infrastructuur = 'https://data.vlaanderen.be/ns/openbaardomein/infrastructuur#';
const ext = 'http://mu.semte.ch/vocabularies/ext/';

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

    const uniqueAanvullendReglementen = this.getUniqueAanvullendReglementen(rdfaBlocks);

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

      const fetchRoadsignConceptTasks = newRoadSigns.map(newRoadSign => this.get('fetchRoadsignConcept').perform(newRoadSign));

      // TODO create objects with a roadsign and the related roadsign concept and pass that object in the hint card
      // It will make the logic in the hint card less complex (where you have to look up the roadsignconcept in the list of all concepts)

      const newRoadsignsConcepts = yield all(fetchRoadsignConceptTasks);

      const aanvullendReglementNode = rdfaBlocks.find(r => {
        const rdfaAttributes = r.semanticNode.rdfaAttributes || {};
        return rdfaAttributes.resource == aanvullendReglement && rdfaAttributes.typeof.includes("http://data.vlaanderen.be/ns/besluit#AanvullendReglement");
      }).semanticNode;

      hintsRegistry.removeHintsInRegion(aanvullendReglementNode.region, hrId, this.get('who'));

      // TODO remove generateHintsForContext and use generateCard directly instead
      // The intermediate hints objects created by generateHintsForContext don't have any added value, but only add complexity
      hints.pushObjects(this.generateHintsForContext(aanvullendReglementNode, aanvullendReglement, aanvullendReglementNode.region, newRoadSigns, newRoadsignsConcepts));
    }

    const cards = hints.map( hint => this.generateCard(hrId, hintsRegistry, editor, hint) );
    if (cards.length > 0) {
      hintsRegistry.addHints(hrId, this.get('who'), cards);
    }
  }),

  getUniqueAanvullendReglementen(rdfaBlocks) {
    const uniqueAanvullendReglementen = new Set();
    rdfaBlocks.forEach(rdfaBlock => {
      rdfaBlock.context.forEach(triple => {
        if (triple.object === 'http://data.vlaanderen.be/ns/besluit#AanvullendReglement' && triple.predicate === 'a') {
          uniqueAanvullendReglementen.add(triple.subject);
        }
      });
    });
    return uniqueAanvullendReglementen;
  },

  detectRoadsignsInMap(besluitUri, besluitTriples) {
    const opstellingen = besluitTriples.filter (t => t.predicate === 'a' && t.object === `${mobiliteit}Opstelling`).map(opstelling => opstelling.subject);

    const roadsigns = opstellingen.map(opstelling => {
      const infrastructuurRoadSign = (besluitTriples.find(t => t.subject === opstelling && t.predicate === `${mobiliteit}omvatVerkeersbord`)).object;
      const roadsign = (besluitTriples.find(t => t.subject === infrastructuurRoadSign && t.predicate === `${mobiliteit}realiseert`)).object;
      const location = (besluitTriples.find(t => t.subject === opstelling && t.predicate === `${locn}geometry`) || {}).object;
      const point = (besluitTriples.find(t => t.subject === location && t.predicate === `${geosparql}asWKT`) || {}).object;
      const isBeginZone = besluitTriples.find(t => t.subject === roadsign && t.predicate === `${mobiliteit}isBeginZone`);
      const isEindeZone = besluitTriples.find(t => t.subject === roadsign && t.predicate === `${mobiliteit}isEindeZone`);
      const roadsignConcept = besluitTriples.find(t => t.subject === roadsign && t.predicate === `${mobiliteit}heeftVerkeersbordconcept`);

      return EmberObject.create({
        besluitUri,
        infrastructuurRoadSign,
        location,
        point,
        uri: roadsign,
        isBeginZone: isBeginZone && isBeginZone.object,
        isEindeZone: isEindeZone && isEindeZone.object,
        roadsignConcept: roadsignConcept && roadsignConcept.object,
      });
    });

    return roadsigns;
  },

  detectRoadsignsInDecision(besluitTriples) {
    const roadsignTriples = (besluitTriples.filter(t => t.predicate === `${mobiliteit}wordtAangeduidDoor` || t.predicate === `${ext}roadsign`));
    const roadsigns = roadsignTriples.map(roadsignTriple => EmberObject.create({ uri: roadsignTriple.object }) );
    return roadsigns;
  },

  findUnreferencedRoadsigns(editor, besluitUri) {
    const triples = editor.triplesDefinedInResource( besluitUri );
    const detectRoadsignsInMap = this.detectRoadsignsInMap(besluitUri, triples);
    const detectRoadsignsInDecision = this.detectRoadsignsInDecision(triples);

    const difference = detectRoadsignsInMap.filter(x => {
      return !detectRoadsignsInDecision.find(y => {
        return y.uri === x.uri;
      });
    });
    return difference;
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
