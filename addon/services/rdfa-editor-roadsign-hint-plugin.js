/* eslint-disable require-yield */
import { getOwner } from '@ember/application';
import Service from '@ember/service';
import EmberObject from '@ember/object';
import { task, all } from 'ember-concurrency';
import { inject as service } from '@ember/service';

const geosparql = 'http://www.opengis.net/ont/geosparql#';
const locn = 'http://www.w3.org/ns/locn#';
const mobiliteit = 'https://data.vlaanderen.be/ns/mobiliteit#';
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

  roadsignsWithConcepts: null,

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
    // TODO once the interface of the context scanner has been updated, the plugin should be able
    // to select the RichNode that contains the Aanvullend Reglement resource URI in a simple way.
    // For now the plugin has to walk up the semantic node of the RdfaBlocks until it reaches that RichNode
    const uniqueAanvullendReglementen = this.getUniqueAanvullendReglementen(rdfaBlocks);

    let cards = [];
    let specificCards = [];

    for (let aanvullendReglement of Object.keys(uniqueAanvullendReglementen)) {
      const newRoadSigns = this.findUnreferencedRoadsigns(editor, aanvullendReglement);

      const descendentBlockOfAanvullendReglement = uniqueAanvullendReglementen[aanvullendReglement][0];
      const aanvullendReglementNode = this.getAanvullendReglementNode(aanvullendReglement, descendentBlockOfAanvullendReglement);

      if(newRoadSigns.length === 0) {
        hintsRegistry.removeHintsInRegion(aanvullendReglementNode.region, hrId, this.get('who'));
        hintsRegistry.removeHintsInRegion(aanvullendReglementNode.region, hrId, this.get('whoFromArticle'));
        continue;
      }

      const createRoadsignWithConceptTasks = newRoadSigns.map(newRoadSign => this.get('createRoadsignWithConcept').perform(newRoadSign));
      this.set('roadsignsWithConcepts', yield all(createRoadsignWithConceptTasks));

      if (aanvullendReglementNode) {
        const articlesInRdfaBlocks = this.getUniqueArticles(rdfaBlocks);

        if(Object.keys(articlesInRdfaBlocks).length) {
          for (let article of Object.keys(articlesInRdfaBlocks)) {
            const descendentBlockOfArticle = articlesInRdfaBlocks[article][0];
            const articleNode = this.getArticleNode(article, descendentBlockOfArticle);
            const specificHint = this.createHint(aanvullendReglement, aanvullendReglementNode, this.roadsignsWithConcepts, articleNode)
            const specificCard = this.generateCardFromArticle(hrId, hintsRegistry, editor, specificHint);
            specificCards.push(specificCard);
          }
        } else {
          const hint = this.createHint(aanvullendReglement, aanvullendReglementNode, this.roadsignsWithConcepts)
          const card = this.generateCard(hrId, hintsRegistry, editor, hint);
          cards.push(card);
        }
      }
    }

    if (cards.length > 0) {
      hintsRegistry.addHints(hrId, this.get('who'), cards);
    }
    if (specificCards.length > 0) {
      hintsRegistry.addHints(hrId, this.get('whoFromArticle'), specificCards);
    }
  }),


  /**
   * Create a hint for a decision or an article
  */
  createHint(aanvullendReglement, aanvullendReglementNode, roadsignsWithConcepts, nodeWithRegion=null) {
    return EmberObject.create({
      text: aanvullendReglementNode.text || '',
      location: nodeWithRegion ? nodeWithRegion.region : aanvullendReglementNode.region,
      context: aanvullendReglementNode,
      resource: aanvullendReglement,
      roadsignsWithConcepts: roadsignsWithConcepts
    });
  },

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
   * Get the parent node of a given RdfaBlock that represents the Article
  */
  getArticleNode(articleUri, rdfaBlock) {
    let currentNode = rdfaBlock.semanticNode;

    const isArticleNode = function (richNode) {
      const rdfaAttributes = richNode.rdfaAttributes || {};
      return rdfaAttributes.resource == articleUri
        && rdfaAttributes.typeof.includes("http://mu.semte.ch/vocabularies/ext/MobiliteitsmaatregelArtikel");
    };

    while (currentNode && !isArticleNode(currentNode)) {
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
   * Get an array of articles found in the triples stored in rdfaBlocks
   *
   * @method getUniqueArticle
   *
   * @param {Array} rdfaBlocks The rdfa blocks in which we will search for artcles
   *
   * @return {Array} The deduplicated artcles found in the rdfa blocks.
   *
   * @private
   */
  getUniqueArticles(rdfaBlocks) {
    let articles = {};
    rdfaBlocks.forEach(rdfaBlock => {
      rdfaBlock.context.forEach(triple => {
        if (triple.object.includes('http://mu.semte.ch/vocabularies/ext/MobiliteitsmaatregelArtikel') && triple.object) {
          const articleUri = triple.subject;
          if (articles[articleUri]) {
            articles[articleUri].push(rdfaBlock);
          } else {
            articles[articleUri] = [ rdfaBlock ];
          }
        }
      });
    });
    return articles;
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
    const roadsigns = roadsignTriples.map(roadsignTriple => EmberObject.create({
      uri: roadsignTriple.object
    }));
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
        roadsignsWithConcepts: hint.roadsignsWithConcepts,
        plainValue: hint.text,
        location: hint.location,
        besluitUri: hint.resource,
        hrId,
        hintsRegistry,
        editor
      },
      location: hint.location,
      card: this.get('who')
    });
  },

  /**
   * Generates a card given a hint
   *
   * @method generateCardFromArticle
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
  generateCardFromArticle(hrId, hintsRegistry, editor, hint) {
    return EmberObject.create({
      info: {
        label: this.get('whoFromArticle'),
        roadsignsWithConcepts: hint.roadsignsWithConcepts,
        plainValue: hint.text,
        location: hint.location,
        besluitUri: hint.resource,
        hrId,
        hintsRegistry,
        editor
      },
      location: hint.location,
      card: this.get('whoFromArticle')
    });
  }
});

RdfaEditorRoadsignHintPlugin.reopen({
  who: 'editor-plugins/roadsign-hint-card',
  whoFromArticle: 'editor-plugins/roadsign-hint-card-from-article'
});

export default RdfaEditorRoadsignHintPlugin;
