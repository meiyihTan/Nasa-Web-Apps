$(document).ready(function() {
  "use strict";

  // Set the Bing API key for Bing Maps
  // Without your own key you will be using a limited WorldWind developer's key.
  // See: https://www.bingmapsportal.com/ to register for your own key and then enter it below:
  const BING_API_KEY =
    "ArMLUxRSNM1wgpII2JTcmJzyygegXLsIX-NMdCrmkKXc3CXKGCyrq4mu4c34XafN";
  if (BING_API_KEY) {
    // Initialize WorldWind properties before creating the first WorldWindow
    WorldWind.BingMapsKey = BING_API_KEY;
  } else {
    console.error(
      "app.js: A Bing API key is required to use the Bing maps in production. Get your API key at https://www.bingmapsportal.com/"
    );
  }
  // Set the MapQuest API key used for the Nominatim service.
  // Get your own key at https://developer.mapquest.com/
  // Without your own key you will be using a limited WorldWind developer's key.
  const MAPQUEST_API_KEY = "u1Am9Gib2p8EU6BZYzADmdvPFAKqV7vv";

  /**
   * The Globe encapsulates the WorldWindow object (wwd) and provides application
   * specific logic for interacting with layers.
   * @param {String} canvasId The ID of the canvas element that will host the globe
   * @returns {Globe}
   */
  class Globe {
    constructor(canvasId, projectionName) {
      // Create a WorldWindow globe on the specified HTML5 canvas
      this.wwd = new WorldWind.WorldWindow(canvasId);

      // Projection support
      this.roundGlobe = this.wwd.globe; // The default is a 3D globe
      this.flatGlobe = null;
      if (projectionName) {
        this.changeProjection(projectionName);
      }

      // Holds the next unique id to be assigned to a layer
      this.nextLayerId = 1;

      // Holds a map of category and observable timestamp pairs
      this.categoryTimestamps = new Map();

      // Add a BMNGOneImageLayer background layer. We're overriding the default
      // minimum altitude of the BMNGOneImageLayer so this layer always available.
      this.addLayer(new WorldWind.BMNGOneImageLayer(), {
        category: "background",
        minActiveAltitude: 0
      });
    }

    /**
     * Returns the supported projection names.
     * @returns {Array}
     */
    get projectionNames() {
      return [
        "3D",
        "Equirectangular",
        "Mercator",
        "North Polar",
        "South Polar",
        "North UPS",
        "South UPS",
        "North Gnomonic",
        "South Gnomonic"
      ];
    }
    /**
     * Changes the globe's projection.
     * @param {String} projectionName
     */
    changeProjection(projectionName) {
      if (projectionName === "3D") {
        if (!this.roundGlobe) {
          this.roundGlobe = new WorldWind.Globe(
            new WorldWind.EarthElevationModel()
          );
        }
        if (this.wwd.globe !== this.roundGlobe) {
          this.wwd.globe = this.roundGlobe;
        }
      } else {
        if (!this.flatGlobe) {
          this.flatGlobe = new WorldWind.Globe2D();
        }
        if (projectionName === "Equirectangular") {
          this.flatGlobe.projection = new WorldWind.ProjectionEquirectangular();
        } else if (projectionName === "Mercator") {
          this.flatGlobe.projection = new WorldWind.ProjectionMercator();
        } else if (projectionName === "North Polar") {
          this.flatGlobe.projection = new WorldWind.ProjectionPolarEquidistant(
            "North"
          );
        } else if (projectionName === "South Polar") {
          this.flatGlobe.projection = new WorldWind.ProjectionPolarEquidistant(
            "South"
          );
        } else if (projectionName === "North UPS") {
          this.flatGlobe.projection = new WorldWind.ProjectionUPS("North");
        } else if (projectionName === "South UPS") {
          this.flatGlobe.projection = new WorldWind.ProjectionUPS("South");
        } else if (projectionName === "North Gnomonic") {
          this.flatGlobe.projection = new WorldWind.ProjectionGnomonic("North");
        } else if (projectionName === "South Gnomonic") {
          this.flatGlobe.projection = new WorldWind.ProjectionGnomonic("South");
        }
        if (this.wwd.globe !== this.flatGlobe) {
          this.wwd.globe = this.flatGlobe;
        }
      }
    }

    /**
     * Returns an observable containing the last update timestamp for the category.
     * @param {String} category
     * @returns {Observable}
     */
    getCategoryTimestamp(category) {
      if (!this.categoryTimestamps.has(category)) {
        this.categoryTimestamps.set(category, ko.observable());
      }
      return this.categoryTimestamps.get(category);
    }

    /**
     * Updates the timestamp for the given category.
     * @param {String} category
     */
    updateCategoryTimestamp(category) {
      let timestamp = this.getCategoryTimestamp(category);
      timestamp(new Date());
    }

    /**
     * Toggles the enabled state of the given layer and updates the layer
     * catetory timestamp. Applies a rule to the 'base' layers the ensures
     * only one base layer is enabled.
     * @param {WorldWind.Layer} layer
     */

    toggleLayer(layer, layer_menu) {
      // Multiplicity Rule: only [0..1] "base" layers can be enabled at a time
      if (layer.category === "base") {
        this.wwd.layers.forEach(function(item) {
          if (item.category === "base" && item !== layer) {
            item.enabled = false;
          }
        });
      }
      // Toggle the selected layer's visibility
      layer.enabled = !layer.enabled;
      if (layer.enabled && layer_menu) {
        document.getElementById("info-bar").style.display = "block";
        document.getElementById("side-bar").style.display = "block";
        document.getElementById("text-box").style.display = "block";
      } else if (layer_menu) {
        document.getElementById("info-bar").style.display = "none";
        document.getElementById("side-bar").style.display = "none";
        document.getElementById("text-box").style.display = "none";
      }
      document.getElementById("text-box").innerHTML = "";

      // Trigger a redraw so the globe shows the new layer state ASAP
      this.wwd.redraw();

      // Signal a change in the category
      this.updateCategoryTimestamp(layer.category);
    }

    /**
     * Adds a layer to the globe. Applies the optional options' properties to the
     * layer, and assigns the layer a unique ID and category.
     * @param {WorldWind.Layer} layer
     * @param {Object|null} options E.g., {category: "base", enabled: true}
     */
    addLayer(layer, options) {
      // Copy all properties defined on the options object to the layer
      if (options) {
        for (let prop in options) {
          if (!options.hasOwnProperty(prop)) {
            continue; // skip inherited props
          }
          layer[prop] = options[prop];
        }
      }
      // Assign a default category property if not already assigned
      if (typeof layer.category === "undefined") {
        layer.category = "overlay"; // the default category
      }

      // Assign a unique layer ID to ease layer management
      layer.uniqueId = this.nextLayerId++;

      // Add the layer to the globe
      this.wwd.addLayer(layer);
      // Signal that this layer category has changed
      this.getCategoryTimestamp(layer.category);
    }

    /**
     * Returns a new array of layers in the given category.
     * @param {String} category E.g., "base", "overlay" or "setting".
     * @returns {Array}
     */
    getLayers(category) {
      return this.wwd.layers.filter(layer => layer.category === category);
    }
  }
  $("select[id=Color1]").click(function() {
    globe.changeProjection(this.options[this.selectedIndex].innerHTML);
  });
  /**
   * View model for the layers panel.
   * @param {Globe} globe - Our globe object
   */
  // var canvas = document.getElementById("info-bar");
  // var ctx = canvas.getContext("2d");
  // ctx.fillStyle = "#FFFFFF";
  // ctx.font = "20px Arial";
  // ctx.textBaseline = "bottom";
  // ctx.fillText("Info", canvas.width / 2, canvas.height / 2);
  function LayersViewModel(globe) {
    var self = this;
    self.baseLayers = ko.observableArray(globe.getLayers("base"));
    self.overlayLayers = ko.observableArray(globe.getLayers("overlay"));

    // Update the view model whenever the model changes
    globe
      .getCategoryTimestamp("base")
      .subscribe(newValue =>
        self.loadLayers(globe.getLayers("base"), self.baseLayers)
      );

    globe
      .getCategoryTimestamp("overlay")
      .subscribe(newValue =>
        self.loadLayers(globe.getLayers("overlay"), self.overlayLayers)
      );

    // Utility to load the layers in reverse order to show last rendered on top
    self.loadLayers = function(layers, observableArray) {
      observableArray.removeAll();
      layers.forEach(layer => observableArray.push(layer));
    };

    // Click event handler for the layer panel's buttons
    self.toggleLayer = function(layer) {
      globe.toggleLayer(layer, true);
      document.getElementById("text-box").innerHTML =
        "<h2>" +
        layer.title +
        " </h2>" +
        "<hr>" +
        "<p align=justify> " +
        layer.abstract +
        "</p>";
      if (layer.category === "overlay") {
        document.getElementById("text-box").innerHTML =
          "<h2>" +
          "Country Borders" +
          " </h2>" +
          "<hr>" +
          "<p align=justify> " +
          "Show the borders of all countries." +
          "</p>";
      }
    };
  }

  /**
   * View model for the settings.
   * @param {Globe} globe - Our globe object (not a WorldWind.Globe)
   */
  function SettingsViewModel(globe) {
    var self = this;
    self.settingLayers = ko.observableArray(
      globe.getLayers("setting").reverse()
    );

    // Update the view model whenever the model changes
    globe
      .getCategoryTimestamp("setting")
      .subscribe(newValue =>
        self.loadLayers(globe.getLayers("setting"), self.settingLayers)
      );

    // Utility to load layers in reverse order
    self.loadLayers = function(layers, observableArray) {
      observableArray.removeAll();
      layers.reverse().forEach(layer => observableArray.push(layer));
    };

    // Click event handler for the setting panel's buttons
    self.toggleLayer = function(layer) {
      globe.toggleLayer(layer);
    };
  }

  /**
   * Search view model. Uses the MapQuest Nominatim API.
   * Requires an access key. See: https://developer.mapquest.com/
   * @param {Globe} globe
   * @param {Function} preview Function to preview the results
   * @returns {SearchViewModel}
   */
  function SearchViewModel(globe, preview) {
    var self = this;
    self.geocoder = new WorldWind.NominatimGeocoder();
    self.searchText = ko.observable("");
    self.performSearch = function() {
      if (!MAPQUEST_API_KEY) {
        console.error(
          "SearchViewModel: A MapQuest API key is required to use the geocoder in production. Get your API key at https://developer.mapquest.com/"
        );
      }
      // Get the value from the observable
      let queryString = self.searchText();
      if (queryString) {
        if (queryString.match(WorldWind.WWUtil.latLonRegex)) {
          // Treat the text as a lat, lon pair
          let tokens = queryString.split(",");
          let latitude = parseFloat(tokens[0]);
          let longitude = parseFloat(tokens[1]);
          // Center the globe on the lat, lon
          globe.wwd.goTo(new WorldWind.Location(latitude, longitude));
        } else {
          // Treat the text as an address or place name
          self.geocoder.lookup(
            queryString,
            function(geocoder, results) {
              if (results.length > 0) {
                // Open the modal dialog to preview and select a result
                preview(results);
              }
            },
            MAPQUEST_API_KEY
          );
        }
      }
    };
  }

  /**
   * Define the view model for the Search Preview.
   * @param {Globe} primaryGlobe
   * @returns {PreviewViewModel}
   */
  function PreviewViewModel(primaryGlobe) {
    var self = this;
    // Show a warning message about the MapQuest API key if missing
    this.showApiWarning = MAPQUEST_API_KEY === null || MAPQUEST_API_KEY === "";

    // Create secondary globe with a 2D Mercator projection for the preview
    this.previewGlobe = new Globe("preview-canvas", "Mercator");
    let resultsLayer = new WorldWind.RenderableLayer("Results");
    let bingMapsLayer = new WorldWind.BingRoadsLayer();
    bingMapsLayer.detailControl = 1.25; // Show next level-of-detail sooner. Default is 1.75
    this.previewGlobe.addLayer(bingMapsLayer);
    this.previewGlobe.addLayer(resultsLayer);

    // Set up the common placemark attributes for the results
    let placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
    placemarkAttributes.imageSource =
      WorldWind.configuration.baseUrl + "images/pushpins/castshadow-red.png";
    placemarkAttributes.imageScale = 0.5;
    placemarkAttributes.imageOffset = new WorldWind.Offset(
      WorldWind.OFFSET_FRACTION,
      0.3,
      WorldWind.OFFSET_FRACTION,
      0.0
    );

    // Create an observable array who's contents are displayed in the preview
    this.searchResults = ko.observableArray();
    this.selected = ko.observable();

    // Shows the given search results in a table with a preview globe/map
    this.previewResults = function(results) {
      if (results.length === 0) {
        return;
      }
      // Clear the previous results
      self.searchResults.removeAll();
      resultsLayer.removeAllRenderables();
      // Add the results to the observable array
      results.map(item => self.searchResults.push(item));
      // Create a simple placemark for each result
      for (let i = 0, max = results.length; i < max; i++) {
        let item = results[i];
        let placemark = new WorldWind.Placemark(
          new WorldWind.Position(
            parseFloat(item.lat),
            parseFloat(item.lon),
            100
          )
        );
        placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
        placemark.displayName = item.display_name;
        placemark.attributes = placemarkAttributes;

        resultsLayer.addRenderable(placemark);
      }

      // Initialize preview with the first item
      self.previewSelection(results[0]);
      // Display the preview dialog
      $("#preview-dialog").modal();
      $("#preview-dialog .modal-body-table").scrollTop(0);
    };

    // Center's the preview globe on the selection and sets the selected item.
    this.previewSelection = function(selection) {
      let latitude = parseFloat(selection.lat),
        longitude = parseFloat(selection.lon),
        location = new WorldWind.Location(latitude, longitude);
      // Update our observable holding the selected location
      self.selected(location);
      // Go to the posiion
      self.previewGlobe.wwd.goTo(location);
    };

    // Centers the primary globe on the selected item
    this.gotoSelected = function() {
      // Go to the location held in the selected observable
      primaryGlobe.wwd.goTo(self.selected());
    };
  }

  // Create a globe
  let globe = new Globe("globe-canvas");
  // Add layers to the globe
  // Add layers ordered by drawing order: first to last
  // globe.addLayer(new WorldWind.BMNGLayer(), {
  //   category: "base",
  //   displayName: "Normal"
  // });
  globe.wwd.addLayer(new WorldWind.BMNGLayer(), {
    category: "base",
    displayName: "Normal"
  });
  // globe.addLayer(new WorldWind.BMNGLandsatLayer(), {
  //   category: "base",
  //   enabled: false
  // });
  // globe.addLayer(new WorldWind.BingAerialLayer(), {
  //   category: "base",
  //   enabled: false
  // });
  // globe.addLayer(new WorldWind.BingAerialWithLabelsLayer(), {
  //   category: "base",
  //   enabled: false,
  //   detailControl: 1.5
  // });

  globe.addLayer(new WorldWind.CoordinatesDisplayLayer(globe.wwd), {
    category: "setting"
  });
  globe.addLayer(new WorldWind.ViewControlsLayer(globe.wwd), {
    category: "setting"
  });
  globe.addLayer(new WorldWind.CompassLayer(), {
    category: "setting"
  });
  globe.addLayer(new WorldWind.StarFieldLayer(), {
    category: "setting",
    displayName: "Stars"
  });
  globe.addLayer(new WorldWind.AtmosphereLayer(), {
    category: "setting",
    enabled: false,
    time: null // or new Date()
  });

  /**var resortLocations = new WorldWind.RenderableLayer("Ski Resort Locations");
  globe.addLayer(resortLocations);

  var breckenridgePosition = new WorldWind.Position(39.481019, -106.045398, 0);
  var breckenridge = new WorldWind.Placemark(breckenridgePosition);
  breckenridge.label = "Brandon";
  resortLocations.addRenderable(breckenridge);
  breckenridge.altitudeMode = WorldWind.CLAMP_TO_GROUND;
  var breckenridgeAttributes = new WorldWind.PlacemarkAttributes();
  breckenridgeAttributes.imageSource =
    "https://cdn3.iconfinder.com/data/icons/user-interface-ui-navigation-1/62/Pinpoint_-512.png";
  breckenridge.attributes = breckenridgeAttributes;
  breckenridge.eyeDistanceScaling = true;
  breckenridgeAttributes.imageOffset = new WorldWind.Offset(
    WorldWind.OFFSET_FRACTION,
    0.5,
    WorldWind.OFFSET_FRACTION,
    0
  );
  */
  var serviceAddress =
    "https://neo.sci.gsfc.nasa.gov/wms/wms?version=1.3.0&service=WMS&request=GetCapabilities";

  // Create the callback parsing function
  var parseXml = function(xml) {
    // Create a WmsCapabilities object from the returned xml
    var wmsCapabilities = new WorldWind.WmsCapabilities(xml);

    // Simulate a user selection of a particular layer to display
    var layers = wmsCapabilities.getNamedLayers();

    for (var i = 0; i < layers.length; i++) {
      var layerConfig = WorldWind.WmsLayer.formLayerConfiguration(layers[i]);

      // Create the layer
      var wmsLayer = new WorldWind.WmsLayer(layerConfig);
      wmsLayer["title"] = layers[i].title;
      if (layers[i].title.startsWith("Active Fires")) {
        wmsLayer["abstract"] =
          "Fire is a recurring part of nature.  Wildfires can be caused by lightning striking a forest canopy or, in a few isolated cases, by lava or hot rocks ejected from erupting volcanoes.  Most fires worldwide are started by humans, sometimes accidentally and sometimes on purpose.  Not all fires are bad.  Fire clears away dead and dying underbrush, which can help restore forest ecosystems to good health.  Humans use fire as a tool in slash-and-burn agriculture to speed up the process of breaking down unwanted vegetation into the soil.  Humans also use fire to clear away old-growth forests to make room for living spaces, roads, and fields for raising crops and cattle.  But not all fires are good.  Wildfires can destroy natural resources and human structures.  Globally, fire plays a major role in Earth's carbon cycle by releasing carbon into the air, and by consuming trees that would otherwise absorb carbon from the air during photosynthesis.  These maps show the locations of actively burning fires around the world, detected by instruments aboard NASA satellites.";
      } else if (layers[i].title.startsWith("Aerosol Optical Thickness")) {
        wmsLayer["abstract"] =
          "Tiny solid and liquid particles suspended in the atmosphere are called aerosols. Examples of aerosols include windblown dust, sea salts, volcanic ash, smoke from fires, and pollution from factories. These particles are important to scientists because they can affect climate, weather, and people's health. Aerosols affect climate by scattering sunlight back into space and cooling the surface.  Aerosols also help cool Earth in another way -- they act like \"seeds\" to help form clouds.  The particles give water droplets something to cling to as the droplets form and gather in the air to make clouds.  Clouds give shade to the surface by reflecting sunlight back into space. People's health is affected when they breathe in smoke or pollution particles.  Such aerosols in our lungs can cause asthma or cancer of other serious health problems.  But scientists do not fully understand all of the ways that aerosols affect Earth's environment.  To help them in their studies, scientists use satellites to map where there were large amounts of aerosol on a given day, or over a span of days.";
      } else if (layers[i].title.startsWith("Aerosol Particle Radius")) {
        wmsLayer["abstract"] =
          "Tiny solid and liquid particles suspended in the atmosphere are called <em>aerosols</em>.  These particles are important to scientists because they can affect climate, weather, and people's health.  Some aerosols come from natural sources, such as dust, volcanic eruptions, and sea salts.  Some aerosols are produced by humans, such as pollution from industries or automobiles, or smoke from fires.  Using satellites scientists can tell whether a given plume of aerosols came from a natural source, or if is pollution produced by people.  Two important clues about aerosols' sources are particle size and location of the plume.  Natural aerosols (such as dust and sea salts) tend to be larger particles than man-made aerosols (such as smoke and industrial pollution).";
      } else if (layers[i].title.startsWith("Albedo")) {
        wmsLayer["abstract"] =
          "When sunlight reaches the Earth&rsquo;s surface, some of it is absorbed and some is reflected. The relative amount (ratio) of light that a surface reflects compared to the total sunlight that falls on it is called <em>albedo</em>. Surfaces that reflect a lot of the light falling on them are bright, and they have a high albedo. Surfaces that don&rsquo;t reflect much light are dark, and they have a low albedo. Snow has a high a albedo, and forests have a low albedo.";
      } else if (
        layers[i].title.startsWith("Average Land Surface Temperature [Day]")
      ) {
        wmsLayer["abstract"] =
          "Land surface temperature is how hot the ground feels to the touch. If you want to know whether temperatures at some place at a specific time of year are unusually warm or cold, you need to compare them to the average temperatures for that place over many years. These maps show the average weekly or monthly daytime land surface temperatures for 2001-2010.";
      } else if (
        layers[i].title.startsWith("Average Land Surface Temperature [Night]")
      ) {
        wmsLayer["abstract"] =
          "Land surface temperature is how hot the ground feels to the touch. If you want to know whether temperatures at some place at a specific time of year are unusually warm or cold, you need to compare them to the average temperatures for that place over many years. These maps show the average weekly or monthly nighttime land surface temperatures for 2001-2010.";
      } else if (
        layers[i].title.startsWith("Average Sea Surface Temperature")
      ) {
        wmsLayer["abstract"] =
          "Sea surface temperature is the temperature of the top millimeter of the ocean's surface. The average sea surface temperatures over a long period of time are called a sea surface temperature \"climatology.\" An area's climatology acts a baseline for deciding whether and how much the climate is changing. To make a climatology data set, you average measurements collected over a long period of time. These data were collected between 1985 and 1997 by a series of National Oceanic and Atmospheric Administration (NOAA) satellites. The observations are grouped into five-day periods.";
      } else if (layers[i].title.startsWith("Bathymetry")) {
        wmsLayer["abstract"] =
          "Beneath the waters of the world's ocean, the Earth's surface isn't flat like the bottom of a glass or large bowl. There are giant mountain ranges and huge cracks where the ocean floor is ripping apart. Underwater volcanoes are slowly building up into mountains that may one day rise above the sea surface as islands. Because of these features, the depth of the water isn't the same everywhere in the ocean. Bathymetry is the measurement of how deep the water is at various places and the shape of the land underwater. In these maps, different shades of color represent different water depths. The data come from the General Bathymetric Chart of the Oceans, produced by the International Hydrographic Organization (IHO) and the United Nations' (UNESCO) Intergovernmental Oceanographic Commission (IOC).";
      } else if (layers[i].title.startsWith("Blue Marble: Next Generation")) {
        wmsLayer["abstract"] =
          "NASA's Blue Marble: Next Generation images show Earth in true color. The images show how the surface would look to a human in space if our world had no clouds and no atmosphere. NASA's Terra satellite collected these images. There is one Blue Marble image for each month of the year 2004. These images allow us to explore changes on Earth's lands over time. Notice how the patterns of green (trees and plants), brown (exposed land surface), and white (snow) change from winter through spring, summer, and fall.";
      } else if (layers[i].title.startsWith("Carbon Monoxide")) {
        wmsLayer["abstract"] =
          "Colorless, odorless, and poisonous, carbon monoxide is a gas that comes from burning fossil fuels, like the gas in cars, and burning vegetation. Carbon monoxide is not one of the gases that is causing global warming, but it is one of the air pollutants that leads to smog. These data sets show monthly averages of carbon monoxide across the Earth measured by the Measurements of Pollution In The Troposphere (MOPITT) sensor on NASA's Terra satellite. Different colors show different amounts of the gas in the troposphere, the layer of the atmosphere closest to the Earth's surface, at an altitude of about 12,000 feet.";
      } else if (layers[i].title.startsWith("Chlorophyll Concentration")) {
        wmsLayer["abstract"] =
          "This map shows where tiny, floating plants live in the ocean. These plants, called <em>phytoplankton</em>, are an important part of the ocean's food chain because many animals (such as small fish and whales) feed on them. Scientists can learn a lot about the ocean by observing where and when phytoplankton grow in large numbers. Scientists use satellites to measure how much phytoplankton are growing in the ocean by observing the color of the light reflected from the shallow depths of the water. Phytoplankton contain a photosynthetic pigment called <em>chlorophyll</em> that lends them a greenish color. When phytoplankton grow in large numbers they make the ocean appear greenish. These maps made from satellite observations show where and how much phytoplankton were growing on a given day, or over a span of days. The black areas show where the satellite could not measure phytoplankton.";
      } else if (layers[i].title.startsWith("Cloud Fraction")) {
        wmsLayer["abstract"] =
          "Looking at Earth from outer space, clouds are easy to spot. Clouds are draped all around Earth like bright white decorations. Clouds are important to scientists because they reflect the Sun's light back to space and give shade to the surface. They also bring rain, which is important because all plants and animals need freshwater to live. These maps made from NASA satellite observations show how much of Earth's surface is covered by clouds for a given day, or over a span of days.";
      } else if (layers[i].title.startsWith("Cloud Optical Thickness")) {
        wmsLayer["abstract"] =
          "More than just the idle stuff of daydreams, clouds help control the flow of light and heat around our world. Because there are so many clouds spread over such large areas of Earth, they are a very important part of our world's climate system. Clouds have the ability to cool our planet, or they can help to warm it. Because there are so many different kinds of clouds, and because they move and change so fast, they are hard to understand and even harder to predict. Scientists want to know how much sunlight clouds reflect and how much sunlight passes through clouds to reach Earth's surface. By measuring how much sunlight gets scattered by clouds back up into space, scientists can better understand how much clouds influence Earth's climate.";
      }
      /**var topLayers = xml.getElementsByTagName("Layer");
      var insideLayer = topLayers[0].getElementsByTagName("Layer");
      for(var i = 0; i < insideLayer.length; i++) {
    
    var abstract = insideLayer[i].getElementsByTagName("abstract");
    if(abstract){
      if(wmsLayer.title.startsWith(insideLayer[i].title)){
        wmsLayer["abstract"] = abstract;
      }
    }
    
  }
      */
      globe.addLayer(wmsLayer, { category: "base", enabled: false });
    }
  };

  // Create an asynchronous request to retrieve the data (XMLHttpRequest is not required)
  var xhr = new XMLHttpRequest();
  xhr.open("GET", serviceAddress);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        parseXml(xhr.responseXML);
        globe.addLayer(new WorldWind.BingRoadsLayer(), {
          category: "overlay",
          displayName: "Country Borders",
          enabled: false,
          detailControl: 1.5,
          opacity: 0.5
        });
        let layers = new LayersViewModel(globe);
        ko.applyBindings(layers, document.getElementById("layers"));
      }
    }
  };
  xhr.send();

  // Create the view models

  let settings = new SettingsViewModel(globe);
  let preview = new PreviewViewModel(globe);
  let search = new SearchViewModel(globe, preview.previewResults);

  // Bind the views to the view models

  ko.applyBindings(settings, document.getElementById("settings"));
  ko.applyBindings(search, document.getElementById("search"));
  ko.applyBindings(preview, document.getElementById("preview"));

  // Auto-collapse the main menu when its button items are clicked
  $('.navbar-collapse a[role="button"]').click(function() {
    document.getElementById("info-bar").style.display = "none";
    document.getElementById("side-bar").style.display = "none";
    document.getElementById("text-box").style.display = "none";
    $(".navbar-collapse").collapse("hide");
  });

  // Collapse card ancestors when the close icon is clicked
  $(".collapse .close").on("click", function() {
    document.getElementById("info-bar").style.display = "none";
    document.getElementById("side-bar").style.display = "none";
    document.getElementById("text-box").style.display = "none";
    $(this)
      .closest(".collapse")
      .collapse("hide");
  });
});
