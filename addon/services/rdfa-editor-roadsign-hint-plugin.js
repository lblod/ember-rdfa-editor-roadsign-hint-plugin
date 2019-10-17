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

  /**
   * task to create an object containing a roadsign and its roadsignConcept
   *
   * @method createRoadsignWithConcept
   *
   * @param {Object} roadsign The roadsign instance
   *
   * @return {Object} An object containing the roadsign and the roadsignConcept
   *
   * @private
   */
  createRoadsignWithConcept: task(function * (roadsign) {
    const conceptUri = roadsign.roadsignConcept;
    const queryParams = {
      'filter[:uri:]': conceptUri
    };
    const concept = (yield this.store.query('verkeersbordconcept', queryParams)).firstObject;

    return EmberObject.create({
      roadsign: roadsign,
      roadsignConcept: concept
    });
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

    // TODO once the interface of the context scanner has been updated, the plugin should be able
    // to select the RichNode that contains the Aanvullend Reglement resource URI in a simple way.
    // For now the plugin has to walk up the semantic node of the RdfaBlocks until it reaches that RichNode
    const uniqueAanvullendReglementen = this.getUniqueAanvullendReglementen(rdfaBlocks);

    let roadSignsPerAanvullendReglement = {};

    for (let aanvullendReglement of Object.keys(uniqueAanvullendReglementen)) {
      const newRoadSigns = this.findUnreferencedRoadsigns(editor, aanvullendReglement);
      // TODO check if roadSignsPerAanvullendReglement is really useful, if not remove it
      roadSignsPerAanvullendReglement[aanvullendReglement] = { newRoadSigns, regions: [] };

      if(newRoadSigns.length === 0) continue;

      const createRoadsignWithConceptTasks = newRoadSigns.map(newRoadSign => this.get('createRoadsignWithConcept').perform(newRoadSign));
      const roadsignWithConcept = yield all(createRoadsignWithConceptTasks);

      const descendentBlockOfAanvullendReglement = uniqueAanvullendReglementen[aanvullendReglement][0];
      const aanvullendReglementNode = this.getAanvullendReglementNode(aanvullendReglement, descendentBlockOfAanvullendReglement);

      if (aanvullendReglementNode) {
        hintsRegistry.removeHintsInRegion(aanvullendReglementNode.region, hrId, this.get('who'));

        // TODO remove generateHintsForContext and use generateCard directly instead
        // The intermediate hints objects created by generateHintsForContext don't have any added value, but only add complexity
        hints.pushObjects(this.generateHintsForContext(aanvullendReglementNode, aanvullendReglement, aanvullendReglementNode.region, roadsignWithConcept));
      }
    }

    const cards = hints.map( hint => this.generateCard(hrId, hintsRegistry, editor, hint) );
    if (cards.length > 0) {
      hintsRegistry.addHints(hrId, this.get('who'), cards);
    }
  }),

  /**
   * Get the parent node of a given RdfaBlock that represents the Aanvullend Reglement
  */
  getAanvullendReglementNode(regulationUri, rdfaBlock) {
    let currentNode = rdfaBlock.semanticNode;

    const isAanvullendReglementNode = function (richNode) {
      const rdfaAttributes = richNode.rdfaAttributes || {};
      return rdfaAttributes.resource == regulationUri
        && rdfaAttributes.typeof.includes("http://data.vlaanderen.be/ns/besluit#AanvullendReglement");
    };

    while (currentNode && !isAanvullendReglementNode(currentNode)) {
      currentNode = currentNode.parent;
    }

    return currentNode;
  },

  /**
   * Get an array of regulations found in the triples stored in rdfaBlocks
   *
   * @method getUniqueAanvullendReglementen
   *
   * @param {Array} rdfaBlocks The rdfa blocks in which we will search for regulations
   *
   * @return {Array} The deduplicated regulations found in the rdfa blocks.
   *
   * @private
   */
  getUniqueAanvullendReglementen(rdfaBlocks) {
    const regulations = {};
    rdfaBlocks.forEach(rdfaBlock => {
      rdfaBlock.context.forEach(triple => {
        if (triple.object === 'http://data.vlaanderen.be/ns/besluit#AanvullendReglement' && triple.predicate === 'a') {
          const regulationUri = triple.subject;
          if (regulations[regulationUri]) {
            regulations[regulationUri].push(rdfaBlock);
          } else {
            regulations[regulationUri] = [ rdfaBlock ];
          }
        }
      });
    });
    return regulations;
  },

  /**
   * Find the roadsigns in the rdfa of a map
   *
   * @method detectRoadsignsInMap
   *
   * @param {string} besluitUri The URI of the decision in which we search for the roadsigns
   * @param {Object} besluitTriples The triples of the decision
   *
   * @return {Array} The roadsigns found in a map
   *
   * @private
   */
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

  /**
   * Find the roadsigns in the rdfa of a decision (that are not in a map)
   *
   * @method detectRoadsignsInDecision
   *
   * @param {Object} besluitTriples The triples of the decision
   *
   * @return {Array} The roadsigns found in the decision
   *
   * @private
   */
  detectRoadsignsInDecision(besluitTriples) {
    const roadsignTriples = (besluitTriples.filter(t => t.predicate === `${mobiliteit}wordtAangeduidDoor` || t.predicate === `${ext}roadsign`));
    const roadsigns = roadsignTriples.map(roadsignTriple => EmberObject.create({ uri: roadsignTriple.object }) );
    return roadsigns;
  },

  /**
   * Find the roadsigns that are in a map but not in a decision, which means that
   * those roadsigns need to be displayed by the addon.
   *
   * @method findUnreferencedRoadsigns
   *
   * @param {Object} editor The RDFa editor instance
   * @param {string} besluitUri The URI of the decision in which we search for the roadsigns
   *
   * @return {Array} The roadsigns referenced in the map but unreferenced in the decisions
   *
   * @private
   */
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
        unreferencedRoadsignsAndConcepts: hint.unreferencedRoadsignsAndConcepts,
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
  generateHintsForContext(context, uri, location, unreferencedRoadsignsAndConcepts){
    const hints = [];
    const resource = uri;
    const text = context.text || '';
    hints.push({ text, location, context, resource, unreferencedRoadsignsAndConcepts });

    return hints;
  }
});

RdfaEditorRoadsignHintPlugin.reopen({
  who: 'editor-plugins/roadsign-hint-card'
});

export default RdfaEditorRoadsignHintPlugin;
