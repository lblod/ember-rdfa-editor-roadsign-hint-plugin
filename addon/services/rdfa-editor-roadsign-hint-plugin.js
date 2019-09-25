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

    this.set('locn', 'http://www.w3.org/ns/locn#');
    this.set('mobiliteit', 'https://data.vlaanderen.be/ns/mobiliteit#');
    this.set('roadSigns', A([]));
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
    this.detectRoadSigns(editor);

    const hints = [];
    contexts
      .filter(this.detectRelevantContext)
      .forEach(context => {
        hintsRegistry.removeHintsInRegion(context.region, hrId, this.get('who'));
        hints.pushObjects(this.generateHintsForContext(context));
      });
    const cards = hints.map( (hint) => this.generateCard(hrId, hintsRegistry, editor, hint));
    if (cards.length > 0) {
      hintsRegistry.addHints(hrId, this.get('who'), cards);
    }
  }),

  detectRoadSigns (editor) {
    const triples = editor.triplesDefinedInResource('http://data.lblod.info/besluiten/27caf2c3-3254-440e-a669-396b986b66ae');
    const signTriples = triples.filter (t => t.predicate === 'a' && t.object === `${this.mobiliteit}Verkeersteken`);

    for (let { subject } of signTriples) {
      const board = triples.find (t => t.predicate === `${this.mobiliteit}realiseert` && t.object === subject).subject;
      const opstelling = triples.find (t => t.predicate === `${this.mobiliteit}omvatVerkeersbord` && t.object === board).subject;
      const location = triples.find (t => t.subject === opstelling &&  t.predicate === `${this.locn}geometry`).subject;

      this.roadSigns.pushObject(EmberObject.create({
        sign: subject,
        location: location
      }));
    }
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
    return context.text.toLowerCase().indexOf('hello') >= 0;
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
        htmlString: '<b>hello world</b>',
        location: hint.location,
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
    const hints = [];
    const index = context.text.toLowerCase().indexOf('hello');
    const text = context.text.slice(index, index+5);
    const location = this.normalizeLocation([index, index + 5], context.region);
    hints.push({text, location});
    return hints;
  }
});

RdfaEditorRoadsignHintPlugin.reopen({
  who: 'editor-plugins/roadsign-hint-card'
});
export default RdfaEditorRoadsignHintPlugin;
