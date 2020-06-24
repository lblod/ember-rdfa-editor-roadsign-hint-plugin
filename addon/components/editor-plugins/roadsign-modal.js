import Component from '@glimmer/component';
import { task } from 'ember-concurrency-decorators';
import triplesInSelection from '@lblod/ember-rdfa-editor/utils/triples-in-selection';
import { loadVerkeersbordconcept } from '../../utils/verkeersborden-db';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class EditorPluginsRoadsignModalComponent extends Component {
  besluitUri
  editor
  location

  @tracked verkeersbordConcepten = []
  @tracked selectedVerkeersbordconcept
  
  constructor() {
    super(...arguments);
    this.besluitUri = this.args.info.selectionContext.resource;
    this.editor = this.args.info.editor;
    this.location = this.args.info.location;
    this.search.perform();
  }

  @task
    *search(){
      const selection = this.editor.selectContext(this.location, { resource: this.besluitUri });
      const vBordConceptUris = triplesInSelection(selection).filter(t => t.predicate === 'https://data.vlaanderen.be/ns/mobiliteit#heeftVerkeersbordconcept');

      const fetchedBordConcepts = [];
      for(const uri of vBordConceptUris){
        fetchedBordConcepts.push(yield loadVerkeersbordconcept(uri.object));
      }

      this.verkeersbordConcepten = fetchedBordConcepts;
    }

  @action
  openMaatregelconceptcombinatieOverview( verkeerbordconcept ){
    this.selectedVerkeersbordconcept = verkeerbordconcept;
  }

}
