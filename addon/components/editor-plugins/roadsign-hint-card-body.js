import { reads, alias } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/roadsign-hint-card-body';
import { inject as service } from '@ember/service';
import { v4 } from "ember-uuid";
import { task } from 'ember-concurrency';
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

  isLoading: alias('fetchRoadsigns.isRunning'),

  fetchRoadsigns: task(function * () {
    const roadsignsWithConcepts = yield this.roadsignsState.getRoadsignsWithConcepts(this.info.besluitUri);
    this.roadsignsWithConcepts = yield this.addAddressToRoadsigns(roadsignsWithConcepts);
  }),
  async didReceiveAttrs() {
    this.fetchRoadsigns.perform();
  },

  selectMobiliteitsMaatregelNodes() {
    // Trick to enable the decision hint to grow when articles are added to it
    const updatedLocation = this.hintsRegistry.updateLocationToCurrentIndex(this.hrId, this.location);

    return this.editor.selectContext(updatedLocation, {
      scope: "auto",
      typeof: "https://data.vlaanderen.be/ns/mobiliteit#Mobiliteitsmaatregel"
    });
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
        <div property="mobiliteit:Artikel.heeftMobiliteitsmaatregel" typeof="mobiliteit:Mobiliteitsmaatregel">
          <div property="mobiliteit:wordtAangeduidDoor" resource="${roadsign.uri}" typeof="mobiliteit:Verkeersteken mobiliteit:Verkeersbord-Verkeersteken">
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
      const triples = this.editor.triplesDefinedInResource(this.info.besluitUri);
      const articles = triples.filter((triple) => {
        return triple.predicate == "http://data.europa.eu/eli/ontology#has_part";
      }).map((triple) => triple.object);

      const articlesNumberTriples = triples.filter((triple) => {
        return articles.includes(triple.subject) && triple.predicate == "http://data.europa.eu/eli/ontology#number";
      });
      const sortedArticles = articlesNumberTriples.sortBy("object");

      const updatedDecisionLocation = this.hintsRegistry.updateLocationToCurrentIndex(this.hrId, this.info.decisionLocation);
      const lastArticle = this.editor.selectContext(updatedDecisionLocation, {
        scope: 'auto',
        resource: sortedArticles.get('lastObject').subject
      });

      const newArticleNumber = articles.length + 1;
      const innerHTML = this.generateArticleHtml(roadsignWithConcept, newArticleNumber);
      this.roadsignsWithConcepts.removeObject(roadsignWithConcept);
      this.roadsignsState.removeRoadsignInCards(roadsignWithConcept.roadsign.uri);

      const uri = `http://data.lblod.info/id/artikels/${v4()}`;
      this.editor.update(lastArticle, {
        after: {
          resource: uri,
          typeof: ["http://data.vlaanderen.be/ns/besluit#Artikel", "http://mu.semte.ch/vocabularies/ext/MobiliteitsmaatregelArtikel"],
          property: "eli:has_part",
          innerHTML
        }
      });
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

      this.roadsignsWithConcepts.removeObject(roadsignWithConcept);
      this.roadsignsState.removeRoadsignInCards(roadsignWithConcept.roadsign.uri);
      this.hintsRegistry.removeHintsAtLocation(this.location,this.hrId, this.who);

      this.editor.update(this.selectMobiliteitsMaatregelNodes(), {
        append: {
          resource: roadsign.uri,
          typeof: ["mobiliteit:Verkeersteken", "mobiliteit:Verkeersbord-Verkeersteken"],
          property: "mobiliteit:wordtAangeduidDoor",
          innerHTML: roadsignHtml
        }
      });
    }
  }
});
