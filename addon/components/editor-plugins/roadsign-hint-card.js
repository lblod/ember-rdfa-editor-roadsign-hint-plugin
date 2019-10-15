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
  addressregister: service(),
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

  /**
   * The array of all roadsings(mobiliteit:Verkeersteken) which are not referenced from any article
   */
  unreferencedRoadsignsAndConcepts: reads('info.unreferencedRoadsignsAndConcepts'),

  async didReceiveAttrs() {
    // TODO The result of selectContext cannot be used. It can only be passed to the editor.update() method
    // We should create separate hint cards per Article that show the 'Insert in article' button

    // TODO When the hint card will only be for one roadsign, some logic can be simplified
    // because roadsigns => roadsign (ex. we can create : concept: reads('info.unreferencedRoadsignAndConcept.concept'),

    const articleNodes = this.editor.selectContext(this.editor.currentSelection, {
      scope: "auto",
      typeof: "http://mu.semte.ch/vocabularies/ext/MobiliteitsmaatregelArtikel"
    });
    this.set('articleNodes', articleNodes);

    for (let roadsignAndConcept of this.unreferencedRoadsignsAndConcepts) {
      const [lat, lon] = this.addressregister.getLatLon(roadsignAndConcept.roadsign.point);
      const address = await this.addressregister.getLocation(lat, lon);

      if(address && address.length > 0) {
        roadsignAndConcept.roadsign.set('address', address.firstObject.fullAddress);
      } else {
        roadsignAndConcept.roadsign.set('address', roadsignAndConcept.roadsign.point);
      }
    }
  },

  generateArticleHtml: function(uri, roadsignAndConcept, newArticleNumber) {
    const roadsign = roadsignAndConcept.roadsign;
    const concept = roadsignAndConcept.roadsignConcept;
    const definition = concept ? concept.betekenis : "";

    const innerArtikelHtml = `
        <span class="annotation article-number" property="eli:number">Artikel ${newArticleNumber}.</span>
        <meta property="eli:language" resource="http://publications.europa.eu/resource/authority/language/NLD">
        <span class="annotation article-content" property="prov:value">
          <span property="ext:roadsign" resource="${roadsign.uri}" typeof="mobiliteit:Verkeersteken mobiliteit:Verkeersbord-Verkeersteken">
            <span property="dc:description">
              ${definition}
            </span>
            ter hoogte van ${roadsign.address}
            <span property="mobiliteit:isBeginZone" content="${roadsign.isBeginZone || false}" datatype="xsd:boolean"></span>
            <span property="mobiliteit:isEindeZone" content="${roadsign.isEindeZone || false}" datatype="xsd:boolean"></span>
            <span property="mobiliteit:heeftVerkeersbordconcept" resource="${roadsign.roadsignConcept}" typeof="mobiliteit:Verkeersbordconcept">
              <img src=${concept ? concept.afbeelding : ""} alt="${concept.verkeersbordcode}">
            </span>
          </span>
        </span>`;

    return innerArtikelHtml;
  },

  actions: {
    insert(roadsignAndConcept) {
      this.get('hintsRegistry').removeHintsAtLocation(this.get('location'), this.get('hrId'), 'editor-plugins/roadsign-hint-card');

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
        const decision = this.editor.selectContext(this.location, {
          scope: 'auto',
          resource: this.info.besluitUri
        });

        const uri = `http://data.lblod.info/id/artikels/${v4()}`;
        const innerHTML = this.generateArticleHtml(uri, roadsignAndConcept, newArticleNumber);

        this.editor.update(decision, {
          append: {
            resource: uri,
            typeof: ["http://data.vlaanderen.be/ns/besluit#Artikel", "http://mu.semte.ch/vocabularies/ext/MobiliteitsmaatregelArtikel"],
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
        const innerHTML = this.generateArticleHtml(uri, roadsignAndConcept, newArticleNumber);

        this.editor.update(lastArticle, {
          after: {
            resource: uri,
            typeof: ["http://data.vlaanderen.be/ns/besluit#Artikel", "http://mu.semte.ch/vocabularies/ext/MobiliteitsmaatregelArtikel"],
            property: "eli:has_part",
            innerHTML
          }
        });
      }

      // const mappedLocation = this.get('hintsRegistry').updateLocationToCurrentIndex(this.get('hrId'), this.get('location'));
      // this.get('editor').replaceTextWithHTML(...mappedLocation, this.get('info').htmlString);
    },

    addToArticle(roadsignAndConcept) {
      this.get('hintsRegistry').removeHintsAtLocation(this.get('location'), this.get('hrId'), 'editor-plugins/roadsign-hint-card');

      const roadsign = roadsignAndConcept.roadsign;
      const concept = roadsignAndConcept.roadsignConcept;
      const definition = concept ? concept.betekenis : "";

      const roadsignHtml = `
        <br>
        <span property="dc:description">
          ${definition}
        </span>
        ter hoogte van ${roadsign.address}
        <span property="mobiliteit:heeftVerkeersbordconcept" resource=${roadsign.roadsignConcept} typeof="mobiliteit:Verkeersbordconcept">
          <img src=${concept ? concept.afbeelding : ""} alt="${concept.verkeersbordcode}">
        </span>`;

      this.editor.update(this.articleNodes, {
        append: {
          resource: roadsign.uri,
          typeof: "mobiliteit:Verkeersteken",
          property: "ext:roadsign",
          innerHTML: roadsignHtml
        }
      });
    }
  }
});
