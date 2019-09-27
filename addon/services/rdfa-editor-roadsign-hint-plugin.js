/* eslint-disable require-yield */
import { getOwner } from '@ember/application';
import Service from '@ember/service';
import EmberObject, { computed } from '@ember/object';
import { task } from 'ember-concurrency';
import { A }  from '@ember/array';

/**
 * Service responsible for correct annotation of dates
 *
 * @module editor-roadsign-hint-plugin
 * @class RdfaEditorRoadsignHintPlugin
 * @constructor
 * @extends EmberService
 */
const RdfaEditorRoadsignHintPlugin = Service.extend({


  init(){
    this._super(...arguments);
    getOwner(this).resolveRegistration('config:environment');

    this.set('besluit', 'http://data.vlaanderen.be/ns/besluit#');
    this.set('geosparql', 'http://www.opengis.net/ont/geosparql#');
    this.set('locn', 'http://www.w3.org/ns/locn#');
    this.set('mobiliteit', 'https://data.vlaanderen.be/ns/mobiliteit#');
    this.set('roadsigns', A([]));
  },

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
  execute: task(function * (hrId, contexts, hintsRegistry, editor) {
    this.set ( 'editor', editor );
    this.set ( 'besluitUris', this.detectBesluits(contexts) );
    this.detectRoadsigns();

    const hints = [];

    contexts
      .filter( context => this.detectRelevantContext(context) )
      .forEach( context => {
        hintsRegistry.removeHintsInRegion(context.region, hrId, this.get('who'));
        hints.pushObjects(this.generateHintsForContext(context));
      });

    const cards = hints.map( (hint) => this.generateCard(hrId, hintsRegistry, editor, hint));
    if (cards.length > 0) {
      hintsRegistry.addHints(hrId, this.get('who'), cards);
    }
  }),

  detectRoadsigns () {
    for (let besluitUri of this.besluitUris) {
      const triples = this.editor.triplesDefinedInResource( besluitUri );
      const roadsignTriples = triples.filter (t => t.predicate === 'a' && t.object === `${this.mobiliteit}Verkeersteken`);

      for (let { subject } of roadsignTriples) {
        const board = triples.find(t => t.predicate === `${this.mobiliteit}realiseert` && t.object === subject).subject;
        const opstelling = triples.find(t => t.predicate === `${this.mobiliteit}omvatVerkeersbord` && t.object === board).subject;
        const location = triples.find(t => t.subject === opstelling && t.predicate === `${this.locn}geometry`).object;
        const point = triples.find(t => t.subject === location && t.predicate === `${this.geosparql}asWKT`).object;
        const isBeginZone = triples.find(t => t.subject === subject && t.predicate === `${this.mobiliteit}isBeginZone`);

        this.roadsigns.pushObject(EmberObject.create({
          besluitUri: besluitUri,
          isBeginZone: isBeginZone && isBeginZone.object,
          location: location,
          point: point,
          uri: subject
        }));
      }
    }
  },

  detectBesluits (contexts) {
    const besluitUris = contexts
      .filter (context => {
        const triple = context.context.slice(-2)[0];
        return triple.predicate === 'a' && triple.object === `${this.besluit}Besluit`;
      })
      .map (context => context.context.slice(-1)[0].subject);

    return [...new Set(besluitUris)];
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
    const types = context.context.filter (item => item.predicate === 'a');
  findUnreferencedRoadsigns(editor, besluitUri){
    const triples = editor.triplesDefinedInResource( besluitUri );
    const roadsigns  = this.detectRoadsigns(besluitUri, triples);

    return types.some(t => t.object === `${this.besluit}Besluit`) &&
           !types.some(t => t.object === `${this.mobiliteit}Opstelling`);
    return roadsigns
      .filter ( sign => sign.besluitUri === besluitUri)
      .filter ( sign => {
        const regel = triples.find(t => t.predicate === `${this.mobiliteit}wordtAangeduidDoor` && t.object === sign.uri);
        return !regel || !triples.some(t => t.predicate === `${this.mobiliteit}heeftMobiliteitsMaatregel` && t.object === regel.subject);
      });
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
        plainValue: hint.text,
        location: hint.location,
        besluitUri: hint.context.context.find (c => c.predicate === 'a' && c.object === `${this.besluit}Besluit`).subject,
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
  generateHintsForContext(context){
    const triple = context.context.slice(-1)[0];
    const hints = [];
    const resource = triple.subject;
    const text = context.text || '';
    const location = context.region;
    hints.push({ text, location, context, resource });

    return hints;
  }
});

RdfaEditorRoadsignHintPlugin.reopen({
  who: 'editor-plugins/roadsign-hint-card'
});
export default RdfaEditorRoadsignHintPlugin;
