import Service, { inject as service } from '@ember/service';

class AddressSuggestion {
  constructor({ id, street, housenumber, zipCode, municipality, fullAddress }) {
    this.adresRegisterId = id;
    this.street = street;
    this.housenumber = housenumber;
    this.zipCode = zipCode;
    this.municipality = municipality;
    this.fullAddress = fullAddress;
  }
}

export default Service.extend({
  ajax: service(),

  async getLocation(lat, lon, count=1) {
    const results = await this.ajax.request(`/adressenregister/suggest-from-latlon?lat=${lat}&lon=${lon}&count=${count}`);
    const addressSuggestions = results.map( function(result) {
      return new AddressSuggestion({
        id: result.ID,
        street: result.Thoroughfarename,
        housenumber: result.Housenumber,
        zipCode: result.Zipcode,
        municipality: result.Municipality,
        fullAddress: result.FormattedAddress
      });
    });
    return addressSuggestions;
  }
});
