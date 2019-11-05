# ember-rdfa-editor-roadsign-hint-plugin

EmberJS addon that inserts roadsigns from a map to the documents, organized in
articles.


## Compatibility

* Ember.js v3.4 or above
* Ember CLI v2.13 or above
* Node.js v8 or above


## Installation

```
ember install @lblod/ember-rdfa-editor-roadsign-hint-plugin
```


## Usage

This plugin parses the informations contained in the map of the decision. It finds the
roadsigns listed there that are not inserted in the document, and gives an interface
to write them in an article of the decision.

### Trigger the plugin

To trigger the plugin, the document has to contain a decision with a map containing
the roadsigns that need to be processed. Such a map will have a similar HTML structure:

```
<div prefix="mobiliteit: https://data.vlaanderen.be/ns/mobiliteit# infrastructuur: https://data.vlaanderen.be/ns/openbaardomein/infrastructuur# besluit: http://data.vlaanderen.be/ns/besluit# geosparql: http://www.opengis.net/ont/geosparql# locn: http://www.w3.org/ns/locn# xsd:http://www.w3.org/2001/XMLSchema# foaf: http://xmlns.com/foaf/0.1/">
  <div resource="http://data.lblod.info/artikels/2e94598c-3772-4965-b797-7a225be00927" typeof="besluit:Artikel">
    <img src="https://dev.kleinbord.lblod.info/snippets/images/example-6-kaart-2.png">
    <div resource="http://data.mow.vlaanderen.be/id/opstellingen/b421ed5e-c0e6-4de4-9688-26f2fc4839af" typeof="mobiliteit:Opstelling">
      <div property="locn:geometry" resource="http://data.mow.vlaanderen.be/id/geometrien/c2de8121-284b-4243-9bff-3d3bf4d54279" typeof="locn:Geometry">
        <span property="geosparql:asWKT" datatype="geosparql:wktLiteral" content="Point (51.226835 4.416502)"></span>
      </div>
      <div property="mobiliteit:grafischeWeergave" resource="http://maps.mow.vlaanderen.be/b421ed5e-c0e6-4de4-9688-26f2fc4839af" typeof="foaf:Image"></div>
      <div property="mobiliteit:Opstelling.operationeleStatus" resource="http://data.vlaanderen.be/id/opstelling-operationele-status/gepland">
      </div>
      <div property="mobiliteit:omvatVerkeersbord" resource="http://data.mow.vlaanderen.be/id/verkeersborden/94d4a016-ed37-4f54-91d6-b4966f74ebfa" typeof="infrastructuur:Verkeersbord">
        <div property="mobiliteit:Verkeersbord.operationeleStatus" resource="http://data.vlaanderen.be/id/verkeersbord-operationele-status/gepland">
        </div>
        <div property="mobiliteit:realiseert" resource="http://data.lblod.info/id/verkeerstekens/7f6e6111-81c6-4bfb-9118-bb51ec1fbf26" typeof="mobiliteit:Verkeersbord-Verkeersteken mobiliteit:Verkeersteken">
          <div property="mobiliteit:heeftVerkeersbordconcept" resource="http://data.vlaanderen.be/id/concept/Verkeersbordconcept/ecedfa0ac528d4ba21050a5ff32e8f320fb7f1da82c799c29b1fa85fcf0a9024" typeof="mobiliteit:Verkeersbordconcept">
          </div>
          <div property="mobiliteit:isBeginZone" content="true" datatype="xsd:boolean">
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

To insert a decision containing the map an the roadsigns in the document:
* Create a new document in the [gelinkt notuleren](https://dev.gelinkt-notuleren.lblod.info) application
* Add the desired template to the document and save
* Visit the [kleinbord](https://dev.kleinbord.lblod.info/select-road-sign) application
* Fill the form with the snippet to be inserted, the url of the gelinkt notuleren application and the URI of the document that has been first created (it will look like `http://data.lblod.info/document-containers/<uuidOfTheDocument>`, where the uuid can be found in the URL of the document created in gelinkt notuleren)
* Import the snippet to gelinkt notuleren (clicking on the button will redirect there directly)
* Place the cursor where the map has to be inserted
* Click on the button to insert a new template
* Insert the document from the section "U kan hier informatie uit een externe bron invoegen"
* The map is inserted, don't forget to save the document before leaving !


### Insert roadsigns

There are two ways to insert the roadsigns:
* Insert a roadsign in a new article
* Insert a roadsgin in an existing article (click on the article, the card shown
  will then offer to do so)

The inserted articles will have a similar HTML structure:
```
<li property="eli:has_part" resource="http://data.lblod.info/artikels/ad3998ce-9782-4917-a409-0fc2fd8b3e61" typeof="besluit:Artikel ext:MobiliteitsmaatregelArtikel">
  <span class="annotation article-number" property="eli:number">Artikel 1.</span>
  <meta property="eli:language" resource="http://publications.europa.eu/resource/authority/language/NLD" />
  <span class="annotation article-content" property="prov:value">Einde zone 30 bord</span>
  <span property="refers-to" content=""></span>
  <span property="ext:roadsign" resource="http://data.lblod.info/id/verkeersteken/14b4bd75-a72c-4fd7-99bf-db3c5d094ae9" typeof="mobiliteit:Verkeersteken">
    <span property="mobiliteit:isBeginZone" content="false" datatype="xsd:boolean"></span>
    <span property="mobiliteit:isEindeZone" content="true" datatype="xsd:boolean"></span>
    <span property="mobiliteit:heeftVerkeersbordconcept" resource="http://data.vlaanderen.be/id/concept/Verkeersbordconcept/2721df3072ab4e96f50b345524806082f37252e7a1a802b14d640c3cfd7a1d49" typeof="mobiliteit:Verkeersbordconcept">
      <img src="http://mobiliteit.vo.data.gift/images/4545d376d96442f4d509c580b3095c10b6ba0a93371cb836d6e21a92cfed7a82" alt="F4b">
    </span>
  </span>
</li>
```

## Contributing

See the [Contributing](CONTRIBUTING.md) guide for details.


## License

This project is licensed under the [MIT License](LICENSE.md).
