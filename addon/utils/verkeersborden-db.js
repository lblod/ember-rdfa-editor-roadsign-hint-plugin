import fetch from 'fetch';

const SPARQL_ENDPOINT = 'http://localhost/sparql';

class Verkeersbordconcept {
  type = "https://data.vlaanderen.be/ns/mobiliteit#Verkeersbordconcept"

  constructor({ uri, prefLabel, scopeNote, grafischeWeergave, definition, maatregelconceptUris }){
    this.uri = uri;
    this.prefLabel = prefLabel;
    this.scopeNote = scopeNote;
    this.grafischeWeergave = grafischeWeergave;
    this.defintion = definition;
    this.maatregelconceptUris = maatregelconceptUris || [];
  }
}

class Maatregelconcept {
  type = "http://data.lblod.info/vocabularies/mobiliteit/Maatregelconcept"

  constructor({ uri, description, verkeersbordconceptUris, maatregelconceptcombinatieUris }){
    this.uri = uri;
    this.description = description;
    this.verkeersbordconceptUris = verkeersbordconceptUris || [];
    this.maatregelconceptcombinatieUris = maatregelconceptcombinatieUris || [];
  }
}

class Maatregelconceptcombinatie {
  type = "http://data.lblod.info/vocabularies/mobiliteit/Maatregelconceptcombinatie"

  constructor({ uri, maatregelconceptUris }){
    this.uri = uri;
    this.maatregelconceptUris = maatregelconceptUris || [];
  }
}

export async function loadVerkeersbordconcept( uri ){
  const query = `
   PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
   PREFIX mobiliteit: <https://data.vlaanderen.be/ns/mobiliteit#>
   PREFIX lblodmow: <http://data.lblod.info/vocabularies/mobiliteit/>
   PREFIX dct: <http://purl.org/dc/terms/>

   SELECT DISTINCT ?uri ?prefLabel ?scopeNote ?grafischeWeergave ?definition ?maatregelconcept WHERE {
     BIND(${sparqlEscapeUri(uri)} as ?uri)
     GRAPH ?g {
       ?uri skos:prefLabel ?prefLabel;
            skos:scopeNote ?scopeNote;
            skos:definition ?definition;
            mobiliteit:grafischeWeergave ?grafischeWeergave.

       OPTIONAL {
         ?maatregelconcept lblodmow:verkeersbordconcept ?uri.
       }
     }
   }
  `;

  const response = await executeQuery(query);

  if(!response.results.bindings.length){
    return null;
  }

  const maatregelconceptUris =
        response.results.bindings
        .filter( b => b.maatregelconcept )
        .map(b => b.maatregelconcept.value );

  const binding = response.results.bindings[0];
  return new Verkeersbordconcept(
    { uri: binding.uri.value,
      prefLabel: binding.prefLabel.value,
      scopeNote: binding.scopeNote.value,
      grafischeWeergave: binding.grafischeWeergave.value,
      definition: binding.definition.value,
      maatregelconceptUris
    }
  );
}

export async function loadMaatregelconcept( uri ){
  const query = `
     PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
     PREFIX mobiliteit: <https://data.vlaanderen.be/ns/mobiliteit#>
     PREFIX lblodmow: <http://data.lblod.info/vocabularies/mobiliteit/>
     PREFIX dct: <http://purl.org/dc/terms/>

     SELECT DISTINCT ?uri
                     ?description
                     ?verkeersbordC
                     ?maatregelC

     WHERE {

       BIND(${sparqlEscapeUri(uri)} as ?uri)
       GRAPH ?g {
         ?uri dct:description ?description.
         ?uri lblodmow:verkeersbordconcept ?verkeersbordC.

         OPTIONAL {
           ?maatregelC dct:hasPart ?uri.
         }
       }
    }
  `;

  const response = await executeQuery(query);

  if(!response.results.bindings.length){
    return null;
  }

  const bindings = response.results.bindings;
  const verkeersbordCs = bindings.map(b => b.verkeersbordC.value );
  const maatregelCs = bindings.filter(b => b.maatregelC).map(b => b.maatregelC.value );
  const maatregelconcept = new Maatregelconcept(
    {
      uri: bindings[0].uri.value,
      description: bindings[0].description.value,
      verkeersbordconceptUris: verkeersbordCs,
      maatregelconceptcombinatieUris: maatregelCs
    }
  );

  return maatregelconcept;
}

export async function loadMaatregelconceptCombinatie( uri ){
  const query = `
     PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
     PREFIX mobiliteit: <https://data.vlaanderen.be/ns/mobiliteit#>
     PREFIX lblodmow: <http://data.lblod.info/vocabularies/mobiliteit/>
     PREFIX dct: <http://purl.org/dc/terms/>

     SELECT DISTINCT ?uri
                     ?maatregelconcept

     WHERE {

       BIND(${sparqlEscapeUri(uri)} as ?uri)
       GRAPH ?g {
         ?uri dct:hasPart ?maatregelconcept.
       }
    }
  `;

  const response = await executeQuery(query);

  if(!response.results.bindings.length){
    return null;
  }

  const bindings = response.results.bindings;
  const maatregelconcepts = bindings.map(b => b.maatregelconcept.value );
  const maatregelconceptcombinatie = new Maatregelconceptcombinatie(
    {
      uri: bindings[0].uri.value,
      maatregelconceptUris: maatregelconcepts
    }
  );

  return maatregelconceptcombinatie;
}



export async function loadMaatregelconceptcombinatieTreeFromVerkeersbordconcepten( vekeersbordconceptUris ){
  //Big bold query to load all data. Previous load procedure was too slow.
  const filterArray = vekeersbordconceptUris.map(uri => sparqlEscapeUri(uri)).join(', ');
  const query = `
     PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
     PREFIX mobiliteit: <https://data.vlaanderen.be/ns/mobiliteit#>
     PREFIX lblodmow: <http://data.lblod.info/vocabularies/mobiliteit/>
     PREFIX dct: <http://purl.org/dc/terms/>

     SELECT DISTINCT
            ?vbUri
            ?vbLabel
            ?vbNote
            ?vbDefinition
            ?vbWeergave
            ?mUri
            ?mDescription
            ?mcUri WHERE {

       GRAPH ?g {

         ?mcUri a lblodmow:Maatregelconceptcombinatie;
                dct:hasPart ?mUri;
                dct:hasPart ?mFilterUri.

          ?mUri a lblodmow:Maatregelconcept;
                dct:description ?mDescription;
                lblodmow:verkeersbordconcept ?vbUri.

          ?mFilterUri lblodmow:verkeersbordconcept ?vbForFilter.

          ?vbUri a mobiliteit:Verkeersbordconcept;
                 skos:prefLabel ?vbLabel;
                 skos:scopeNote ?vbNote;
                 skos:definition ?vbDefinition;
                 mobiliteit:grafischeWeergave ?vbWeergave.

       }

       FILTER(?vbForFilter IN (${filterArray}))
     }
     ORDER BY ?vbUri
  `;

  const response = await executeQuery(query);

  if(!response.results.bindings.length){
    return {};
  }

  const rows = response.results.bindings;

  const borden = {};
  const maatregelen = {};
  const maatregelenCombos = {};

  //first instantiate objects
  for(const row of rows){
    borden[row.vbUri.value] = new Verkeersbordconcept(
      {
        uri: row.vbUri.value,
        label: row.vbLabel.value,
        scopeNote: row.vbNote.value,
        definition: row.vbDefinition.value,
        grafischeWeergave: row.vbWeergave.value
      }
    );

    maatregelen[row.mUri.value] = new Maatregelconcept(
      {
        uri: row.mUri.value,
        description: row.mDescription.value
      }
    );

    maatregelenCombos[row.mcUri.value] = new Maatregelconceptcombinatie({
      uri: row.mcUri.value
    });
  }

  //make sure there are relations
  for(const row of rows){
    borden[row.vbUri.value].maatregelconceptUris.push(row.mUri.value);
    maatregelen[row.mUri.value].verkeersbordconceptUris.push(row.vbUri.value);
    maatregelen[row.mUri.value].maatregelconceptcombinatieUris.push(row.mcUri.value);
    maatregelenCombos[row.mcUri.value].maatregelconceptUris.push(row.mUri.value);
  }

  //relations might met provided duplicate, they can be flattend here
  Object.values(borden).forEach(b => b.maatregelconceptUris = b.maatregelconceptUris.uniq());
  Object.values(maatregelen).forEach(m => m.verkeersbordconceptUris = m.verkeersbordconceptUris.uniq());
  Object.values(maatregelen).forEach(m => m.maatregelconceptcombinatieUris = m.maatregelconceptcombinatieUris.uniq());
  Object.values(maatregelenCombos).forEach(mc => mc.maatregelconceptUris = mc.maatregelconceptUris.uniq());


  return {
    verkeersbordconcepten: borden,
    maatregelconcepten: maatregelen,
    maatregelconceptcombinaties: maatregelenCombos
  };
}



async function executeCountQuery(query) {
  const response = await executeQuery(query);
  return parseInt(response.results.bindings[0].count.value);
}

async function executeQuery(query) {
  const encodedQuery = escape(query);
  const endpoint = `${SPARQL_ENDPOINT}?query=${encodedQuery}`;
  const response = await fetch(endpoint, { headers: {'Accept': 'application/sparql-results+json' } });

  if (response.ok) {
    return response.json();
  } else {
    throw new Error(`Request to Centrale Vindplaats was unsuccessful: [${response.status}] ${response.statusText}`);
  }
}

function sparqlEscapeUri( value ){
  return '<' + value.replace(/[\\"']/g, function(match) { return '\\' + match; }) + '>';
};
