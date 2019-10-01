import { reads } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/roadsign-hint-card';
import { inject as service } from '@ember/service';
import { v4 } from "ember-uuid";

/**
* Card displaying a hint of the Date plugin
*
* @module editor-roadsign-hint-plugin
* @class RoadsignHintCard
* @extends Ember.Component
*/
export default Component.extend({
  layout,
  store: service(),
  hintPlugin: service('rdfa-editor-roadsign-hint-plugin'),

  /**
   * Region on which the card applies
   * @property location
   * @type [number,number]
   * @private
  */
  location: reads('info.location'),

  /**
   * Unique identifier of the event in the hints registry
   * @property hrId
   * @type Object
   * @private
  */
  hrId: reads('info.hrId'),

  /**
   * The RDFa editor instance
   * @property editor
   * @type RdfaEditor
   * @private
  */
  editor: reads('info.editor'),

  /**
   * Hints registry storing the cards
   * @property hintsRegistry
   * @type HintsRegistry
   * @private
  */
  hintsRegistry: reads('info.hintsRegistry'),

  roadsigns: reads('hintPlugin.roadsigns'),

  /**
   * The array of all roadsings(mobiliteit:Verkeersteken) which are not referenced from any article
   */
  unreferencedRoadsigns: reads('info.unreferencedRoadsigns'),

  generateArticleHtml: function(uri, roadsign, newArticleNumber) {
    const concept = this.info.unreferencedRoadsignConcepts.filter(unreferencedRoadsignConcept =>
      unreferencedRoadsignConcept.firstObject.id === roadsign.roadsignConcept.substring(roadsign.roadsignConcept.lastIndexOf('/') + 1)
    ).firstObject;
    const definition = concept.length ? concept.firstObject.beschrijving : "";

    const innerArtikelHtml = `
        <span class="annotation article-number" property="eli:number">Artikel ${newArticleNumber}.</span>
        <meta property="eli:language" resource="http://publications.europa.eu/resource/authority/language/NLD">
        <span class="annotation article-content" property="prov:value"></span>
        <span property="refers-to" content=""></span>
        <span property="mobiliteit:heeftMobiliteitsMaatregel" resource="http://8og.ir/{{unique-uri}}" typeof="mobiliteit:MobiliteitMaatsregel">
          <span property="mobiliteit:wordtAangeduidDoor" resource="http://data.lblod.info/id/verkeersteken/14b4bd75-a72c-4fd7-99bf-db3c5d094ae9" typeof="mobiliteit:Verkeersteken">
            <span property="dc:description">
              ${definition}
            </span>
            Referenced roadsign
            <span proerty="mobiliteit:heeftVerkeersbordconcept" resource=${concept.uri} typeof="mobiliteit:Verkeersbordconcept"></span>
          </span>
        </span>`;

    return innerArtikelHtml;
  },

  actions: {
    insert(roadsign) {
      const triples = this.editor.triplesDefinedInResource(this.info.besluitUri);
      const articles = triples.filter((triple) => {
        if (triple.predicate == "http://data.europa.eu/eli/ontology#has_part") {
          return true;
        }
      }).map((triple) => triple.object);

      const articlesNumberTriples = triples.filter((triple) => {
        if (articles.includes(triple.subject) && triple.predicate == "http://data.europa.eu/eli/ontology#number") {
          return true;
        }
      });
      const sortedArticles = articlesNumberTriples.sortBy("object");

      const newArticleNumber = articles.length + 1;

      if (newArticleNumber == 1) {
        const decision = this.editor.selectContext(this.location, {
          scope: 'auto',
          resource: this.info.besluitUri
        });

        const uri = `http://data.lblod.info/id/artikels/${v4()}`;
        const innerHTML = this.generateArticleHtml(uri, roadsign, newArticleNumber);

        this.editor.update(decision, {
          append: {
            resource: uri,
            typeof: ["besluit:Artikel", "ext:MobiliteitsmaatregelArtikel"],
            property: "eli:has_part",
            innerHTML
          }
        });
      } else {
        const lastArticle = this.editor.selectContext(this.location, {
          scope: 'inner',
          resource: sortedArticles.get('lastObject').subject
        });

        const uri = `http://data.lblod.info/id/artikels/${v4()}`;
        const innerHTML = this.generateArticleHtml(uri, roadsign, newArticleNumber);

        this.get('hintsRegistry').removeHintsAtLocation(this.get('location'), this.get('hrId'), 'editor-plugins/roadsign-hint-card');

        this.editor.update(lastArticle, {
          after: {
            resource: uri,
            typeof: "besluit:Artikel",
            property: "eli:has_part",
            innerHTML
          }
        });
      }

      // const mappedLocation = this.get('hintsRegistry').updateLocationToCurrentIndex(this.get('hrId'), this.get('location'));
      // this.get('editor').replaceTextWithHTML(...mappedLocation, this.get('info').htmlString);
    }
  }
});
