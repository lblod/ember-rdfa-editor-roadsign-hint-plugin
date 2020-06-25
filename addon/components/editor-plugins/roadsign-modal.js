import Component from '@glimmer/component';
import { task } from 'ember-concurrency-decorators';
import triplesInSelection from '@lblod/ember-rdfa-editor/utils/triples-in-selection';
import { loadMaatregelconcept,
         loadMaatregelconceptCombinatie,
         loadVerkeersbordconcept,
         loadMaatregelconceptcombinatieTreeFromVerkeersbordconcepten
       } from '../../utils/verkeersborden-db';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class EditorPluginsRoadsignModalComponent extends Component {
  besluitUri
  editor
  location

  @tracked verkeersbordConcepten = []
  @tracked selectedVerkeersbordconcept
  @tracked maatregelCombos = []
  @tracked maatregelenToInsert = []

  constructor() {
    super(...arguments);
    this.besluitUri = this.args.info.selectionContext.resource;
    this.editor = this.args.info.editor;
    this.location = this.args.info.location;
    this.search.perform();
  }

  async setVerkeersbordconcepten(){
    const selection = this.editor.selectContext(this.location, { resource: this.besluitUri });
    const triples = triplesInSelection(selection);
    if(!triples.find(t => t.object === 'https://data.vlaanderen.be/ns/mobiliteit#Opstelling')) return;
    const vBordConceptUris = triples.filter(t => t.predicate === 'https://data.vlaanderen.be/ns/mobiliteit#heeftVerkeersbordconcept');
    const fetchedBordConcepts = [];
    for(const uri of vBordConceptUris){
      fetchedBordConcepts.push(await loadVerkeersbordconcept(uri.object));
    }
    this.verkeersbordConcepten = fetchedBordConcepts;
  }

  async loadMaatregelconceptcombinatie( verkeersbordconcepten ){
    const data = await loadMaatregelconceptcombinatieTreeFromVerkeersbordconcepten(verkeersbordconcepten.map(v => v.uri));

    //Interlink the data so it can be used in the template easily
    for(const combo of Object.values(data.maatregelconceptcombinaties)){
      combo.maatregelen = [];

      for(const maatregelUri of combo.maatregelconceptUris){

        const maatregel = data.maatregelconcepten[maatregelUri];
        //TODO: this is an assumption: 1 maatregel 1 bord
        maatregel.selected = false;
        maatregel.verkeersbord = data.verkeersbordconcepten[maatregel.verkeersbordconceptUris[0]];
        combo.maatregelen.push(maatregel);
      }
    }

    this.maatregelCombos = Object.values(data.maatregelconceptcombinaties);
  }

  @task
  *search(){
    yield this.setVerkeersbordconcepten();
    yield this.loadMaatregelconceptcombinatie( this.verkeersbordConcepten );
  }

  @action
  updateMaatregelenToInsert(maatregel, event){
    if(event.target.checked){
      this.maatregelenToInsert.pushObject(maatregel);
    }
    else {
      this.maatregelenToInsert.removeObject(maatregel);
    }
  }

  @action
  insert(){
    this.args.onInsert(this.maatregelenToInsert);
  }
}
