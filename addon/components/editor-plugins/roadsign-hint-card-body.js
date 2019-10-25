import { reads } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/roadsign-hint-card-body';
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
  addressregister: service(),
  hintPlugin: service('rdfa-editor-roadsign-hint-plugin'),
  roadsignsState: service('roadsigns-state'),

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

  /**
   * The roadsigns and their concepts
   * @property roadsignsWithConcepts
   * @type {Array}
   * @private
  */
  roadsignsWithConcepts: reads('roadsignsState.roadsignsWithConcepts'),

  async didReceiveAttrs() {
    const updatedLocation = this.hintsRegistry.updateLocationToCurrentIndex(this.hrId, this.location);

    const articleNodes = this.editor.selectContext(updatedLocation, {
      scope: "auto",
      typeof: "http://mu.semte.ch/vocabularies/ext/MobiliteitsmaatregelArtikel"
    });
    this.set('articleNodes', articleNodes);
  },

  generateArticleHtml: function(uri, roadsignWithConcept, newArticleNumber) {
    const roadsign = roadsignWithConcept.roadsign;
    const concept = roadsignWithConcept.roadsignConcept;
    const definition = concept ? concept.betekenis : "";

    const innerArtikelHtml = `
        <span property="eli:number">Artikel ${newArticleNumber}</span>
        <meta property="eli:language" resource="http://publications.europa.eu/resource/authority/language/NLD">
        <div property="prov:value">
          <div property="ext:roadsign" resource="${roadsign.uri}" typeof="mobiliteit:Verkeersteken mobiliteit:Verkeersbord-Verkeersteken">
            <div class="grid grid--collapse">
              <div class="col--3-12">
                <span property="mobiliteit:heeftVerkeersbordconcept" resource="${roadsign.roadsignConcept}" typeof="mobiliteit:Verkeersbordconcept">
                  <img src=${concept ? concept.afbeelding : ""} alt="${concept.verkeersbordcode}">
                </span>
              </div>
              <div class="col--9-12">
              <p property="dc:description">
                ${definition}
              </p>
              <p>Ter hoogte van ${roadsign.address}.</p>
              <span property="mobiliteit:isBeginZone" content="${roadsign.isBeginZone || false}" datatype="xsd:boolean"></span>
              <span property="mobiliteit:isEindeZone" content="${roadsign.isEindeZone || false}" datatype="xsd:boolean"></span>
              </div>
            </div>
          </div>
        </div>`;
    return innerArtikelHtml;
  },

  actions: {
    // TODO - In this version of the plugin, the highlights are not correctly removed
    // in the document. It has to do with the way the selectContext works (we should differenciate block/region)
    // An easy way to fix it is to change the -1 to +1 here :
    // (https://github.com/lblod/ember-rdfa-editor/blob/master/addon/utils/hints-registry.js#L546)
    // But when we do this, all the cards are displaying (one for the decision
    // and one per article) instead of being overlapped.

    insert(roadsignWithConcept) {
      const updatedLocation = this.hintsRegistry.updateLocationToCurrentIndex(this.hrId, this.location);

      const triples = this.editor.triplesDefinedInResource(this.info.besluitUri);

      const articles = triples.filter((triple) => {
        return triple.predicate == "http://data.europa.eu/eli/ontology#has_part";
      }).map((triple) => triple.object);

      const articlesNumberTriples = triples.filter((triple) => {
        return articles.includes(triple.subject) && triple.predicate == "http://data.europa.eu/eli/ontology#number";
      });
      const sortedArticles = articlesNumberTriples.sortBy("object");

      const newArticleNumber = articles.length + 1;

      if (newArticleNumber == 1) {
        const decision = this.editor.selectContext(updatedLocation, {
          scope: 'auto',
          resource: this.info.besluitUri
        });

        const uri = `http://data.lblod.info/id/artikels/${v4()}`;
        const innerHTML = this.generateArticleHtml(uri, roadsignWithConcept, newArticleNumber);

        this.editor.update(decision, {
          append: {
            resource: uri,
            typeof: ["http://data.vlaanderen.be/ns/besluit#Artikel", "http://mu.semte.ch/vocabularies/ext/MobiliteitsmaatregelArtikel"],
            property: "eli:has_part",
            innerHTML
          }
        });
      } else {
        const lastArticle = this.editor.selectContext(updatedLocation, {
          scope: 'auto',
          resource: sortedArticles.get('lastObject').subject
        });

        const uri = `http://data.lblod.info/id/artikels/${v4()}`;
        const innerHTML = this.generateArticleHtml(uri, roadsignWithConcept, newArticleNumber);

        this.editor.update(lastArticle, {
          after: {
            resource: uri,
            typeof: ["http://data.vlaanderen.be/ns/besluit#Artikel", "http://mu.semte.ch/vocabularies/ext/MobiliteitsmaatregelArtikel"],
            property: "eli:has_part",
            innerHTML
          }
        });
      }

      this.roadsignsState.removeRoadsignInCards(roadsignWithConcept);
    },

    addToArticle(roadsignWithConcept) {
      const roadsign = roadsignWithConcept.roadsign;
      const concept = roadsignWithConcept.roadsignConcept;
      const definition = concept ? concept.betekenis : "";

      const roadsignHtml = `
        <br>
        <div class="grid grid--collapse">
          <div class="col--3-12">
            <span property="mobiliteit:heeftVerkeersbordconcept" resource=${roadsign.roadsignConcept} typeof="mobiliteit:Verkeersbordconcept">
              <img src=${concept ? concept.afbeelding : ""} alt="${concept.verkeersbordcode}">
            </span>
          </div>
          <div class="col--9-12">
            <p property="dc:description">
              ${definition}
            </p>
            <p>Ter hoogte van ${roadsign.address}.</p>
          </div>
        </div>`;

      this.editor.update(this.articleNodes, {
        append: {
          resource: roadsign.uri,
          typeof: "mobiliteit:Verkeersteken",
          property: "ext:roadsign",
          innerHTML: roadsignHtml
        }
      });

      this.roadsignsState.removeRoadsignInCards(roadsignWithConcept);
    }
  }
});