import Service, { inject as service } from '@ember/service';
import fetch from 'fetch';

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
  async getLocation(lat, lon, count=1) {
    const results = await (await fetch(`http://loc.geopunt.be/v4/Location?latlon=${lat},${lon}&c=1`)).json();
    const addressSuggestions = results.LocationResult.map( function(result) {
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
