import Component from '@glimmer/component';
import { task } from 'ember-concurrency-decorators';
import triplesInSelection from '@lblod/ember-rdfa-editor/utils/triples-in-selection';
import { loadMaatregelconcept, loadMaatregelconceptCombinatie, loadVerkeersbordconcept } from '../../utils/verkeersborden-db';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class EditorPluginsRoadsignModalComponent extends Component {
  besluitUri
  editor
  location

  @tracked verkeersbordConcepten = []
  @tracked selectedVerkeersbordconcept
  @tracked maatregelCombos = []

  constructor() {
    super(...arguments);
    this.besluitUri = this.args.info.selectionContext.resource;
    this.editor = this.args.info.editor;
    this.location = this.args.info.location;
    this.search.perform();
  }

  async setVerkeersbordconcepten(){
    const selection = this.editor.selectContext(this.location, { resource: this.besluitUri });
    const vBordConceptUris = triplesInSelection(selection).filter(t => t.predicate === 'https://data.vlaanderen.be/ns/mobiliteit#heeftVerkeersbordconcept');
    const fetchedBordConcepts = [];
    for(const uri of vBordConceptUris){
      fetchedBordConcepts.push(await loadVerkeersbordconcept(uri.object));
    }
    this.verkeersbordConcepten = fetchedBordConcepts;
  }

  async loadMaatregelconceptcombinatie( verkeersbordconcepten ){
    // Rather elaborate procedure to load
    // All data related to all maatregelconceptcombinatie linked to all encountered verkeersbordconcepten.
    // This will be improved one day, we have sparql now, but we are in POC mode.
    // Also check:
    //https://cloud.vandekeybus.eu/apps/files_sharing/publicpreview/GoG3mrxNR5REWkJ?x=2560&y=1011&a=true&file=irg.png&scalingup=0

    const maatregelen = {};
    const maatregelCombos = {};

    for(const verkeersbordconcept of verkeersbordconcepten){
      //First we go from maatregel to combinatie
      for(const maatregelUri of verkeersbordconcept.maatregelconceptUris){
        maatregelen[maatregelUri] = await loadMaatregelconcept(maatregelUri);
      }

      for(const maatregel of Object.values(maatregelen) ){
        for(const maatregelcomboUri of maatregel.maatregelconceptcombinatieUris){
          maatregelCombos[maatregelcomboUri] = await loadMaatregelconceptCombinatie(maatregelcomboUri);
        }
      }

      //Then we want to know all maatregelen belonging to a combo
      for(const combo of Object.values(maatregelCombos)){
        combo.maatregelen = [];
        for(const maatregelUri of combo.maatregelconceptUris){
          const maatregel = await loadMaatregelconcept(maatregelUri);
          //TODO: this is an assumption: 1 maatregel 1 bord
          maatregel.selected = false;
          maatregel.verkeersbord = await loadVerkeersbordconcept (maatregel.verkeersbordconceptUris[0]);
          combo.maatregelen.push(maatregel);
        }
      }
    }

    this.maatregelCombos = Object.values(maatregelCombos);
  }

  @task
  *search(){
    yield this.setVerkeersbordconcepten();
    yield this.loadMaatregelconceptcombinatie( this.verkeersbordConcepten );
  }

  @action
  insertInDocument(){
    const maatregelenToInsert  = [];
    for(const combo of this.maatregelCombos){
      maatregelenToInsert.push(...combo.maatregelen.filter(m => m.selected));
    }
  }
}
