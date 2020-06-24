import Component from '@glimmer/component';
import { task } from 'ember-concurrency-decorators';
import { loadMaatregelconcept, loadMaatregelconceptCombinatie, loadVerkeersbordconcept } from '../../utils/verkeersborden-db';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { set } from '@ember/object';

export default class EditorPluginsRoadsignMaatregelconceptcombinatiesOverviewComponent extends Component {

  @tracked maatregelCombos = []

  constructor() {
    super(...arguments);
    this.search.perform(this.args.verkeersbordconcept);
  }

  @task
    *search(verkeersbordconcept){

      //First we go from maatregel to combinatie
      const maatregelen = {};
      for(const maatregelUri of verkeersbordconcept.maatregelconceptUris){
        maatregelen[maatregelUri] = yield loadMaatregelconcept(maatregelUri);
      }

      const maatregelCombos = {};

      for(const maatregel of Object.values(maatregelen) ){
        for(const maatregelcomboUri of maatregel.maatregelconceptcombinatieUris){
          maatregelCombos[maatregelcomboUri] = yield loadMaatregelconceptCombinatie(maatregelcomboUri);
        }
      }

      //Then we want to know all maatregelen belonging to a combo
      for(const combo of Object.values(maatregelCombos)){
        combo.maatregelen = [];
        for(const maatregelUri of combo.maatregelconceptUris){
          const maatregel = yield loadMaatregelconcept(maatregelUri);
          //TODO: this is an assumption: 1 maatregel 1 bord
          maatregel.selected = false;
          maatregel.verkeersbord = yield loadVerkeersbordconcept (maatregel.verkeersbordconceptUris[0]);
          combo.maatregelen.push(maatregel);
        }
      }

      this.maatregelCombos = Object.values(maatregelCombos);
    }

  @action
  toggleSelectMaatregel(maatregel){
    set(maatregel, 'selected', !maatregel.selected);
  }

}
