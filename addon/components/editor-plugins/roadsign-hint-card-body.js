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

  async didReceiveAttrs() {
    const roadsignsWithConcepts = this.roadsignsState.getRoadsignsWithConcepts(this.info.besluitUri);
    this.set('roadsignsWithConcepts', await this.addAddressToRoadsigns(roadsignsWithConcepts))

    // Trick to enable the decision hint to grow when articles are added to it
    const [start, end] = this.location;
    const updatedLocation = this.hintsRegistry.updateLocationToCurrentIndex(this.hrId, [start, end + 1]);

    const articleNodes = this.editor.selectContext(updatedLocation, {
      scope: "auto",
      typeof: "http://mu.semte.ch/vocabularies/ext/MobiliteitsmaatregelArtikel"
    });
    this.set('articleNodes', articleNodes);
  },

  /**
   * Add human readable addresses to the roadsign list
   *
   * @method addAddressToRoadsigns
   *
   * @param {Array} array of objects containing the roadsigns and their concepts
   *
   * @return {Array} array of objects containing the roadsigns with their addresses and their concepts
   *
   * @private
   */
  async addAddressToRoadsigns(roadsignsWithConcepts) {
    for (let roadsignWithConcept of roadsignsWithConcepts) {
      const [lat, lon] = this.addressregister.getLatLon(roadsignWithConcept.roadsign.point);
      const address = await this.addressregister.getLocation(lat, lon);

      if(address && address.length > 0) {
        roadsignWithConcept.roadsign.set('address', address.firstObject.fullAddress);
      } else {
        roadsignWithConcept.roadsign.set('address', roadsignWithConcept.roadsign.point);
      }
    }
    return roadsignsWithConcepts;
  },

  /**
   * Generate the HTML content of an article
   *
   * @method generateArticleHtml
   *
   * @param {Array} array of objects containing the roadsigns and their concepts
   * @param {integer} number of the article
   *
   * @return {string} HTML content of the artcile
   *
   * @private
   */
  generateArticleHtml: function(roadsignWithConcept, newArticleNumber) {
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
    insert(roadsignWithConcept) {
      // Trick to enable the decision hint to grow when articles are added to it
      const [start, end] = this.location;
      const updatedLocation = this.hintsRegistry.updateLocationToCurrentIndex(this.hrId, [start, end + 1]);

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

        const innerHTML = this.generateArticleHtml(roadsignWithConcept, newArticleNumber);

        const uri = `http://data.lblod.info/id/artikels/${v4()}`;
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

        const innerHTML = this.generateArticleHtml(roadsignWithConcept, newArticleNumber);

        const uri = `http://data.lblod.info/id/artikels/${v4()}`;
        this.editor.update(lastArticle, {
          after: {
            resource: uri,
            typeof: ["http://data.vlaanderen.be/ns/besluit#Artikel", "http://mu.semte.ch/vocabularies/ext/MobiliteitsmaatregelArtikel"],
            property: "eli:has_part",
            innerHTML
          }
        });
      }

      this.roadsignsWithConcepts.removeObject(roadsignWithConcept);
      this.roadsignsState.removeRoadsignInCards(roadsignWithConcept.roadsign.uri);
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

      this.roadsignsWithConcepts.removeObject(roadsignWithConcept);
      this.roadsignsState.removeRoadsignInCards(roadsignWithConcept.roadsign.uri);
    }
  }
});
