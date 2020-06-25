import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import triplesInSelection from '@lblod/ember-rdfa-editor/utils/triples-in-selection';
import { v1, v4 } from "ember-uuid";
import { loadVerkeersbordconcept } from '../../utils/verkeersborden-db';
/**
 * Card displaying a hint of the Roadsign plugin
 *
 * @module editor-roadsign-hint-plugin
 * @class RoadsignHintCard
 * @extends Ember.Component
 */
export default class RoadsignHintCard extends Component {
  @tracked showModal = false

  constructor() {
    super(...arguments);
    this.besluitUri = this.args.info.selectionContext.resource;
    this.editor = this.args.info.editor;
    this.location = this.args.info.location;
  }

  @action
  openRoadsignModal() {
    this.showModal = true;
  }

  @action
  closeRoadsignModal() {
    this.showModal = false;
  }

  @action
  async insertMaatregelenInArtikel( maatregelConcepten ){
    const selection = this.editor.selectContext(this.location, {
      typeof: 'http://lblod.data.gift/vocabularies/editor/SnippetAttachment'
    });
    const rdfa = await this.generateRdfa(selection, maatregelConcepten);
    this.editor.update(selection, {
      before : {
        innerHTML: rdfa,
        property: 'eli:has_part',
        typeof: 'besluit:Artikel',
        resource: `http://data.lblod.info/artikels/${v4()}`
      }
    });
    // We want to keep the hint open, so no removal
    this.showModal = false;
  }

  async generateRdfa( selection, maatregelConcepten ){
    const maatregelen = [];
    const triples = triplesInSelection(selection);

    for(const maatregelC of maatregelConcepten){
      const verkeerstekenUri = this
            .findVerkeerstekenForVerkeersbordConcept( triples,
                                                      maatregelC.verkeersbordconceptUris[0] ); //Assumes 1 bord ber maatregelC

      const maatregelUri = `http://data.lblod.info/mobiliteitsmaatregel/id/${v4()}`;
      maatregelen.push(
        `
          <li property="mobiliteit:heeftMobiliteitsMaatregel" resource="${maatregelUri}" typeof="mobiliteit:Mobiliteitsmaatregel">

            <span property="mobiliteit:wordtAangeduidDoor" resource=${verkeerstekenUri} typeof="mobiliteit:Verkeersbord-Verkeersteken">
                  <span property="mobiliteit:heeftVerkeersbordconcept" resource=${maatregelC.verkeersbordconceptUris[0]} typeof="mobiliteit:Verkeersbordconcept">
                   <img property="mobiliteit:grafischeWeergave" src="${(await loadVerkeersbordconcept(maatregelC.verkeersbordconceptUris[0])).grafischeWeergave}"/>
                  </span>
            </span>

            <span property="lblodmow:heeftMaatregelconcept" resource=${maatregelC.uri} typeof=${maatregelC.type}>
              <span property="dct:description">${maatregelC.description}</span>
            </span>

          </li>
        `
      );
    }

    const artikel = `
      <div property="eli:number" datatype="xsd:string">
        Artikel
        <span class="mark-highlight-manual">nummer</span>
      </div>
       <span style="display:none;" property="eli:language" resource="http://publications.europa.eu/resource/authority/language/NLD" typeof="skos:Concept">&nbsp;</span>
       <div property="prov:value" datatype="xsd:string">
         &nbsp; De verkeerssituatie zal worden gesignaleerd  met de volgende maatregelen:
         <ul>
           ${maatregelen.join("\n")}
         </ul
      </div>
    `;

    return artikel;
  }

  findVerkeerstekenForVerkeersbordConcept( triples, verkeersbordConcept ){
    return (triples.find(t =>
                        t.predicate === 'https://data.vlaanderen.be/ns/mobiliteit#heeftVerkeersbordconcept'
                        && t.object === verkeersbordConcept
                       ) || {}).subject;
  }
}
