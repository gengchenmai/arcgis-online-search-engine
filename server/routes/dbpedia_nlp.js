const request = require('request');
const async = require('async');

// var placeInfoList = {};

function placeNameRecognition(inputSearchText, user_lat, user_lon, fk_place) {
	var dbpediaSpotlightURL = `https://api.dbpedia-spotlight.org/en/annotate?text=${inputSearchText}`;
	request({
		method: "GET",
		url: dbpediaSpotlightURL,
		headers: {
			accept: 'application/json'
		}
	}, (e_req, d_res, s_body) => {
		// console.log(d_res.headers['content-type']);
		if(e_req) {
			console.log(e_req);
			fk_place({placeInfoList: null, placeNERresult: null});
		} else {
			// console.log(s_body);
			var result = JSON.parse(s_body);
			// var result = s_body;
			console.log(result);
			// var urlList = [];
			var placeInfoList = {};

			var isPlaceRecog = false;
			
			if(result.hasOwnProperty("Resources")){
				for(var i = 0; i < result["Resources"].length; i++){
					var placeItem = result["Resources"][i];
					var types = result["Resources"][i]["@types"];
					if(types.includes("Schema:Place") ||  types.includes("DBpedia:Place") || types.includes("DBpedia:PopulatedPlace")){
						// urlList.push(placeItem["@URI"]);
						isPlaceRecog = true;
						placeInfoList[placeItem["@URI"]] = {};
						placeInfoList[placeItem["@URI"]]["word"] = placeItem["@surfaceForm"];
						placeInfoList[placeItem["@URI"]]["offset"] = placeItem["@offset"];
					}
				}
			}


			// else{
			// 	fk_place({placeInfoList: null, placeNERresult: null});
			// }
			if(!isPlaceRecog){
				if(user_lat !== null && user_lon !== null){
					wikidata_user_nearby_city(user_lat, user_lon, (placeInfoList_wikidata)=>{
						if(placeInfoList_wikidata){
							placeInfoList = placeInfoList_wikidata;

							var urlList = Object.keys(placeInfoList);
							var geoCodeObj_list = [];

							async.each(urlList, function(placeURL, fk_async){
								arcgis_geocoding(placeURL, placeInfoList, (geoCodeObj)=>{
									if(geoCodeObj){
										geoCodeObj_list.push(geoCodeObj);
									}
									fk_async();
								});
							}, function(err){
								if( err ) {
									// One of the iterations produced an error.
									// All processing will now stop.
									console.log('A place failed to geocoded');
								} else {
									console.log('All places have been geocoded successfully');
								}
								
								arcgis_geocoding_postprocess(placeInfoList, geoCodeObj_list, (placeInfoList_geocode_postprocess)=>{
									placeInfoList = placeInfoList_geocode_postprocess;

									console.log(placeInfoList);

									var numOfPlace = Object.keys(placeInfoList).length;
									for(var url in placeInfoList){
										placeInfoList[url]["importance"] = 1.0/numOfPlace;
									}
									fk_place({placeInfoList:placeInfoList, placeNERresult: null});
									

								});

							});

						}else{
							fk_place({placeInfoList: null, placeNERresult: null});
						}

					});
				}else{
					fk_place({placeInfoList: null, placeNERresult: null});
				}

			}else{
				// console.log(urlList);
				dbpedia_location(placeInfoList, function(placeInfoList_geo){
					
					placeInfoList = placeInfoList_geo;
					var urlList = Object.keys(placeInfoList);
					var geonamesObj_list = [];

					async.each(urlList, function(placeURL, fk_async_geonames){
						geonames_place_enrich(placeURL, placeInfoList, (geonamesObj)=>{
							if(geonamesObj){
								geonamesObj_list.push(geonamesObj);
							}
							fk_async_geonames();
						});
					}, function(err){
						if( err ) {
							// One of the iterations produced an error.
							// All processing will now stop.
							console.log('A place failed to get GeoNames SubDivision!');
						} else {
							console.log('All places have get GeoNames SubDivision successfully');
						}
						geonames_place_enrich_postProcess(placeInfoList, geonamesObj_list, (placeInfoList_geo_enrich)=>{
							placeInfoList = placeInfoList_geo_enrich;
						

							var geoCodeObj_list = [];

							async.each(urlList, function(placeURL, fk_async){
								arcgis_geocoding(placeURL, placeInfoList, (geoCodeObj)=>{
									if(geoCodeObj){
										geoCodeObj_list.push(geoCodeObj);
									}
									fk_async();
								});
							}, function(err){
								if( err ) {
									// One of the iterations produced an error.
									// All processing will now stop.
									console.log('A place failed to geocoded');
								} else {
									console.log('All places have been geocoded successfully');
								}
								
								arcgis_geocoding_postprocess(placeInfoList, geoCodeObj_list, (placeInfoList_geocode_postprocess)=>{
									placeInfoList = placeInfoList_geocode_postprocess;

									console.log(placeInfoList);

									var numOfPlace = Object.keys(placeInfoList).length;
									for(var url in placeInfoList){
										placeInfoList[url]["importance"] = 1.0/numOfPlace;
									}
									fk_place({placeInfoList:placeInfoList, placeNERresult: s_body});
									

								});

							});
						});
					});

					
				});
			}
			

		}
	});
}

function arcgis_geocoding_postprocess(placeInfoList, geoCodeObj_list, fk_geocode_postprocess){
	console.log(geoCodeObj_list);
	if(placeInfoList){
		for(var k = 0; k < geoCodeObj_list.length; k++){
		// for(var geoCodeObj in geoCodeObj_list){
			var geoCodeObj = geoCodeObj_list[k];

			var placeURL = geoCodeObj.placeURL;
			var locations = geoCodeObj.locations;
			// console.log("placeURL: " + placeURL);

			if(placeInfoList.hasOwnProperty(placeURL)){

				var lat, long = null;	
				if(placeInfoList[placeURL].hasOwnProperty("lat")){
					lat = placeInfoList[placeURL]["lat"];
				}
				if(placeInfoList[placeURL].hasOwnProperty("long")){
					long = placeInfoList[placeURL]["long"];
				}

				var placeIndex = -1;
				if(lat !== null && long !== null){
					for(var i = 0; i < locations.length; i++){
						if(isPlaceInExtent(lat, long, locations[i].extent)){
							placeIndex = i;
							break;
						}
					}
				}

				if(placeIndex === -1 && locations.length > 0){
					placeIndex = 0;
				}
				// console.log("placeIndex: " + placeIndex.toString());
				if(placeIndex !== -1){
					var r = PlaceExtent2Radius(locations[placeIndex].extent, locations[placeIndex].feature.geometry);
					placeInfoList[placeURL]["lat"] = locations[placeIndex].feature.geometry.y;
					placeInfoList[placeURL]["long"] = locations[placeIndex].feature.geometry.x;
					placeInfoList[placeURL]["r"] = r;
				}
				
			}
		}
	}
	fk_geocode_postprocess(placeInfoList);
}

function arcgis_geocoding(placeURL, placeInfoList, fk_geocode){
	console.log("ArcGIS Geocoding Begins...................................................");
	console.log(placeURL);
	console.log(placeInfoList);
	var placeName = placeURL.replace("http://dbpedia.org/resource/", "");
	
	if(placeInfoList){
		if(placeInfoList.hasOwnProperty(placeURL)){
			if(placeInfoList[placeURL].hasOwnProperty("label")){
				placeName = placeInfoList[placeURL]["label"];
			}
			
		}
	}
	var url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find?maxLocations=3&outSR=4326&f=json&outFileds=*&text=${placeName}`;
	request({
			method: "GET",
			url: url,
			headers: {
				accept: 'application/json'
			}
		}, (e_req, d_res, s_body) => {
			console.log(d_res.headers['content-type']);
			if(e_req) {
				constonsole.log(e_req);
				
				fk_geocode(null);
			} else {
				var h_json = JSON.parse(s_body);
				var locations = h_json.locations;
				console.log(locations);

				var geoCodeObj = {
					placeURL: placeURL,
					locations: locations
				};

				fk_geocode(geoCodeObj);


				
			}
			
	 
	});
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function PlaceExtent2Radius(extent, center){
	// We need to decide use ymax or ymin to compute the distance between center and the vertice
	// Although we use Haversine formula to compute great circle distance
	// We want to use y coordinate value which is closer to 0
	var dymax = Math.abs(extent.ymax - 0.0);
	var dymin = Math.abs(extent.ymin - 0.0);
	var lat2 = dymax < dymin ? extent.ymax : extent.ymin;
	var long2 = extent.xmax;

	var r = getDistanceFromLatLonInKm(center.y, center.x, lat2, long2);

	// var x = Math.abs(extent.xmax - extent.xmin)/2;
	// var y = Math.abs(extent.ymax - extent.ymin)/2;

	// var r = Math.sqrt(x*x + y*y);

	return r;
}

function isPlaceInExtent(lat, long, extent){
	if(lat > extent.ymin && lat < extent.ymax && long > extent.xmin && long < extent.xmax)
		return true;
	else
		return false;
}


// if the DBpedia Spotlight can not get the placename and we have the user's location, 
// we can use Wikidata endpoint to get the most nearby city location. We use this location to do Geo Component
function wikidata_user_nearby_city(user_lat, user_lon, fk_wikidata){
	var placeInfoList = null;
	var query_str = `
					PREFIX wd: <http://www.wikidata.org/entity/>
					PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
					PREFIX geo: <http://www.opengis.net/ont/geosparql#>
					PREFIX wikibase: <http://wikiba.se/ontology#>
					PREFIX wdt: <http://www.wikidata.org/prop/direct/>
					PREFIX bd: <http://www.bigdata.com/rdf#>

					SELECT distinct ?place ?placeLabel ?distance ?location 
					WHERE {
					# geospatial queries
					SERVICE wikibase:around {
					# get the coordinates of a place
					?place wdt:P625 ?location .
					# create a buffer around (-122.4784360859997 37.81826788900048)
					bd:serviceParam wikibase:center "Point(` + user_lon.toString()+ ` ` + user_lat.toString()+ `)"^^geo:wktLiteral .
					# buffer radius 2km
					bd:serviceParam wikibase:radius "10" .
					bd:serviceParam wikibase:distance ?distance .
					}
					# retrieve the English label
					SERVICE wikibase:label {bd:serviceParam wikibase:language "en". ?place rdfs:label ?placeLabel .}
					?place wdt:P31 wd:Q515.
					#?placeFlatType wdt:P279* wd:Q2221906.

					# show results ordered by distance
					} ORDER BY ?distance
						`;
	console.log(query_str);

	const P_ENDPOINT = "https://query.wikidata.org/bigdata/namespace/wdq/sparql";
	request({
			method: "GET",
			url: P_ENDPOINT,
			headers: {
				accept: 'application/sparql-results+json'
			},
			qs: {
				query: query_str
			}
		}, (e_req, d_res, s_body) => {
			console.log(d_res.headers['content-type']);
			// console.log(e_req);
			if(e_req) {
				console.log(e_req);
			} else {
				try{
					var h_json = JSON.parse(s_body);
					var a_bindings = h_json.results.bindings;
					console.log(a_bindings);
					if(a_bindings.length > 0){
						var sparqlItem = a_bindings[0];
						var url = sparqlItem["place"]["value"];
						var label = sparqlItem["placeLabel"]["value"];
						var coord = sparqlItem["location"]["value"].replace("Point(", "").replace(")", "").split(" ");
						var place_lat = parseFloat(coord[1]);
						var place_lon = parseFloat(coord[0]);

						placeInfoList = {};
						placeInfoList[url] = {};
						placeInfoList[url]["label"] = label;
						placeInfoList[url]["lat"] = place_lat;
						placeInfoList[url]["long"] = place_lon;
						placeInfoList[url]["r"] = 1000;

						
					}else{
						placeInfoList = null;
					}
					
				}catch(jsonParseError){
					console.log(jsonParseError);
					// fk_geo(null);
					placeInfoList = null;
				}
				
				
			}
			fk_wikidata(placeInfoList);
	 
	});
}



function dbpedia_location(placeInfoList, fk_geo){
	var url_list_str = "";
	var urlList = Object.keys(placeInfoList);
	if(urlList.length > 0){
		for(var i = 0; i < urlList.length; i++){
			url_list_str += `(<${urlList[i]}>)\n`;
		}
		var query_str = `select ?place (sample(?lat) as ?lats) (sample(?long) as ?longs) (sample(?label) as ?labels) (sample(?area) as ?areas) (sample(?geoid) as ?geoids)
			where
			{
				OPTIONAL{
					?place geo:lat ?lat.
					?place geo:long ?long.
				}
				OPTIONAL{
					?place rdfs:label ?label.
					FILTER(lang(?label) = "en")
				}
				
				OPTIONAL{
					?place <http://dbpedia.org/ontology/PopulatedPlace/areaTotal> ?area.
				}

				OPTIONAL{
					?place <http://www.w3.org/2002/07/owl#sameAs> ?geoid .
					FILTER(CONTAINS(str(?geoid), 'geonames'))
				}
				VALUES (?place)
				{
					${url_list_str}
				}
			} `;

		console.log(query_str);

		const P_ENDPOINT = "https://dbpedia.org/sparql";
		request({
				method: "GET",
				url: P_ENDPOINT,
				headers: {
					accept: 'application/sparql-results+json'
				},
				qs: {
					query: query_str
				}
			}, (e_req, d_res, s_body) => {
				console.log(d_res.headers['content-type']);
				// console.log(e_req);
				if(e_req) {
					console.log(e_req);
				} else {
					try{
						var h_json = JSON.parse(s_body);
						var a_bindings = h_json.results.bindings;
						console.log(a_bindings);
						for(var i = 0; i < a_bindings.length; i++){
							var sparqlItem = a_bindings[i];
							var url = sparqlItem["place"]["value"];
							if(sparqlItem.hasOwnProperty("lats")){
								placeInfoList[url]["lat"] = parseFloat(sparqlItem["lats"]["value"]);
							}
							if(sparqlItem.hasOwnProperty("longs")){
								placeInfoList[url]["long"] = parseFloat(sparqlItem["longs"]["value"]);
							}
							if(sparqlItem.hasOwnProperty("labels")){
								placeInfoList[url]["label"] = sparqlItem["labels"]["value"];
							}
							if(sparqlItem.hasOwnProperty("geoids")){
								placeInfoList[url]["geoid"] = sparqlItem["geoids"]["value"];
							}
										
							// the bandwidth or scale of the gauss kernel which is used in spatial query
							var r = 1000;
							if(sparqlItem.hasOwnProperty("areas")){
								var area = parseFloat(sparqlItem["areas"]["value"]);
								r = Math.sqrt(area)/2;

							}

							placeInfoList[url]["r"] = r;

						}
						
					}catch(jsonParseError){
						console.log(jsonParseError);
						// fk_geo(null);
					}
					
					
				}
				fk_geo(placeInfoList);
		 
		});

	}else{
		fk_geo(placeInfoList);
	}
}

function geonames_place_enrich_postProcess(placeInfoList, geonamesObj_list, fk_geonames_enrich_postprocess){
	console.log(geonamesObj_list);
	if(placeInfoList){
		for(var i = 0; i < geonamesObj_list.length; i++){
			var geonamesObj = geonamesObj_list[i];
			var placeURL = geonamesObj.placeURL;
			placeInfoList[placeURL]["enrichPlace"] = geonamesObj.geonames;

		}
	}
	fk_geonames_enrich_postprocess(placeInfoList);
}

function geonames_place_enrich(placeURL, placeInfoList, fk_geonames_enrich){
	if(placeInfoList[placeURL].hasOwnProperty("geoid")){
		var geoid = placeInfoList[placeURL]["geoid"];
		var geonames_id = geoid.replace("http://sws.geonames.org/", "");
		geonames_id = geonames_id.replace("/", "");

		var url = `http://api.geonames.org/childrenJSON?geonameId=${geonames_id}&maxRows=10&username=gengchen_mai`;
		
		
			
		request({
				method: "GET",
				url: url,
				headers: {
					accept: 'application/sparql-results+json'
				}
			}, (e_req, d_res, s_body) => {
				console.log(d_res.headers['content-type']);
				// console.log(e_req);
				var geonamesObj = {
					placeURL: placeURL,
					geonames: {}
				};
				geonamesObj[placeURL] = [];
				if(e_req) {
					console.log(e_req);
					fk_geonames_enrich(null);
				} else {
					try{
						var h_json = JSON.parse(s_body);
						var data_list = h_json.geonames;
						console.log(data_list);
						
						for(var i = 0; i < data_list.length; i++){
							var geoItem = data_list[i];
							var name = "";
							var geonameId = geoItem["geonameId"];
							if(geoItem.hasOwnProperty("name")){
								name = geoItem["name"];
							}else{
								if(geoItem.hasOwnProperty("toponymName")){
									name = geoItem["toponymName"];
								}
							}

							if(name !== ""){
								name = name.toLowerCase();
								geonamesObj.geonames[geonameId] = name;
							}
							
						}

						fk_geonames_enrich(geonamesObj);

					}catch(jsonParseError){
						console.log(jsonParseError);
						fk_geonames_enrich(null);
					}
				}
		 
		});
	}else{
		fk_geonames_enrich(null);
	}
}

function dbpedia_place_enrich(placeInfoList, fk_geo_enrich){
	var	url_list_str = "";
	var urlList = Object.keys(placeInfoList);
	if(urlList.length > 0){
		for(var i = 0; i < urlList.length; i++){
			url_list_str += `(<${urlList[i]}>)\n`;
		}
		var query_str = `select ?place ?enrichPlace ?enrichLabel
			where
			{
				?place dbo:isPartOf ?enrichPlace.
				?enrichPlace rdfs:label ?enrichLabel.
				filter(lang(?enrichLabel) = "en")

				VALUES (?place)
				{
					${url_list_str}
				}

			} `;
		// var query_str = `select ?place ?enrichPlace ?enrichLabel
		// 	where
		// 	{
		// 		{?enrichPlace dbo:isPartOf ?place.} UNION {?place dbo:isPartOf ?enrichPlace.}
		// 		?enrichPlace rdfs:label ?enrichLabel.
		// 		filter(lang(?enrichLabel) = "en")

		// 		VALUES (?place)
		// 		{
		// 			${url_list_str}
		// 		}

		// 	} `;

		console.log(query_str);

		const P_ENDPOINT = "https://dbpedia.org/sparql";
		request({
				method: "GET",
				url: P_ENDPOINT,
				headers: {
					accept: 'application/sparql-results+json'
				},
				qs: {
					query: query_str
				}
			}, (e_req, d_res, s_body) => {
				console.log(d_res.headers['content-type']);
				// console.log(e_req);
				if(e_req) {
					console.log(e_req);
				} else {
					try{
						var h_json = JSON.parse(s_body);
						var a_bindings = h_json.results.bindings;
						console.log(a_bindings);
						// fk_geo(a_bindings);
						for(var i = 0; i < a_bindings.length; i++){
							var sparqlItem = a_bindings[i];
							var url = sparqlItem["place"]["value"];
							var enrichPlaceURL = sparqlItem["enrichPlace"]["value"];
							var enrichPlaceLabel = sparqlItem["enrichLabel"]["value"];
							var enrichPlaceLabel_process = enrichPlaceLabel.split(",")[0].toLowerCase();
							console.log(enrichPlaceLabel_process);

							if(!placeInfoList[url].hasOwnProperty("enrichPlace")){
								placeInfoList[url]["enrichPlace"] = {};
							}

							placeInfoList[url]["enrichPlace"][enrichPlaceURL] = enrichPlaceLabel_process;

							
						}

					}catch(jsonParseError){
						console.log(jsonParseError);
						// fk_geo(null);
					}
				}
				fk_geo_enrich(placeInfoList);
		 
		});

	}else{
		fk_geo_enrich(placeInfoList);
	}
	
}

// function getsearchKeyWordList(searchKeywordObj, placeInfoList, fk_searchList){
// 	searchKeywordList = [];
// 	// if(placeInfoList){
// 	// 	place_word_list = [];
// 	// 	for(var url in placeInfoList){
// 	// 		place_word_list.push(placeInfoList[url]["word"]);
// 	// 	}
// 	// 	console.log(place_word_list);
// 	// 	for(var word in searchKeywordObj){
// 	// 		var item = searchKeywordObj[word];
// 	// 		var w2vList = item["w2v"];
// 	// 		var importance = item["importance"];

// 	// 		var ori_word = item["origin"];
// 	// 		console.log(ori_word);
// 	// 		if(place_word_list.indexOf(ori_word) > -1){
// 	// 			w2vList[0].dist = importance;
// 	// 			searchKeywordList.push(w2vList[0]);
// 	// 		}else{

// 	// 			// var sum = 0.0;
// 	// 			// for(var i = 0; i < w2vList.length; i++){
// 	// 			// 	sum += w2vList[i].dist;
// 	// 			// }
				
// 	// 			for(var i = 0; i < w2vList.length; i++){
// 	// 				w2vList[i].dist = importance*w2vList[i].dist;
// 	// 				// w2vList[i].dist = importance*w2vList[i].dist/sum;
// 	// 				searchKeywordList.push(w2vList[i]);
// 	// 			}
// 	// 		}	
// 	// 	}

// 	// 	fk_searchList(searchKeywordList);
// 	// }else{
// 		for(var word in searchKeywordObj){
// 			var item = searchKeywordObj[word];
// 			var w2vList = item["w2v"];
// 			var sum = 0.0;
// 			for(var i = 0; i < w2vList.length; i++){
// 				sum += w2vList[i].dist;
// 			}
// 			var importance = item["importance"];
// 			for(var i = 0; i < w2vList.length; i++){
// 				w2vList[i].dist = importance*w2vList[i].dist/sum;
// 				searchKeywordList.push(w2vList[i]);
// 			}
// 		}

// 		fk_searchList(searchKeywordList);
// 	// }
// }


module.exports = {  
	placeNameRecognition: placeNameRecognition,
	// getsearchKeyWordList:getsearchKeyWordList
};