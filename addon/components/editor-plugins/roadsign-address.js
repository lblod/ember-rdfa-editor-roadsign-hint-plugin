import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/roadsign-address';
import { inject as service } from '@ember/service';

export default Component.extend({
  layout,
  addressregister: service(),

  async didReceiveAttrs() {
    const regExp = /\(([^)]+)\)/; // Keep value between parentheses
    const [lat, lon] = regExp.exec(this.point)[1].split(' ');
    const address = await this.addressregister.getLocation(lat, lon);
    if(address && address.length > 0) {
      this.set('fullAddress', address.firstObject.fullAddress);
    }
  }
});
